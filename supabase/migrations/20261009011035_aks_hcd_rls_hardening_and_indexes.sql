-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Tighten helper function exposure and address database advisor findings.
revoke all on function public.aks_hcd_current_role() from public, anon;
revoke all on function public.aks_hcd_current_lga() from public, anon;
grant execute on function public.aks_hcd_current_role() to authenticated;
grant execute on function public.aks_hcd_current_lga() to authenticated;

create index if not exists activities_created_by_idx on public.activities(created_by);
create index if not exists activities_updated_by_idx on public.activities(updated_by);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists ptr_test_logs_executed_by_user_id_idx on public.ptr_test_logs(executed_by_user_id);

drop policy if exists "activities_select_scoped" on public.activities;
create policy "activities_select_scoped" on public.activities
for select to anon, authenticated
using (
  status = 'PUBLISHED'
  or ((select auth.uid()) is not null and public.aks_hcd_current_role() = 'state_admin')
  or ((select auth.uid()) is not null and public.aks_hcd_current_role() = 'lga_admin' and lga_id = public.aks_hcd_current_lga())
);

