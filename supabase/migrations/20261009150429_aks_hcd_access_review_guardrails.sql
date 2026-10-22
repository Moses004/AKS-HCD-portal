-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

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

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'A valid different target user is required; self-review is not permitted';
  end if;

  if p_decision is null or p_decision not in ('approve','reject','suspend') then
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

