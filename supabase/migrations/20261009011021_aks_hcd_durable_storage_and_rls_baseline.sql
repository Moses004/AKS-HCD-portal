-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- AKS-HCD durable storage baseline. Non-destructive: creates missing objects only.
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('state_admin','lga_admin','public')),
  lga_id text,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_lga_role_check check (
    (role = 'lga_admin' and lga_id is not null) or (role <> 'lga_admin')
  )
);

create table if not exists public.activities (
  id text primary key,
  lga_id text not null,
  lga_name text not null,
  title text not null,
  pillar text not null check (pillar in ('education','health','vocational','agriculture')),
  sub_category text,
  community text,
  lat double precision,
  lng double precision,
  beneficiaries_total integer not null default 0 check (beneficiaries_total >= 0),
  beneficiaries_male integer not null default 0 check (beneficiaries_male >= 0),
  beneficiaries_female integer not null default 0 check (beneficiaries_female >= 0),
  youth_beneficiaries integer not null default 0 check (youth_beneficiaries >= 0),
  budget_ngn numeric(18,2) not null default 0 check (budget_ngn >= 0),
  start_date date,
  completion_date date,
  lead_officer text,
  officer_contact text,
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_APPROVAL','PUBLISHED','REJECTED_DRAFT')),
  overall_progress integer not null default 0 check (overall_progress between 0 and 100),
  milestones jsonb not null default '[]'::jsonb,
  media_assets jsonb not null default '[]'::jsonb,
  attendance_registry_url text,
  attendance_sheet_file_name text,
  submission_notes text,
  rejection_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_beneficiary_balance check (beneficiaries_male + beneficiaries_female = beneficiaries_total)
);

create table if not exists public.audit_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  activity_id text,
  activity_title text,
  lga_id text,
  performed_by text not null,
  actor_user_id uuid references auth.users(id),
  role text not null check (role in ('public','lga_admin','state_admin')),
  action text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ptr_test_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  test_vector text not null,
  passed boolean not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  executed_by text,
  executed_by_user_id uuid references auth.users(id)
);

create index if not exists activities_lga_updated_idx on public.activities(lga_id, updated_at desc);
create index if not exists activities_status_updated_idx on public.activities(status, updated_at desc);
create index if not exists activities_pillar_idx on public.activities(pillar);
create index if not exists audit_logs_timestamp_idx on public.audit_logs(timestamp desc);
create index if not exists audit_logs_lga_timestamp_idx on public.audit_logs(lga_id, timestamp desc);
create index if not exists audit_logs_activity_idx on public.audit_logs(activity_id);

create or replace function public.aks_hcd_current_role()
returns text language sql stable security definer set search_path = ''
as $$
  select p.role from public.user_profiles p
  where p.user_id = (select auth.uid()) and p.active = true
  limit 1
$$;

create or replace function public.aks_hcd_current_lga()
returns text language sql stable security definer set search_path = ''
as $$
  select p.lga_id from public.user_profiles p
  where p.user_id = (select auth.uid()) and p.active = true
  limit 1
$$;

create or replace function public.aks_hcd_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then new.updated_by = auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists activities_touch_updated_at on public.activities;
create trigger activities_touch_updated_at before update on public.activities
for each row execute function public.aks_hcd_touch_updated_at();

alter table public.user_profiles enable row level security;
alter table public.activities enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ptr_test_logs enable row level security;

-- Profiles are provisioned by a trusted administrator, never by client self-registration.
drop policy if exists "profile_read_self_or_state_admin" on public.user_profiles;
create policy "profile_read_self_or_state_admin" on public.user_profiles
for select to authenticated
using (user_id = (select auth.uid()) or public.aks_hcd_current_role() = 'state_admin');

-- Published activities are public; authenticated admins see only their permitted scope.
drop policy if exists "activities_select_scoped" on public.activities;
create policy "activities_select_scoped" on public.activities
for select to anon, authenticated
using (
  status = 'PUBLISHED'
  or (auth.uid() is not null and public.aks_hcd_current_role() = 'state_admin')
  or (auth.uid() is not null and public.aks_hcd_current_role() = 'lga_admin' and lga_id = public.aks_hcd_current_lga())
);

drop policy if exists "activities_insert_lga_draft" on public.activities;
create policy "activities_insert_lga_draft" on public.activities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.aks_hcd_current_role() = 'lga_admin'
  and lga_id = public.aks_hcd_current_lga()
  and status in ('DRAFT','PENDING_APPROVAL')
);

