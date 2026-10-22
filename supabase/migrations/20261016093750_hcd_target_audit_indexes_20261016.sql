-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
create index if not exists hcd_indicator_targets_created_by_idx on public.hcd_indicator_targets (created_by); create index if not exists hcd_indicator_targets_updated_by_idx on public.hcd_indicator_targets (updated_by);
