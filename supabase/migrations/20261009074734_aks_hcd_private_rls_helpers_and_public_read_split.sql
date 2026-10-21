-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Move RLS helper functions into a non-exposed schema, and split public read access
-- from authenticated role-scoped access. This avoids exposing SECURITY DEFINER RPCs.
create schema if not exists private;

create or replace function private.aks_hcd_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.user_profiles p
  where p.user_id = (select auth.uid())
    and p.active = true
  limit 1
$$;

create or replace function private.aks_hcd_current_lga()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.lga_id
  from public.user_profiles p
  where p.user_id = (select auth.uid())
    and p.active = true
  limit 1
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.aks_hcd_current_role() from public, anon;
revoke all on function private.aks_hcd_current_lga() from public, anon;
grant execute on function private.aks_hcd_current_role() to authenticated;
grant execute on function private.aks_hcd_current_lga() to authenticated;

-- Profiles
drop policy if exists "profile_read_self_or_state_admin" on public.user_profiles;
create policy "profile_read_self_or_state_admin" on public.user_profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.aks_hcd_current_role() = 'state_admin'
);

-- Activities: anonymous access is strictly published rows; authenticated access is role-scoped.
drop policy if exists "activities_select_scoped" on public.activities;
drop policy if exists "activities_select_published_public" on public.activities;
drop policy if exists "activities_select_authenticated_scoped" on public.activities;

create policy "activities_select_published_public" on public.activities
for select to anon
using (status = 'PUBLISHED');

create policy "activities_select_authenticated_scoped" on public.activities
for select to authenticated
using (
  status = 'PUBLISHED'
  or private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
  )
);

drop policy if exists "activities_insert_lga_draft" on public.activities;
create policy "activities_insert_lga_draft" on public.activities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.aks_hcd_current_role() = 'lga_admin'
  and lga_id = private.aks_hcd_current_lga()
  and status in ('DRAFT','PENDING_APPROVAL')
);

drop policy if exists "activities_update_lga_draft" on public.activities;
create policy "activities_update_lga_draft" on public.activities
for update to authenticated
using (
  private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
    and status in ('DRAFT','REJECTED_DRAFT')
  )
)
with check (
  private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
    and status in ('DRAFT','REJECTED_DRAFT','PENDING_APPROVAL')
  )
);

drop policy if exists "activities_delete_state_admin" on public.activities;
create policy "activities_delete_state_admin" on public.activities
for delete to authenticated
using (private.aks_hcd_current_role() = 'state_admin');

-- Audit logs
drop policy if exists "audit_logs_select_scoped" on public.audit_logs;
create policy "audit_logs_select_scoped" on public.audit_logs
for select to authenticated
using (
  private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
  )
);

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and role = private.aks_hcd_current_role()
  and (
    private.aks_hcd_current_role() = 'state_admin'
    or (
      private.aks_hcd_current_role() = 'lga_admin'
      and (lga_id is null or lga_id = private.aks_hcd_current_lga())
    )
  )
);

-- PTR test logs
drop policy if exists "ptr_logs_state_admin_read" on public.ptr_test_logs;
create policy "ptr_logs_state_admin_read" on public.ptr_test_logs
for select to authenticated
using (private.aks_hcd_current_role() = 'state_admin');

drop policy if exists "ptr_logs_state_admin_insert" on public.ptr_test_logs;
create policy "ptr_logs_state_admin_insert" on public.ptr_test_logs
for insert to authenticated
with check (
  executed_by_user_id = (select auth.uid())
  and private.aks_hcd_current_role() = 'state_admin'
);

-- Storage evidence permissions
drop policy if exists "hcd_evidence_read_scoped" on storage.objects;
create policy "hcd_evidence_read_scoped" on storage.objects
for select to authenticated
using (
  bucket_id = 'hcd-evidence-vault'
  and (
    private.aks_hcd_current_role() = 'state_admin'
    or (
      private.aks_hcd_current_role() = 'lga_admin'
      and (storage.foldername(name))[1] = private.aks_hcd_current_lga()
    )
  )
);

drop policy if exists "hcd_evidence_insert_scoped" on storage.objects;
create policy "hcd_evidence_insert_scoped" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hcd-evidence-vault'
  and private.aks_hcd_current_role() = 'lga_admin'
  and (storage.foldername(name))[1] = private.aks_hcd_current_lga()
);

drop policy if exists "hcd_evidence_update_scoped" on storage.objects;
create policy "hcd_evidence_update_scoped" on storage.objects
for update to authenticated
using (
  bucket_id = 'hcd-evidence-vault'
  and (
    private.aks_hcd_current_role() = 'state_admin'
    or (
      private.aks_hcd_current_role() = 'lga_admin'
      and (storage.foldername(name))[1] = private.aks_hcd_current_lga()
    )
  )
)
with check (
  bucket_id = 'hcd-evidence-vault'
  and (
    private.aks_hcd_current_role() = 'state_admin'
    or (
      private.aks_hcd_current_role() = 'lga_admin'
      and (storage.foldername(name))[1] = private.aks_hcd_current_lga()
    )
  )
);

drop policy if exists "hcd_evidence_delete_state_admin" on storage.objects;
create policy "hcd_evidence_delete_state_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'hcd-evidence-vault'
  and private.aks_hcd_current_role() = 'state_admin'
);

-- Disable direct RPC execution of the legacy public SECURITY DEFINER functions.
revoke all on function public.aks_hcd_current_role() from public;
revoke all on function public.aks_hcd_current_role() from anon;
revoke all on function public.aks_hcd_current_role() from authenticated;
revoke all on function public.aks_hcd_current_lga() from public;
revoke all on function public.aks_hcd_current_lga() from anon;
revoke all on function public.aks_hcd_current_lga() from authenticated;

