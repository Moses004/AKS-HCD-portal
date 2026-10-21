-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

begin;

create table if not exists public.hcd_pillars (
  pillar_code text primary key,
  display_name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hcd_pillars_code_format check (pillar_code ~ '^[a-z][a-z0-9_]*$')
);

insert into public.hcd_pillars (pillar_code, display_name, description, sort_order, is_active)
values
  ('education', 'Education and Life long learning', 'Education access, participation, retention, learning outcomes and lifelong learning.', 1, true),
  ('health', 'Health', 'Health access, service quality, utilization and outcomes.', 2, true),
  ('vocational', 'Skill and labour participation', 'Skills development, employability, entrepreneurship and labour-market participation.', 3, true),
  ('agriculture', 'Agriculture', 'Agricultural livelihoods, productivity and related human-capital outcomes.', 4, true),
  ('cross_cutting_enablers', 'Cross-cutting Enablers', 'Cross-cutting themes including gender, governance, climate and youth investment.', 5, true),
  ('values_ethics_social_behaviour', 'Values, Ethics and Social Behaviour', 'Ethics, civic values and positive social-behaviour interventions.', 6, true)
on conflict (pillar_code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

alter table public.hcd_pillars enable row level security;

drop policy if exists hcd_pillars_read_active on public.hcd_pillars;
create policy hcd_pillars_read_active
  on public.hcd_pillars for select to anon, authenticated
  using (is_active = true);

revoke all on public.hcd_pillars from public;
grant select on public.hcd_pillars to anon, authenticated;

create index if not exists activities_lga_report_idx
  on public.activities (lga_id, status, created_at desc);
create index if not exists activities_lga_name_report_idx
  on public.activities (lga_name, status, created_at desc);
create index if not exists activity_measurements_activity_period_idx
  on public.activity_measurements (activity_id, reporting_period_start, reporting_period_end);
create index if not exists activity_measurements_indicator_idx
  on public.activity_measurements (indicator_code, reporting_period_start, reporting_period_end);

comment on table public.hcd_pillars is 'Canonical HCD pillar codes and their user-facing display names. Store pillar_code in activities; render display_name in the UI and reports.';
comment on column public.hcd_pillars.pillar_code is 'Stable machine-readable key that matches activities.pillar; do not use the display label as a stored key.';
comment on table public.activities is 'HCD activity submissions. LGA reports should export all activity fields plus linked activity_measurements visible under RLS.';

commit;

