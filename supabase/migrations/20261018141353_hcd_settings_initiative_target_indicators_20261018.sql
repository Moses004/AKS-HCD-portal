-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
-- HCD Settings is the display label; retain pillar='agriculture' for compatibility.
-- Preflight verified no HCDS-* measurements or targets exist.
UPDATE public.hcd_reporting_indicators
SET reporting_category='HCD Settings', pillar='agriculture', segment=NULL,
 indicator_name='Human capital development initiatives implemented in homes',
 definition='Number of distinct, verified human capital development initiatives delivered in household or home settings during the reporting period. Count an initiative only when implementation is evidenced; do not count individual activities within the same initiative as separate initiatives unless they have distinct approved initiative identifiers.',
 required_data_fields='["initiative_id","initiative_name","setting_type","household_or_home_coverage","target_population","initiatives_planned","implementation_status","implementation_start_date","implementation_end_date","beneficiaries_reached","reporting_period","evidence_reference"]'::jsonb,
 measurement_unit='initiatives',
 calculation_method='Count distinct verified initiative_id values implemented in household or home settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.',
 collection_method='Review LGA and programme implementation registers, home/household outreach records, beneficiary registers, and supporting evidence; validate unique initiative identifiers before aggregation.',
 recommended_source='Approved HCD initiative register, household outreach reports, beneficiary registers, monitoring reports, and verified evidence records',
 reporting_frequency='Quarterly',
 disaggregation_dimensions=ARRAY['LGA','reporting_period','programme_type','target_population','initiative_status'],
 evidence_required=ARRAY['approved initiative or activity record','implementation report or household outreach register','beneficiary or coverage record where applicable','verification evidence'],
 aggregation_method='sum', is_active=true, updated_at=now()
WHERE indicator_code='HCDS-01';

UPDATE public.hcd_reporting_indicators
SET reporting_category='HCD Settings', pillar='agriculture', segment=NULL,
 indicator_name='Human capital development initiatives implemented in communities',
 definition='Number of distinct, verified human capital development initiatives delivered in community settings during the reporting period, including community outreach, awareness, inclusion, wellbeing, and development initiatives within the approved HCD scope.',
 required_data_fields='["initiative_id","initiative_name","setting_type","community_name","target_population","initiatives_planned","implementation_status","implementation_start_date","implementation_end_date","beneficiaries_reached","reporting_period","evidence_reference"]'::jsonb,
 measurement_unit='initiatives',
 calculation_method='Count distinct verified initiative_id values implemented in community settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.',
 collection_method='Review community programme registers, outreach reports, attendance/beneficiary records, and monitoring evidence; validate unique initiative identifiers before aggregation.',
 recommended_source='Approved HCD initiative register, community outreach and engagement reports, beneficiary registers, monitoring reports, and verified evidence records',
 reporting_frequency='Quarterly',
 disaggregation_dimensions=ARRAY['LGA','reporting_period','community','programme_type','target_population','initiative_status'],
 evidence_required=ARRAY['approved initiative or activity record','community implementation or outreach report','attendance or beneficiary record where applicable','verification evidence'],
 aggregation_method='sum', is_active=true, updated_at=now()
WHERE indicator_code='HCDS-02';

UPDATE public.hcd_reporting_indicators
SET reporting_category='HCD Settings', pillar='agriculture', segment=NULL,
 indicator_name='Human capital development initiatives implemented in learning institutions',
 definition='Number of distinct, verified human capital development initiatives delivered through or within recognised learning institutions during the reporting period, including eligible early learning, school, technical/vocational, tertiary, and other approved learning settings.',
 required_data_fields='["initiative_id","initiative_name","setting_type","institution_name","institution_type","target_population","initiatives_planned","implementation_status","implementation_start_date","implementation_end_date","beneficiaries_reached","reporting_period","evidence_reference"]'::jsonb,
 measurement_unit='initiatives',
 calculation_method='Count distinct verified initiative_id values implemented in learning institutions during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.',
 collection_method='Review institution-level initiative registers, implementation reports, attendance/beneficiary records, and verification evidence with the relevant institution or supervising agency.',
 recommended_source='Approved HCD initiative register, institution returns, programme implementation reports, attendance and beneficiary records, and monitoring evidence',
 reporting_frequency='Quarterly',
 disaggregation_dimensions=ARRAY['LGA','reporting_period','institution_type','programme_type','target_population','initiative_status'],
 evidence_required=ARRAY['approved initiative or activity record','institution implementation report or confirmation','attendance or beneficiary record where applicable','verification evidence'],
 aggregation_method='sum', is_active=true, updated_at=now()
WHERE indicator_code='HCDS-03';

UPDATE public.hcd_reporting_indicators
SET reporting_category='HCD Settings', pillar='agriculture', segment=NULL,
 indicator_name='Human capital development initiatives implemented in workplaces',
 definition='Number of distinct, verified human capital development initiatives delivered in workplace or employment settings during the reporting period, including eligible workplace learning, skills development, occupational wellbeing, inclusion, and labour participation initiatives within the approved HCD scope.',
 required_data_fields='["initiative_id","initiative_name","setting_type","workplace_or_employer_name","workplace_type","target_population","initiatives_planned","implementation_status","implementation_start_date","implementation_end_date","beneficiaries_reached","reporting_period","evidence_reference"]'::jsonb,
 measurement_unit='initiatives',
 calculation_method='Count distinct verified initiative_id values implemented in workplace settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.',
 collection_method='Review employer/workplace programme registers, training and implementation records, participant registers, and monitoring evidence; validate unique initiative identifiers before aggregation.',
 recommended_source='Approved HCD initiative register, employer/workplace returns, workforce training reports, participant registers, and verified monitoring evidence',
 reporting_frequency='Quarterly',
 disaggregation_dimensions=ARRAY['LGA','reporting_period','workplace_type','programme_type','target_population','initiative_status'],
 evidence_required=ARRAY['approved initiative or activity record','workplace/employer implementation report or confirmation','participant or beneficiary record where applicable','verification evidence'],
 aggregation_method='sum', is_active=true, updated_at=now()
WHERE indicator_code='HCDS-04';

UPDATE public.hcd_reporting_indicators SET is_active=false, updated_at=now()
WHERE indicator_code='HCDS-05';

COMMENT ON TABLE public.hcd_reporting_indicators IS
'Canonical HCD indicator catalogue. HCD Settings retains legacy pillar code agriculture for historical compatibility; HCDS-01 through HCDS-04 count verified initiatives delivered in homes, communities, learning institutions, and workplaces. HCDS-05 is retired, not deleted.';
