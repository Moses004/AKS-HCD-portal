-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

drop policy if exists hcd_targets_select_scoped on public.hcd_indicator_targets;
create policy hcd_targets_select_scoped
on public.hcd_indicator_targets
for select to authenticated
using (
  private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
    and target_status = 'approved'
  )
);

