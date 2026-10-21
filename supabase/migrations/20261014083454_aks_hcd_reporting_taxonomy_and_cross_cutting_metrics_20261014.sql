-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

BEGIN;

-- Preserve existing descriptions while adopting the requested terminology.
ALTER TABLE public.activities RENAME COLUMN sub_category TO project_description;

ALTER TABLE public.activities
  ADD COLUMN category text,
  ADD COLUMN pillar_segment text;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_pillar_check;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_pillar_check
  CHECK (pillar = ANY (ARRAY['education','health','vocational','agriculture','cross_cutting_enablers','values_ethics_social_behaviour']));

ALTER TABLE public.activities
  ADD CONSTRAINT activities_category_check
  CHECK (category IS NULL OR category IN ('values_ethics_social_behaviour','cross_cutting_enablers'));

ALTER TABLE public.activities
  ADD CONSTRAINT activities_pillar_segment_check
  CHECK (
    (pillar = 'cross_cutting_enablers' AND pillar_segment IN ('gender','governance','climate_change','demography_youth_investment'))
    OR (pillar <> 'cross_cutting_enablers' AND pillar_segment IS NULL)
  );

COMMENT ON COLUMN public.activities.category IS
  'Reporting category; values_ethics_social_behaviour is the new Values/Ethics/Social behaviour category.';
COMMENT ON COLUMN public.activities.pillar IS
  'Reporting pillar: existing Education, Health, Vocational Development, Agriculture, plus cross_cutting_enablers and values_ethics_social_behaviour.';
COMMENT ON COLUMN public.activities.pillar_segment IS
  'Segment within CROSS CUTTING ENABLERS: gender, governance, climate_change, or demography_youth_investment.';
COMMENT ON COLUMN public.activities.project_description IS
  'Project description; replaces the former sub_category field without discarding existing values.';