drop policy if exists "activities_update_lga_draft" on public.activities;
create policy "activities_update_lga_draft" on public.activities
for update to authenticated
using (
  public.aks_hcd_current_role() = 'state_admin'
  or (public.aks_hcd_current_role() = 'lga_admin' and lga_id = public.aks_hcd_current_lga() and status in ('DRAFT','REJECTED_DRAFT'))
)
with check (
  public.aks_hcd_current_role() = 'state_admin'
  or (public.aks_hcd_current_role() = 'lga_admin' and lga_id = public.aks_hcd_current_lga() and status in ('DRAFT','REJECTED_DRAFT','PENDING_APPROVAL'))
);

drop policy if exists "activities_delete_state_admin" on public.activities;
create policy "activities_delete_state_admin" on public.activities
for delete to authenticated
using (public.aks_hcd_current_role() = 'state_admin');

drop policy if exists "audit_logs_select_scoped" on public.audit_logs;
create policy "audit_logs_select_scoped" on public.audit_logs
for select to authenticated
using (
  public.aks_hcd_current_role() = 'state_admin'
  or (public.aks_hcd_current_role() = 'lga_admin' and lga_id = public.aks_hcd_current_lga())
);

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and role = public.aks_hcd_current_role()
  and (public.aks_hcd_current_role() = 'state_admin'
       or (public.aks_hcd_current_role() = 'lga_admin' and (lga_id is null or lga_id = public.aks_hcd_current_lga())))
);

drop policy if exists "ptr_logs_state_admin_read" on public.ptr_test_logs;
create policy "ptr_logs_state_admin_read" on public.ptr_test_logs
for select to authenticated
using (public.aks_hcd_current_role() = 'state_admin');

drop policy if exists "ptr_logs_state_admin_insert" on public.ptr_test_logs;
create policy "ptr_logs_state_admin_insert" on public.ptr_test_logs
for insert to authenticated
with check (
  executed_by_user_id = (select auth.uid())
  and public.aks_hcd_current_role() = 'state_admin'
);

-- Evidence must be private and stored under a first path segment matching the assigned LGA.
insert into storage.buckets (id, name, public, file_size_limit)
values ('hcd-evidence-vault','hcd-evidence-vault',false,52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "hcd_evidence_read_scoped" on storage.objects;
create policy "hcd_evidence_read_scoped" on storage.objects
for select to authenticated
using (
  bucket_id = 'hcd-evidence-vault'
  and (
    public.aks_hcd_current_role() = 'state_admin'
    or (public.aks_hcd_current_role() = 'lga_admin' and (storage.foldername(name))[1] = public.aks_hcd_current_lga())
  )
);

drop policy if exists "hcd_evidence_insert_scoped" on storage.objects;
create policy "hcd_evidence_insert_scoped" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hcd-evidence-vault'
  and public.aks_hcd_current_role() = 'lga_admin'
  and (storage.foldername(name))[1] = public.aks_hcd_current_lga()
);

drop policy if exists "hcd_evidence_update_scoped" on storage.objects;
create policy "hcd_evidence_update_scoped" on storage.objects
for update to authenticated
using (
  bucket_id = 'hcd-evidence-vault'
  and (public.aks_hcd_current_role() = 'state_admin'
       or (public.aks_hcd_current_role() = 'lga_admin' and (storage.foldername(name))[1] = public.aks_hcd_current_lga()))
)
with check (
  bucket_id = 'hcd-evidence-vault'
  and (public.aks_hcd_current_role() = 'state_admin'
       or (public.aks_hcd_current_role() = 'lga_admin' and (storage.foldername(name))[1] = public.aks_hcd_current_lga()))
);

drop policy if exists "hcd_evidence_delete_state_admin" on storage.objects;
create policy "hcd_evidence_delete_state_admin" on storage.objects
for delete to authenticated
using (bucket_id = 'hcd-evidence-vault' and public.aks_hcd_current_role() = 'state_admin');

grant select on public.activities to anon, authenticated;
grant insert, update, delete on public.activities to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.ptr_test_logs to authenticated;
grant select on public.user_profiles to authenticated;

-- Realtime publication: tolerate already-added tables by checking publication membership.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activities') then
      alter publication supabase_realtime add table public.activities;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='audit_logs') then
      alter publication supabase_realtime add table public.audit_logs;
    end if;
  end if;
end $$;

