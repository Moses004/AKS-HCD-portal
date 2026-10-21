-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

begin;

alter table public.hcd_reporting_indicators
  add column if not exists aggregation_method text not null default 'sum';
alter table public.hcd_reporting_indicators
  drop constraint if exists hcd_reporting_indicators_aggregation_method_check;
alter table public.hcd_reporting_indicators
  add constraint hcd_reporting_indicators_aggregation_method_check
  check (aggregation_method in ('sum','weighted_rate','average','latest','manual'));

update public.hcd_reporting_indicators
set aggregation_method = case
  when lower(coalesce(measurement_unit,'')) like '%percent%' then 'weighted_rate'
  when lower(coalesce(measurement_unit,'')) like '%rate%' then 'weighted_rate'
  else 'sum'
end,
updated_at = now();

update public.hcd_reporting_indicators
set aggregation_method = 'average', updated_at = now()
where indicator_code = 'VESB-04';

comment on column public.hcd_reporting_indicators.aggregation_method is
'How numeric activity measurements should be aggregated for target comparison. weighted_rate uses SUM(numerator)/SUM(denominator)*100 when available, otherwise average numeric values and the UI must disclose the fallback.';

drop view if exists public.hcd_lga_target_performance;
create view public.hcd_lga_target_performance
with (security_invoker = true)
as
with actuals as (
  select
    t.id as target_id,
    count(distinct a.id) as activity_count,
    count(am.id) as measurement_count,
    case
      when i.aggregation_method = 'weighted_rate'
           and sum(am.numerator) filter (where am.numerator is not null and am.denominator is not null) is not null
           and sum(am.denominator) filter (where am.numerator is not null and am.denominator is not null) > 0
        then
          (sum(am.numerator) filter (where am.numerator is not null and am.denominator is not null)
          / nullif(sum(am.denominator) filter (where am.numerator is not null and am.denominator is not null), 0)) * 100
      when i.aggregation_method = 'weighted_rate'
        then avg(am.value_numeric)
      when i.aggregation_method = 'average'
        then avg(am.value_numeric)
      when i.aggregation_method = 'latest'
        then (array_agg(am.value_numeric order by am.reporting_period_end desc nulls last, am.created_at desc)
              filter (where am.value_numeric is not null))[1]
      when i.aggregation_method = 'manual'
        then null
      else sum(am.value_numeric)
    end as actual_value,
    bool_or(am.numerator is not null and am.denominator is not null) as has_numerator_denominator
  from public.hcd_indicator_targets t
  join public.hcd_reporting_indicators i on i.indicator_code = t.indicator_code
  left join public.activities a
    on a.lga_id = t.lga_id
   and a.pillar = i.pillar
   and (a.status = 'PUBLISHED'
        or private.aks_hcd_current_role() = 'state_admin'
        or (private.aks_hcd_current_role() = 'lga_admin' and a.lga_id = private.aks_hcd_current_lga()))
  left join public.activity_measurements am
    on am.activity_id = a.id
   and am.indicator_code = t.indicator_code
   and am.reporting_period_start >= t.period_start
   and am.reporting_period_end <= t.period_end
  group by t.id, i.aggregation_method
)
select
  t.id as target_id,
  t.lga_id,
  t.lga_name,
  t.indicator_code,
  i.reporting_category,
  i.pillar,
  i.indicator_name,
  i.measurement_unit as catalogue_unit,
  i.aggregation_method,
  t.reporting_year,
  t.period_start,
  t.period_end,
  t.baseline_year,
  t.baseline_value,
  t.target_value,
  t.target_direction,
  t.measurement_unit as target_unit,
  t.target_status,
  t.target_notes,
  t.source_reference,
  t.approved_by,
  t.approved_at,
  coalesce(a.activity_count,0) as activity_count,
  coalesce(a.measurement_count,0) as measurement_count,
  a.actual_value,
  a.has_numerator_denominator,
  case
    when a.actual_value is null then null
    when t.target_direction = 'higher_is_better' and t.target_value > 0
      then (a.actual_value / t.target_value) * 100
    when t.target_direction = 'higher_is_better' and t.target_value = 0 then null
    when t.target_direction = 'lower_is_better' and a.actual_value > 0
      then (t.target_value / a.actual_value) * 100
    when t.target_direction = 'lower_is_better' and a.actual_value = 0
      then 100
    else null
  end as achievement_rate,
  case
    when a.actual_value is null then 'no_data'
    when t.target_direction = 'maintain' then 'compare_to_target'
    when t.target_direction = 'higher_is_better' and t.target_value = 0 then 'target_zero_review'
    else 'calculated'
  end as achievement_status
from public.hcd_indicator_targets t
join public.hcd_reporting_indicators i on i.indicator_code = t.indicator_code
left join actuals a on a.target_id = t.id;

revoke all on public.hcd_lga_target_performance from public, anon;
grant select on public.hcd_lga_target_performance to authenticated;

commit;