CREATE TABLE IF NOT EXISTS public.hcd_reporting_indicators (
  indicator_code text PRIMARY KEY,
  reporting_category text NOT NULL,
  pillar text NOT NULL,
  segment text,
  indicator_name text NOT NULL,
  definition text NOT NULL,
  required_data_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  measurement_unit text NOT NULL,
  calculation_method text NOT NULL,
  collection_method text NOT NULL,
  recommended_source text NOT NULL,
  reporting_frequency text NOT NULL DEFAULT 'Quarterly',
  disaggregation_dimensions text[] NOT NULL DEFAULT ARRAY['LGA','sex','age_group']::text[],
  evidence_required text[] NOT NULL DEFAULT ARRAY['activity report','supporting evidence']::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hcd_reporting_indicators_pillar_check CHECK (
    pillar IN ('education','health','vocational','agriculture','cross_cutting_enablers','values_ethics_social_behaviour')
  ),
  CONSTRAINT hcd_reporting_indicators_segment_check CHECK (
    (pillar = 'cross_cutting_enablers' AND segment IN ('gender','governance','climate_change','demography_youth_investment'))
    OR (pillar <> 'cross_cutting_enablers' AND segment IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.activity_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  indicator_code text NOT NULL REFERENCES public.hcd_reporting_indicators(indicator_code) ON UPDATE CASCADE,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  value_numeric numeric,
  value_text text,
  numerator numeric,
  denominator numeric,
  disaggregation jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_source text,
  evidence_reference text,
  notes text,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_measurements_period_check CHECK (reporting_period_end >= reporting_period_start),
  CONSTRAINT activity_measurements_value_present CHECK (
    value_numeric IS NOT NULL OR value_text IS NOT NULL OR (numerator IS NOT NULL AND denominator IS NOT NULL)
  ),
  CONSTRAINT activity_measurements_denominator_check CHECK (denominator IS NULL OR denominator >= 0),
  CONSTRAINT activity_measurements_unique_period UNIQUE (activity_id, indicator_code, reporting_period_start, reporting_period_end, disaggregation)
);

CREATE INDEX IF NOT EXISTS idx_hcd_reporting_indicators_category_pillar
  ON public.hcd_reporting_indicators(reporting_category, pillar, segment);
CREATE INDEX IF NOT EXISTS idx_activity_measurements_activity_period
  ON public.activity_measurements(activity_id, reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_activity_measurements_indicator_period
  ON public.activity_measurements(indicator_code, reporting_period_start, reporting_period_end);

INSERT INTO public.hcd_reporting_indicators
(indicator_code, reporting_category, pillar, segment, indicator_name, definition, required_data_fields, measurement_unit, calculation_method, collection_method, recommended_source, reporting_frequency, disaggregation_dimensions, evidence_required)
VALUES
('VESB-01','Values/Ethics/Social behaviour','values_ethics_social_behaviour',NULL,'Ethics and civic-values learning sessions delivered','Number of structured ethics, integrity, civic responsibility or values-learning sessions delivered during the reporting period.','["activity_id","LGA","community","session_date","session_type","participants_total","facilitator","evidence_reference"]'::jsonb,'sessions','Count verified sessions delivered in the reporting period.','Activity register and session attendance sheets','Implementing MDA/agency activity register','Quarterly',ARRAY['LGA','community','session_type','sex','age_group'],ARRAY['session report','attendance sheet','dated photographs or equivalent evidence']),
('VESB-02','Values/Ethics/Social behaviour','values_ethics_social_behaviour',NULL,'People reached through values and social-behaviour interventions','Unique participants reached by verified ethics, civic-values or positive social-behaviour interventions.','["activity_id","LGA","intervention_type","participants_total","participants_male","participants_female","participants_youth","period","source"]'::jsonb,'people','Count unique participants; document deduplication method where activities overlap.','Attendance/beneficiary register and post-activity report','Implementing MDA/agency beneficiary register','Quarterly',ARRAY['LGA','sex','age_group','disability_status','intervention_type'],ARRAY['beneficiary register','activity report']),
('VESB-03','Values/Ethics/Social behaviour','values_ethics_social_behaviour',NULL,'Ethics-related complaints resolved','Percentage of formally recorded ethics/social-behaviour complaints resolved within the approved service standard.','["complaints_received","complaints_resolved","resolution_standard_days","period","complaint_register_reference"]'::jsonb,'percent','complaints_resolved / complaints_received * 100; report counts as well; if no complaints were received, report N/A, not 0%.','Review of complaint/grievance register and resolution records','Responsible MDA grievance/ethics desk','Quarterly',ARRAY['LGA','complaint_type','resolution_status'],ARRAY['aggregated complaint register','resolution evidence']),
('VESB-04','Values/Ethics/Social behaviour','values_ethics_social_behaviour',NULL,'Community perception of ethical and positive social behaviour','Share of valid respondents reporting improved awareness or practice against the defined survey questions.','["survey_sample_size","valid_responses","questionnaire_version","positive_responses","survey_period","methodology"]'::jsonb,'percent','positive_responses / valid_responses * 100; publish sample size and survey method.','Structured beneficiary/community survey or pre/post assessment','Approved MDA survey or monitoring exercise','Annual',ARRAY['LGA','sex','age_group','disability_status','questionnaire_item'],ARRAY['survey instrument','aggregated results','methodology note']),
('CC-GEN-01','Cross-cutting Enablers','cross_cutting_enablers','gender','Female share of direct beneficiaries','Proportion of direct beneficiaries who are female, using the validated beneficiary register.','["beneficiaries_total","beneficiaries_female","reporting_period","beneficiary_register_reference"]'::jsonb,'percent','beneficiaries_female / beneficiaries_total * 100; if total is zero, report N/A.','Beneficiary register review','Project beneficiary register / MDA monitoring return','Quarterly',ARRAY['LGA','age_group','disability_status','intervention_type'],ARRAY['aggregated beneficiary register']),
('CC-GEN-02','Cross-cutting Enablers','cross_cutting_enablers','gender','Activities with documented gender analysis','Number and share of reported activities with documented gender barriers, mitigation actions and sex-disaggregated monitoring.','["activities_reported","activities_with_gender_analysis","analysis_reference","mitigation_actions"]'::jsonb,'percent','activities_with_gender_analysis / activities_reported * 100; also report numerator and denominator.','Project design and monitoring-document review','Approved project document and M&E report','Quarterly',ARRAY['LGA','pillar','implementing_mda'],ARRAY['gender analysis','project/M&E document']),
('CC-GEN-03','Cross-cutting Enablers','cross_cutting_enablers','gender','Gender-targeted actions completed','Number of planned gender-responsive actions completed during the period, against the approved workplan.','["planned_actions","completed_actions","action_description","completion_date","evidence_reference"]'::jsonb,'actions','Count completed actions and report planned actions alongside completion rate.','Workplan tracking and evidence verification','Approved workplan / implementation report','Quarterly',ARRAY['LGA','action_type','target_group'],ARRAY['approved workplan','completion evidence']),
('CC-GOV-01','Cross-cutting Enablers','cross_cutting_enablers','governance','Community engagement and feedback sessions held','Number of documented community engagement sessions where feedback was captured and assigned for follow-up.','["sessions_held","attendance_total","feedback_items_logged","meeting_date","minutes_reference"]'::jsonb,'sessions','Count sessions with dated minutes and feedback/action log.','Meeting minutes and feedback/action register','Implementing MDA/community liaison records','Quarterly',ARRAY['LGA','community','engagement_type'],ARRAY['meeting minutes','attendance record','feedback/action log']),
('CC-GOV-02','Cross-cutting Enablers','cross_cutting_enablers','governance','Feedback and grievances resolved','Percentage of logged feedback/grievances resolved or formally closed during the period.','["feedback_received","feedback_resolved","open_cases","period","register_reference"]'::jsonb,'percent','feedback_resolved / feedback_received * 100; disclose open cases and use N/A when none were received.','Grievance/feedback register review','MDA complaints desk / project grievance mechanism','Quarterly',ARRAY['LGA','case_type','status'],ARRAY['aggregated case register','closure evidence']),
('CC-GOV-03','Cross-cutting Enablers','cross_cutting_enablers','governance','Reporting and accountability compliance','Share of due reports submitted complete and on time against the agreed reporting calendar.','["reports_due","reports_submitted_on_time","reports_complete","reporting_calendar_reference"]'::jsonb,'percent','reports_submitted_on_time / reports_due * 100; report completeness separately.','Reporting-calendar and submission-log review','MDA reporting unit / programme coordination unit','Quarterly',ARRAY['LGA','MDA','report_type'],ARRAY['reporting calendar','submission log']),
('CC-CLI-01','Cross-cutting Enablers','cross_cutting_enablers','climate_change','Projects screened for climate and environmental risk','Share of applicable projects with documented climate/environmental risk screening and mitigation actions.','["projects_applicable","projects_screened","risk_screening_date","risk_level","mitigation_plan_reference"]'::jsonb,'percent','projects_screened / projects_applicable * 100; record risk level and mitigation status.','Project appraisal and safeguards-document review','Project design, safeguards or environmental screening records','Quarterly',ARRAY['LGA','pillar','risk_level','project_type'],ARRAY['screening checklist','mitigation plan']),
('CC-CLI-02','Cross-cutting Enablers','cross_cutting_enablers','climate_change','Climate-resilient actions implemented','Number of approved climate adaptation/resilience or environmental mitigation actions completed and verified.','["actions_planned","actions_completed","action_type","location","verification_date","evidence_reference"]'::jsonb,'actions','Count verified completed actions and report planned actions and completion rate.','Workplan review and site verification','MDA project records / environmental safeguards reports','Quarterly',ARRAY['LGA','action_type','ecosystem_or_sector'],ARRAY['workplan','site verification','dated evidence']),
('CC-CLI-03','Cross-cutting Enablers','cross_cutting_enablers','climate_change','Environmental safeguards compliance','Share of applicable projects meeting documented environmental safeguards requirements.','["projects_applicable","projects_compliant","inspection_date","noncompliance_actions","inspection_reference"]'::jsonb,'percent','projects_compliant / projects_applicable * 100; list outstanding corrective actions.','Safeguards checklist and inspection review','Environmental/safeguards monitoring records','Quarterly',ARRAY['LGA','project_type','compliance_status'],ARRAY['inspection checklist','corrective-action log']),
('CC-DEM-01','Cross-cutting Enablers','cross_cutting_enablers','demography_youth_investment','Youth share of direct beneficiaries','Proportion of direct beneficiaries meeting the programme-defined youth age band; record the age-band definition in each reporting return.','["beneficiaries_total","youth_beneficiaries","youth_age_band_definition","reporting_period","beneficiary_register_reference"]'::jsonb,'percent','youth_beneficiaries / beneficiaries_total * 100; if total is zero, report N/A.','Age-disaggregated beneficiary register review','Project beneficiary register / MDA monitoring return','Quarterly',ARRAY['LGA','sex','age_band','disability_status','intervention_type'],ARRAY['aggregated beneficiary register','age-band definition']),
('CC-DEM-02','Cross-cutting Enablers','cross_cutting_enablers','demography_youth_investment','Youth skills, employment or enterprise outcomes','Number of youth participants who complete a supported intervention and achieve the stated skills, employment or enterprise outcome.','["youth_enrolled","youth_completed","youth_with_verified_outcome","outcome_type","follow_up_period","verification_source"]'::jsonb,'people','Report enrolled, completed and verified-outcome counts separately; outcome rate = verified outcomes / completed participants.','Training completion records and follow-up verification','Implementing MDA / training provider / follow-up survey','Quarterly',ARRAY['LGA','sex','age_band','outcome_type','disability_status'],ARRAY['completion register','outcome verification']),
('CC-DEM-03','Cross-cutting Enablers','cross_cutting_enablers','demography_youth_investment','Youth investment expenditure and execution','Approved, released and actual expenditure for youth-targeted components, with budget execution rate.','["approved_budget_ngn","funds_released_ngn","actual_expenditure_ngn","youth_targeted_component","financial_period","ledger_reference"]'::jsonb,'NGN and percent','Budget execution = actual_expenditure_ngn / approved_budget_ngn * 100; report approved, released and actual values separately.','Financial ledger and project expenditure review','MDA finance unit / Accountant-General-approved records','Quarterly',ARRAY['LGA','MDA','investment_type','financial_year'],ARRAY['approved budget extract','expenditure ledger','supporting financial records'])
ON CONFLICT (indicator_code) DO UPDATE SET
 reporting_category=EXCLUDED.reporting_category,
 pillar=EXCLUDED.pillar,
 segment=EXCLUDED.segment,
 indicator_name=EXCLUDED.indicator_name,
 definition=EXCLUDED.definition,
 required_data_fields=EXCLUDED.required_data_fields,
 measurement_unit=EXCLUDED.measurement_unit,
 calculation_method=EXCLUDED.calculation_method,
 collection_method=EXCLUDED.collection_method,
 recommended_source=EXCLUDED.recommended_source,
 reporting_frequency=EXCLUDED.reporting_frequency,
 disaggregation_dimensions=EXCLUDED.disaggregation_dimensions,
 evidence_required=EXCLUDED.evidence_required,
 is_active=true,
 updated_at=now();

ALTER TABLE public.hcd_reporting_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hcd_reporting_indicators_read_all ON public.hcd_reporting_indicators;
CREATE POLICY hcd_reporting_indicators_read_all ON public.hcd_reporting_indicators
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS activity_measurements_select_public_published ON public.activity_measurements;
CREATE POLICY activity_measurements_select_public_published ON public.activity_measurements
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.activities a WHERE a.id = activity_id AND a.status = 'PUBLISHED')
  );

DROP POLICY IF EXISTS activity_measurements_select_scoped ON public.activity_measurements;
CREATE POLICY activity_measurements_select_scoped ON public.activity_measurements
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND (a.status = 'PUBLISHED'
          OR private.aks_hcd_current_role() = 'state_admin'
          OR (private.aks_hcd_current_role() = 'lga_admin' AND a.lga_id = private.aks_hcd_current_lga()))
    )
  );

