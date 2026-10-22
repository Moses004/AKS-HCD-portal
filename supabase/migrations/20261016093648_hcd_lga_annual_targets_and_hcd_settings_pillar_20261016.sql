-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

begin;

-- Preserve the existing canonical key to avoid breaking historical activities and frontend references;
-- change the user-facing pillar name and description only.
update public.hcd_pillars
set display_name = 'HCD Settings',
    description = 'Human Capital Development planning, coordination, reporting, monitoring, data quality and implementation oversight.',
    updated_at = now()
where pillar_code = 'agriculture';

-- Add a dedicated HCD Settings indicator set. Existing agriculture-keyed activity rows remain compatible.
insert into public.hcd_reporting_indicators
(indicator_code, reporting_category, pillar, segment, indicator_name, definition, required_data_fields, measurement_unit, calculation_method, collection_method, recommended_source, reporting_frequency, disaggregation_dimensions, evidence_required, is_active)
values
('HCDS-01','HCD Settings','agriculture',null,'LGA HCD reports submitted on time','Number and percentage of required HCD reports submitted by the approved reporting deadline.','["reports_due","reports_submitted_on_time","reporting_period","submission_register_reference"]'::jsonb,'reports and percent','Report count and on-time submission rate = reports_submitted_on_time / reports_due * 100; if reports_due is zero, report N/A.','Reporting calendar and submission register review','Approved reporting calendar and portal submission records','Quarterly',array['LGA','reporting_period','report_type'],array['submission register','timestamped portal record'],true),
('HCDS-02','HCD Settings','agriculture',null,'LGA HCD plans with approved indicators and annual targets','Number and percentage of required LGA HCD plans with approved indicators, baselines, annual targets and reporting periods.','["plans_required","plans_approved_with_targets","approval_date","plan_reference"]'::jsonb,'plans and percent','plans_approved_with_targets / plans_required * 100; verify that approval and target details are recorded.','Plan review against the approved HCD planning checklist','Approved LGA HCD plans and target register','Annually',array['LGA','plan_year','plan_type'],array['approved plan','indicator and target register'],true),
('HCDS-03','HCD Settings','agriculture',null,'HCD programme budget execution rate','Percentage of approved HCD programme budget executed during the reporting period, using the officially defined expenditure basis.','["approved_budget_ngn","actual_expenditure_ngn","reporting_period","financial_statement_reference"]'::jsonb,'percent','actual_expenditure_ngn / approved_budget_ngn * 100; disclose commitments versus cash expenditure and report N/A for zero budget.','Financial reconciliation and expenditure review','Approved budget, Accountant-General/finance returns and audited financial records','Quarterly',array['LGA','programme','fiscal_year','funding_source'],array['approved budget','expenditure report or ledger reference'],true),
('HCDS-04','HCD Settings','agriculture',null,'Scheduled HCD monitoring visits completed','Number and percentage of scheduled HCD monitoring visits completed with documented findings and follow-up actions.','["monitoring_visits_scheduled","monitoring_visits_completed","visit_date","monitoring_report_reference"]'::jsonb,'visits and percent','monitoring_visits_completed / monitoring_visits_scheduled * 100; count a visit as completed only when its report is documented.','Monitoring calendar and visit report verification','Approved monitoring plan, visit reports and action trackers','Quarterly',array['LGA','programme','pillar','monitoring_period'],array['monitoring visit report','action tracker'],true),
('HCDS-05','HCD Settings','agriculture',null,'HCD reporting data completeness and evidence compliance','Percentage of sampled or submitted HCD records meeting the approved completeness rules and containing required supporting evidence.','["records_reviewed","records_complete_with_required_evidence","data_quality_checklist_version","review_period"]'::jsonb,'percent','records_complete_with_required_evidence / records_reviewed * 100; state sample size and checklist version; report N/A when no records are reviewed.','Structured data-quality review and evidence spot checks','Portal validation logs, quality assurance checklist and evidence register','Quarterly',array['LGA','pillar','reporting_period','record_type'],array['completed quality checklist','evidence review record'],true)
on conflict (indicator_code) do update set
  reporting_category = excluded.reporting_category,
  pillar = excluded.pillar,
  segment = excluded.segment,
  indicator_name = excluded.indicator_name,
  definition = excluded.definition,
  required_data_fields = excluded.required_data_fields,
  measurement_unit = excluded.measurement_unit,
  calculation_method = excluded.calculation_method,
  collection_method = excluded.collection_method,
  recommended_source = excluded.recommended_source,
  reporting_frequency = excluded.reporting_frequency,
  disaggregation_dimensions = excluded.disaggregation_dimensions,
  evidence_required = excluded.evidence_required,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.hcd_indicator_targets (
  id uuid primary key default gen_random_uuid(),
  lga_id text not null,
  lga_name text not null,
  indicator_code text not null references public.hcd_reporting_indicators(indicator_code) on update cascade on delete restrict,
  reporting_year integer not null check (reporting_year between 2000 and 2200),
  period_start date not null,
  period_end date not null,
  baseline_year integer,
  baseline_value numeric(20,6),
  target_value numeric(20,6) not null,
  target_direction text not null default 'higher_is_better'
    check (target_direction in ('higher_is_better','lower_is_better','maintain')),
  measurement_unit text not null,
  target_status text not null default 'draft'
    check (target_status in ('draft','approved','retired')),
  target_notes text,
  source_reference text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hcd_indicator_targets_period_check check (period_end >= period_start),
  constraint hcd_indicator_targets_year_period_check check (
    extract(year from period_start)::integer = reporting_year
    and extract(year from period_end)::integer = reporting_year
  ),
  constraint hcd_indicator_targets_baseline_nonnegative check (baseline_value is null or baseline_value >= 0),
  constraint hcd_indicator_targets_target_nonnegative check (target_value >= 0),
  constraint hcd_indicator_targets_baseline_year_check check (baseline_year is null or baseline_year between 2000 and 2200),
  constraint hcd_indicator_targets_approval_check check (
    target_status <> 'approved' or (approved_by is not null and approved_at is not null)
  ),
  constraint hcd_indicator_targets_unique_lga_indicator_year unique (lga_id, indicator_code, reporting_year)
);

