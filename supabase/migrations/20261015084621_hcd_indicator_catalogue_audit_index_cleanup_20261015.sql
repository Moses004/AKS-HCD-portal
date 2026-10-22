-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

begin;
-- Keep the pre-existing equivalent indexes and remove duplicates introduced by the LGA-report optimization.
drop index if exists public.activity_measurements_activity_period_idx;
drop index if exists public.activity_measurements_indicator_idx;

-- Cover the auth.users foreign key for measurement attribution and FK maintenance.
create index if not exists activity_measurements_entered_by_idx
  on public.activity_measurements (entered_by);

comment on table public.hcd_reporting_indicators is
'Canonical reporting indicator catalogue for Education, Health, Skill and labour, Cross-cutting Enablers, and Values/Ethics/Social behaviour. Indicator definitions are not numeric targets; targets should be managed separately by LGA and reporting period when needed.';

commit;

