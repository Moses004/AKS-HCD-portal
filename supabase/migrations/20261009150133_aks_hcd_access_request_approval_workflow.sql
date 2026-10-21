-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

begin;

alter table public.user_profiles
  add column if not exists requested_role text not null default 'public',
  add column if not exists requested_lga_id text,
  add column if not exists staff_identifier text,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_notes text;

alter table public.user_profiles
  drop constraint if exists user_profiles_requested_role_check,
  add constraint user_profiles_requested_role_check
    check (requested_role in ('public','lga_admin','state_admin')),
  drop constraint if exists user_profiles_approval_status_check,
  add constraint user_profiles_approval_status_check
    check (approval_status in ('pending','approved','rejected','suspended'));

-- Preserve existing provisioned roles; do not grant new privileges during migration.
update public.user_profiles
set requested_role = case
      when role in ('state_admin','lga_admin') then role
      else 'public'
    end,
    approval_status = case
      when active = true and role in ('state_admin','lga_admin') then 'approved'
      when role = 'public' and active = true then 'approved'
      else 'pending'
    end,
    approved_at = case
      when active = true and role in ('state_admin','lga_admin','public') then coalesce(approved_at, updated_at, created_at, now())
      else approved_at
    end;

create or replace function public.aks_hcd_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_role_value text;
  requested_lga_value text;
  display_name_value text;
  staff_identifier_value text;
  department_value text;
begin
  requested_role_value := case
    when new.raw_user_meta_data ->> 'requested_role' in ('lga_admin','state_admin')
      then new.raw_user_meta_data ->> 'requested_role'
    else 'public'
  end;

  requested_lga_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'requested_lga_id','')), '');
  if requested_role_value <> 'lga_admin' then
    requested_lga_value := null;
  end if;

  display_name_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name','')), '');
  staff_identifier_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'staff_identifier','')), '');
  department_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'department','')), '');

  insert into public.user_profiles
    (user_id, display_name, role, lga_id, department, active,
     requested_role, requested_lga_id, staff_identifier, approval_status,
     created_at, updated_at)
  values
    (new.id, coalesce(display_name_value, split_part(coalesce(new.email,''),'@',1), 'Registered User'),
     'public', null, department_value, false,
     requested_role_value, requested_lga_value, staff_identifier_value, 'pending',
     now(), now())
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_aks_hcd_profile on auth.users;
create trigger on_auth_user_created_aks_hcd_profile
  after insert on auth.users
  for each row execute function public.aks_hcd_on_auth_user_created();

-- Ensure the role/LGA helpers grant access only to approved, active profiles.
create or replace function private.aks_hcd_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role
  from public.user_profiles p
  where p.user_id = (select auth.uid())
    and p.active = true
    and p.approval_status = 'approved'
  limit 1
$function$;

create or replace function private.aks_hcd_current_lga()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select p.lga_id
  from public.user_profiles p
  where p.user_id = (select auth.uid())
    and p.active = true
    and p.approval_status = 'approved'
    and p.role = 'lga_admin'
  limit 1
$function$;

-- Recreate self/admin read policy only; no client-side insert/update/delete policy is granted.
drop policy if exists profile_read_self_or_state_admin on public.user_profiles;
create policy profile_read_self_or_state_admin
on public.user_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.aks_hcd_current_role() = 'state_admin'
);

create or replace function public.review_hcd_access_request(
  p_user_id uuid,
  p_decision text,
  p_approved_role text default null,
  p_approved_lga_id text default null,
  p_notes text default null
)
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_role text;
  target public.user_profiles%rowtype;
  next_role text;
  next_lga text;
begin
  actor_role := private.aks_hcd_current_role();
  if auth.uid() is null or actor_role is distinct from 'state_admin' then
    raise exception 'Only an approved State Executive can review access requests'
      using errcode = '42501';
  end if;

  if p_decision not in ('approve','reject','suspend') then
    raise exception 'Decision must be approve, reject, or suspend';
  end if;

  select * into target
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Access request not found';
  end if;

  if p_decision = 'approve' then
    next_role := coalesce(p_approved_role, target.requested_role);
    if next_role not in ('lga_admin','state_admin') then
      raise exception 'Approved role must be lga_admin or state_admin';
    end if;

    if next_role = 'lga_admin' then
      next_lga := nullif(trim(coalesce(p_approved_lga_id, target.requested_lga_id, '')), '');
      if next_lga is null then
        raise exception 'An LGA must be explicitly assigned to an LGA Desk Worker';
      end if;
    else
      next_lga := null;
    end if;

    update public.user_profiles
    set role = next_role,
        lga_id = next_lga,
        active = true,
        approval_status = 'approved',
        approved_by = auth.uid(),
        approved_at = now(),
        approval_notes = nullif(trim(coalesce(p_notes,'')), ''),
        updated_at = now()
    where user_id = p_user_id
    returning * into target;
  elsif p_decision = 'reject' then
    update public.user_profiles
    set role = 'public',
        lga_id = null,
        active = false,
        approval_status = 'rejected',
        approved_by = auth.uid(),
        approved_at = now(),
        approval_notes = nullif(trim(coalesce(p_notes,'')), ''),
        updated_at = now()
    where user_id = p_user_id
    returning * into target;
  else
    update public.user_profiles
    set role = 'public',
        lga_id = null,
        active = false,
        approval_status = 'suspended',
        approved_by = auth.uid(),
        approved_at = now(),
        approval_notes = nullif(trim(coalesce(p_notes,'')), ''),
        updated_at = now()
    where user_id = p_user_id
    returning * into target;
  end if;

  return target;
end;
$function$;

revoke all on function public.review_hcd_access_request(uuid,text,text,text,text) from public, anon;
grant execute on function public.review_hcd_access_request(uuid,text,text,text,text) to authenticated;

revoke all on function public.aks_hcd_on_auth_user_created() from public, anon, authenticated;
grant execute on function private.aks_hcd_current_role() to anon, authenticated, service_role;
grant execute on function private.aks_hcd_current_lga() to anon, authenticated, service_role;

commit;