create index if not exists hcd_indicator_targets_lga_year_idx
  on public.hcd_indicator_targets (lga_id, reporting_year, target_status);
create index if not exists hcd_indicator_targets_indicator_year_idx
  on public.hcd_indicator_targets (indicator_code, reporting_year, target_status);
create index if not exists hcd_indicator_targets_approved_by_idx
  on public.hcd_indicator_targets (approved_by);

alter table public.hcd_indicator_targets enable row level security;

drop policy if exists hcd_targets_select_scoped on public.hcd_indicator_targets;
create policy hcd_targets_select_scoped
on public.hcd_indicator_targets
for select to authenticated
using (
  private.aks_hcd_current_role() = 'state_admin'
  or (
    private.aks_hcd_current_role() = 'lga_admin'
    and lga_id = private.aks_hcd_current_lga()
  )
);

drop policy if exists hcd_targets_insert_state_admin on public.hcd_indicator_targets;
create policy hcd_targets_insert_state_admin
on public.hcd_indicator_targets
for insert to authenticated
with check (
  private.aks_hcd_current_role() = 'state_admin'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and target_status = 'draft'
);

drop policy if exists hcd_targets_update_state_admin on public.hcd_indicator_targets;
create policy hcd_targets_update_state_admin
on public.hcd_indicator_targets
for update to authenticated
using (private.aks_hcd_current_role() = 'state_admin')
with check (
  private.aks_hcd_current_role() = 'state_admin'
  and updated_by = (select auth.uid())
);

drop policy if exists hcd_targets_delete_state_admin on public.hcd_indicator_targets;
create policy hcd_targets_delete_state_admin
on public.hcd_indicator_targets
for delete to authenticated
using (
  private.aks_hcd_current_role() = 'state_admin'
  and target_status = 'draft'
);

revoke all on public.hcd_indicator_targets from public, anon;
grant select, insert, update, delete on public.hcd_indicator_targets to authenticated;

comment on table public.hcd_indicator_targets is
'Approved LGA-specific annual targets and baseline values. Actual results should be derived from authorized activity_measurements for the same LGA, indicator and reporting period; do not store a duplicate actual value here.';
comment on column public.hcd_indicator_targets.lga_id is
'Stable LGA identifier matching activities.lga_id and private.aks_hcd_current_lga(); no LGA master table exists in the current public schema.';
comment on column public.hcd_indicator_targets.target_direction is
'Determines achievement interpretation: higher_is_better uses actual/target, lower_is_better uses target/actual with explicit zero handling, maintain compares actual against target tolerance defined by reporting policy.';
comment on column public.hcd_indicator_targets.target_status is
'Draft targets are editable by state admins; approved targets require approver identity and timestamp; retired targets remain for audit history.';

commit;