DROP POLICY IF EXISTS activity_measurements_insert_scoped ON public.activity_measurements;
CREATE POLICY activity_measurements_insert_scoped ON public.activity_measurements
  FOR INSERT TO authenticated WITH CHECK (
    entered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND (private.aks_hcd_current_role() = 'state_admin'
          OR (private.aks_hcd_current_role() = 'lga_admin'
            AND a.lga_id = private.aks_hcd_current_lga()
            AND a.status IN ('DRAFT','REJECTED_DRAFT','PENDING_APPROVAL')))
    )
  );

DROP POLICY IF EXISTS activity_measurements_update_scoped ON public.activity_measurements;
CREATE POLICY activity_measurements_update_scoped ON public.activity_measurements
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND (private.aks_hcd_current_role() = 'state_admin'
          OR (private.aks_hcd_current_role() = 'lga_admin'
            AND a.lga_id = private.aks_hcd_current_lga()
            AND a.status IN ('DRAFT','REJECTED_DRAFT','PENDING_APPROVAL')))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND (private.aks_hcd_current_role() = 'state_admin'
          OR (private.aks_hcd_current_role() = 'lga_admin'
            AND a.lga_id = private.aks_hcd_current_lga()
            AND a.status IN ('DRAFT','REJECTED_DRAFT','PENDING_APPROVAL')))
    )
  );

DROP POLICY IF EXISTS activity_measurements_delete_scoped ON public.activity_measurements;
CREATE POLICY activity_measurements_delete_scoped ON public.activity_measurements
  FOR DELETE TO authenticated USING (
    private.aks_hcd_current_role() = 'state_admin'
    OR EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND private.aks_hcd_current_role() = 'lga_admin'
        AND a.lga_id = private.aks_hcd_current_lga()
        AND a.status IN ('DRAFT','REJECTED_DRAFT')
    )
  );

REVOKE ALL ON TABLE public.hcd_reporting_indicators, public.activity_measurements FROM PUBLIC;
REVOKE ALL ON TABLE public.hcd_reporting_indicators, public.activity_measurements FROM anon, authenticated;
GRANT SELECT ON TABLE public.hcd_reporting_indicators TO anon, authenticated;
GRANT SELECT ON TABLE public.activity_measurements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.activity_measurements TO authenticated;

COMMIT;

