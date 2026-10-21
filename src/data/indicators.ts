import { HCDReportingIndicator } from '../types';

/**
 * Fallback and baseline active indicator catalogue for Akwa Ibom State HCD.
 * Live source of truth is public.hcd_reporting_indicators in Supabase.
 */
export const DEFAULT_HCD_INDICATORS: HCDReportingIndicator[] = [
  {
    "indicator_code": "CC-CLI-01",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "climate_change",
    "indicator_name": "Projects screened for climate and environmental risk",
    "definition": "Share of applicable projects with documented climate/environmental risk screening and mitigation actions.",
    "required_data_fields": [
      "projects_applicable",
      "projects_screened",
      "risk_screening_date",
      "risk_level",
      "mitigation_plan_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "projects_screened / projects_applicable * 100; record risk level and mitigation status.",
    "collection_method": "Project appraisal and safeguards-document review",
    "recommended_source": "Project design, safeguards or environmental screening records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "pillar",
      "risk_level",
      "project_type"
    ],
    "evidence_required": [
      "screening checklist",
      "mitigation plan"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-CLI-02",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "climate_change",
    "indicator_name": "Climate-resilient actions implemented",
    "definition": "Number of approved climate adaptation/resilience or environmental mitigation actions completed and verified.",
    "required_data_fields": [
      "actions_planned",
      "actions_completed",
      "action_type",
      "location",
      "verification_date",
      "evidence_reference"
    ],
    "measurement_unit": "actions",
    "calculation_method": "Count verified completed actions and report planned actions and completion rate.",
    "collection_method": "Workplan review and site verification",
    "recommended_source": "MDA project records / environmental safeguards reports",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "action_type",
      "ecosystem_or_sector"
    ],
    "evidence_required": [
      "workplan",
      "site verification",
      "dated evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-CLI-03",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "climate_change",
    "indicator_name": "Environmental safeguards compliance",
    "definition": "Share of applicable projects meeting documented environmental safeguards requirements.",
    "required_data_fields": [
      "projects_applicable",
      "projects_compliant",
      "inspection_date",
      "noncompliance_actions",
      "inspection_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "projects_compliant / projects_applicable * 100; list outstanding corrective actions.",
    "collection_method": "Safeguards checklist and inspection review",
    "recommended_source": "Environmental/safeguards monitoring records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "project_type",
      "compliance_status"
    ],
    "evidence_required": [
      "inspection checklist",
      "corrective-action log"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-DEM-01",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "demography_youth_investment",
    "indicator_name": "Youth share of direct beneficiaries",
    "definition": "Proportion of direct beneficiaries meeting the programme-defined youth age band; record the age-band definition in each reporting return.",
    "required_data_fields": [
      "beneficiaries_total",
      "youth_beneficiaries",
      "youth_age_band_definition",
      "reporting_period",
      "beneficiary_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "youth_beneficiaries / beneficiaries_total * 100; if total is zero, report N/A.",
    "collection_method": "Age-disaggregated beneficiary register review",
    "recommended_source": "Project beneficiary register / MDA monitoring return",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_band",
      "disability_status",
      "intervention_type"
    ],
    "evidence_required": [
      "aggregated beneficiary register",
      "age-band definition"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-DEM-02",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "demography_youth_investment",
    "indicator_name": "Youth skills, employment or enterprise outcomes",
    "definition": "Number of youth participants who complete a supported intervention and achieve the stated skills, employment or enterprise outcome.",
    "required_data_fields": [
      "youth_enrolled",
      "youth_completed",
      "youth_with_verified_outcome",
      "outcome_type",
      "follow_up_period",
      "verification_source"
    ],
    "measurement_unit": "people",
    "calculation_method": "Report enrolled, completed and verified-outcome counts separately; outcome rate = verified outcomes / completed participants.",
    "collection_method": "Training completion records and follow-up verification",
    "recommended_source": "Implementing MDA / training provider / follow-up survey",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_band",
      "outcome_type",
      "disability_status"
    ],
    "evidence_required": [
      "completion register",
      "outcome verification"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-DEM-03",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "demography_youth_investment",
    "indicator_name": "Youth investment expenditure and execution",
    "definition": "Approved, released and actual expenditure for youth-targeted components, with budget execution rate.",
    "required_data_fields": [
      "approved_budget_ngn",
      "funds_released_ngn",
      "actual_expenditure_ngn",
      "youth_targeted_component",
      "financial_period",
      "ledger_reference"
    ],
    "measurement_unit": "NGN and percent",
    "calculation_method": "Budget execution = actual_expenditure_ngn / approved_budget_ngn * 100; report approved, released and actual values separately.",
    "collection_method": "Financial ledger and project expenditure review",
    "recommended_source": "MDA finance unit / Accountant-General-approved records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "MDA",
      "investment_type",
      "financial_year"
    ],
    "evidence_required": [
      "approved budget extract",
      "expenditure ledger",
      "supporting financial records"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GEN-01",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "gender",
    "indicator_name": "Female share of direct beneficiaries",
    "definition": "Proportion of direct beneficiaries who are female, using the validated beneficiary register.",
    "required_data_fields": [
      "beneficiaries_total",
      "beneficiaries_female",
      "reporting_period",
      "beneficiary_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "beneficiaries_female / beneficiaries_total * 100; if total is zero, report N/A.",
    "collection_method": "Beneficiary register review",
    "recommended_source": "Project beneficiary register / MDA monitoring return",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "age_group",
      "disability_status",
      "intervention_type"
    ],
    "evidence_required": [
      "aggregated beneficiary register"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GEN-02",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "gender",
    "indicator_name": "Activities with documented gender analysis",
    "definition": "Number and share of reported activities with documented gender barriers, mitigation actions and sex-disaggregated monitoring.",
    "required_data_fields": [
      "activities_reported",
      "activities_with_gender_analysis",
      "analysis_reference",
      "mitigation_actions"
    ],
    "measurement_unit": "percent",
    "calculation_method": "activities_with_gender_analysis / activities_reported * 100; also report numerator and denominator.",
    "collection_method": "Project design and monitoring-document review",
    "recommended_source": "Approved project document and M&E report",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "pillar",
      "implementing_mda"
    ],
    "evidence_required": [
      "gender analysis",
      "project/M&E document"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GEN-03",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "gender",
    "indicator_name": "Gender-targeted actions completed",
    "definition": "Number of planned gender-responsive actions completed during the period, against the approved workplan.",
    "required_data_fields": [
      "planned_actions",
      "completed_actions",
      "action_description",
      "completion_date",
      "evidence_reference"
    ],
    "measurement_unit": "actions",
    "calculation_method": "Count completed actions and report planned actions alongside completion rate.",
    "collection_method": "Workplan tracking and evidence verification",
    "recommended_source": "Approved workplan / implementation report",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "action_type",
      "target_group"
    ],
    "evidence_required": [
      "approved workplan",
      "completion evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GOV-01",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "governance",
    "indicator_name": "Community engagement and feedback sessions held",
    "definition": "Number of documented community engagement sessions where feedback was captured and assigned for follow-up.",
    "required_data_fields": [
      "sessions_held",
      "attendance_total",
      "feedback_items_logged",
      "meeting_date",
      "minutes_reference"
    ],
    "measurement_unit": "sessions",
    "calculation_method": "Count sessions with dated minutes and feedback/action log.",
    "collection_method": "Meeting minutes and feedback/action register",
    "recommended_source": "Implementing MDA/community liaison records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "community",
      "engagement_type"
    ],
    "evidence_required": [
      "meeting minutes",
      "attendance record",
      "feedback/action log"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GOV-02",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "governance",
    "indicator_name": "Feedback and grievances resolved",
    "definition": "Percentage of logged feedback/grievances resolved or formally closed during the period.",
    "required_data_fields": [
      "feedback_received",
      "feedback_resolved",
      "open_cases",
      "period",
      "register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "feedback_resolved / feedback_received * 100; disclose open cases and use N/A when none were received.",
    "collection_method": "Grievance/feedback register review",
    "recommended_source": "MDA complaints desk / project grievance mechanism",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "case_type",
      "status"
    ],
    "evidence_required": [
      "aggregated case register",
      "closure evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "CC-GOV-03",
    "reporting_category": "Cross-cutting Enablers",
    "pillar": "cross_cutting_enablers",
    "segment": "governance",
    "indicator_name": "Reporting and accountability compliance",
    "definition": "Share of due reports submitted complete and on time against the agreed reporting calendar.",
    "required_data_fields": [
      "reports_due",
      "reports_submitted_on_time",
      "reports_complete",
      "reporting_calendar_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "reports_submitted_on_time / reports_due * 100; report completeness separately.",
    "collection_method": "Reporting-calendar and submission-log review",
    "recommended_source": "MDA reporting unit / programme coordination unit",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "MDA",
      "report_type"
    ],
    "evidence_required": [
      "reporting calendar",
      "submission log"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "EDU-01",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "School-age children enrolled in education",
    "definition": "Number of school-age children enrolled in a recognized education programme during the reporting period.",
    "required_data_fields": [
      "learners_enrolled",
      "school_id",
      "school_type",
      "academic_year",
      "enrolment_register_reference"
    ],
    "measurement_unit": "learners",
    "calculation_method": "Count unique enrolled learners for the reporting period; avoid double-counting transfers.",
    "collection_method": "School register and enrolment return review",
    "recommended_source": "School/education authority enrolment registers",
    "reporting_frequency": "Termly",
    "disaggregation_dimensions": [
      "LGA",
      "community",
      "sex",
      "age_group",
      "school_type",
      "disability_status"
    ],
    "evidence_required": [
      "enrolment register",
      "school return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "EDU-02",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "Learner attendance rate",
    "definition": "Percentage of scheduled learner-days attended during the reporting period.",
    "required_data_fields": [
      "learner_days_present",
      "learner_days_expected",
      "period",
      "attendance_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "learner_days_present / learner_days_expected * 100; report N/A when expected learner-days are zero.",
    "collection_method": "Attendance register review",
    "recommended_source": "School attendance registers and education monitoring returns",
    "reporting_frequency": "Termly",
    "disaggregation_dimensions": [
      "LGA",
      "school",
      "sex",
      "grade",
      "school_type"
    ],
    "evidence_required": [
      "attendance register",
      "monitoring return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "EDU-03",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "Learners completing the academic cycle",
    "definition": "Number and proportion of enrolled learners who complete the defined academic cycle.",
    "required_data_fields": [
      "learners_at_start",
      "learners_completed",
      "academic_cycle",
      "completion_register_reference"
    ],
    "measurement_unit": "learners and percent",
    "calculation_method": "Report completed learners and completion rate = learners_completed / learners_at_start * 100; explain transfers and exclusions.",
    "collection_method": "School progression and completion record review",
    "recommended_source": "School registers and education management information system",
    "reporting_frequency": "Annually",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "grade",
      "school_type",
      "disability_status"
    ],
    "evidence_required": [
      "completion register",
      "annual school return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "EDU-04",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "Learners meeting defined literacy and numeracy proficiency",
    "definition": "Number and share of assessed learners meeting the approved literacy and numeracy proficiency standard.",
    "required_data_fields": [
      "learners_assessed",
      "learners_meeting_standard",
      "assessment_tool",
      "grade",
      "assessment_period"
    ],
    "measurement_unit": "learners and percent",
    "calculation_method": "Report learners meeting standard / learners assessed * 100 separately for literacy and numeracy; include the assessment standard.",
    "collection_method": "Assessment result aggregation and verification",
    "recommended_source": "Approved learning assessment records",
    "reporting_frequency": "Termly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "grade",
      "subject",
      "school_type"
    ],
    "evidence_required": [
      "assessment tool",
      "aggregated assessment results"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "EDU-05",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "Teachers available against approved staffing requirement",
    "definition": "Percentage of approved teacher posts filled by teachers available for service.",
    "required_data_fields": [
      "approved_teacher_posts",
      "teachers_available",
      "school_id",
      "staff_return_period"
    ],
    "measurement_unit": "percent",
    "calculation_method": "teachers_available / approved_teacher_posts * 100; report counts and vacancy totals.",
    "collection_method": "Staff return and school verification",
    "recommended_source": "School staffing returns and education personnel records",
    "reporting_frequency": "Termly",
    "disaggregation_dimensions": [
      "LGA",
      "community",
      "school_type",
      "level"
    ],
    "evidence_required": [
      "staffing return",
      "verification record"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "EDU-06",
    "reporting_category": "Education",
    "pillar": "education",
    "segment": null,
    "indicator_name": "Schools meeting minimum learning-environment standards",
    "definition": "Number and share of assessed schools meeting the applicable minimum infrastructure, WASH, accessibility and learning-resource standards.",
    "required_data_fields": [
      "schools_assessed",
      "schools_meeting_standard",
      "standard_version",
      "assessment_date",
      "assessment_reference"
    ],
    "measurement_unit": "schools and percent",
    "calculation_method": "schools_meeting_standard / schools_assessed * 100; document each standard and any critical gaps.",
    "collection_method": "School facility checklist and site verification",
    "recommended_source": "School infrastructure assessments and inspection records",
    "reporting_frequency": "Annually",
    "disaggregation_dimensions": [
      "LGA",
      "community",
      "school_type",
      "education_level"
    ],
    "evidence_required": [
      "facility checklist",
      "dated verification evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-01",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Antenatal care coverage (four or more visits)",
    "definition": "Percentage of women with a live birth during the reporting period who attended at least four antenatal care visits, where this indicator is used in the approved reporting framework.",
    "required_data_fields": [
      "women_with_live_births",
      "women_with_four_or_more_anc_visits",
      "reporting_period",
      "facility_or_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "women_with_four_or_more_anc_visits / women_with_live_births * 100; state the denominator definition and source.",
    "collection_method": "Maternal health register aggregation",
    "recommended_source": "Health facility ANC and delivery registers / approved HMIS return",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "age_group",
      "facility_type"
    ],
    "evidence_required": [
      "aggregated ANC register",
      "HMIS return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-02",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Births attended by skilled health personnel",
    "definition": "Percentage of recorded births attended by qualified skilled health personnel during the reporting period.",
    "required_data_fields": [
      "total_recorded_births",
      "births_attended_by_skilled_personnel",
      "reporting_period",
      "facility_or_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "births_attended_by_skilled_personnel / total_recorded_births * 100; disclose facility and community data coverage.",
    "collection_method": "Delivery register review and HMIS aggregation",
    "recommended_source": "Health facility delivery registers and approved HMIS returns",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "maternal_age_group",
      "facility_type"
    ],
    "evidence_required": [
      "delivery register",
      "HMIS return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-03",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Penta 3 immunization coverage",
    "definition": "Coverage of eligible infants receiving the third dose of pentavalent vaccine during the reporting period.",
    "required_data_fields": [
      "eligible_infants_or_target_population",
      "infants_receiving_penta3",
      "reporting_period",
      "immunization_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "infants_receiving_penta3 / eligible_infants_or_target_population * 100; document the approved target-population source.",
    "collection_method": "Immunization register and monthly return review",
    "recommended_source": "PHC immunization registers and approved immunization/HMIS reports",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "sex",
      "settlement_type"
    ],
    "evidence_required": [
      "immunization register",
      "monthly return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-04",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Postnatal care coverage within the approved time window",
    "definition": "Percentage of eligible mothers/newborns receiving documented postnatal care within the nationally or state-approved time window.",
    "required_data_fields": [
      "eligible_mothers_or_newborns",
      "mothers_or_newborns_receiving_pnc",
      "approved_time_window",
      "reporting_period"
    ],
    "measurement_unit": "percent",
    "calculation_method": "report recipients / eligible population * 100; report mothers and newborns separately when the source allows.",
    "collection_method": "Postnatal register and HMIS return review",
    "recommended_source": "Facility postnatal registers and community health worker records",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "mother_or_newborn",
      "age_group",
      "facility_type"
    ],
    "evidence_required": [
      "postnatal register",
      "HMIS return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-05",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Primary healthcare service utilization",
    "definition": "Number of outpatient consultations or visits recorded at supported primary healthcare facilities during the reporting period.",
    "required_data_fields": [
      "outpatient_visits",
      "facility_id",
      "reporting_period",
      "service_register_reference"
    ],
    "measurement_unit": "visits",
    "calculation_method": "Count recorded visits; distinguish visits from unique patients and disclose reporting-facility coverage.",
    "collection_method": "Facility register aggregation and completeness checks",
    "recommended_source": "PHC outpatient registers and approved HMIS returns",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "sex",
      "age_group",
      "service_type"
    ],
    "evidence_required": [
      "outpatient register",
      "monthly HMIS return"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "HLT-06",
    "reporting_category": "Health",
    "pillar": "health",
    "segment": null,
    "indicator_name": "Essential medicine availability at primary healthcare facilities",
    "definition": "Percentage of assessed tracer essential medicines available on the day of facility assessment.",
    "required_data_fields": [
      "tracer_medicines_assessed",
      "tracer_medicines_available",
      "assessment_date",
      "facility_id",
      "tracer_list_version"
    ],
    "measurement_unit": "percent",
    "calculation_method": "tracer_medicines_available / tracer_medicines_assessed * 100; record the tracer list and stock-out status.",
    "collection_method": "Physical stock check and stock-card review",
    "recommended_source": "Facility pharmacy stock cards and supervision checklist",
    "reporting_frequency": "Monthly",
    "disaggregation_dimensions": [
      "LGA",
      "facility",
      "medicine_class",
      "facility_type"
    ],
    "evidence_required": [
      "stock checklist",
      "stock cards"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-01",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Participants enrolled in approved skills-development programmes",
    "definition": "Number of participants enrolled in approved vocational, technical, digital or employability training during the reporting period.",
    "required_data_fields": [
      "participants_enrolled",
      "programme_id",
      "trade_or_skill_area",
      "training_provider",
      "enrolment_period",
      "register_reference"
    ],
    "measurement_unit": "people",
    "calculation_method": "Count unique enrolments and document the rule used for participants enrolled in multiple programmes.",
    "collection_method": "Training-provider enrolment register review",
    "recommended_source": "Approved training provider and implementing MDA records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "skill_area",
      "provider",
      "disability_status"
    ],
    "evidence_required": [
      "enrolment register",
      "programme approval/reference"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-02",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Participants completing skills training",
    "definition": "Number and share of enrolled participants who complete the defined training programme.",
    "required_data_fields": [
      "participants_enrolled",
      "participants_completed",
      "programme_id",
      "completion_period",
      "completion_register_reference"
    ],
    "measurement_unit": "people and percent",
    "calculation_method": "Report completed participants and completion rate = participants_completed / participants_enrolled * 100; if no enrolments, report N/A.",
    "collection_method": "Training completion record verification",
    "recommended_source": "Training provider completion registers",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "skill_area",
      "provider"
    ],
    "evidence_required": [
      "completion register",
      "training report"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-03",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Participants achieving competency certification",
    "definition": "Number and share of programme completers who pass an approved competency assessment or receive a recognized certification.",
    "required_data_fields": [
      "participants_completed",
      "participants_certified",
      "certification_body",
      "assessment_standard",
      "certification_period"
    ],
    "measurement_unit": "people and percent",
    "calculation_method": "Report certified participants and rate = participants_certified / participants_completed * 100; identify the certification standard.",
    "collection_method": "Certificate register and awarding-body verification",
    "recommended_source": "Accredited training provider and certification body records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "skill_area",
      "certification_body"
    ],
    "evidence_required": [
      "certificate register",
      "assessment result or verification"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-04",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Graduates in employment or self-employment after training",
    "definition": "Number and share of verified programme graduates in paid employment, self-employment or an operating enterprise at the defined follow-up point.",
    "required_data_fields": [
      "graduates_traced",
      "graduates_employed",
      "graduates_self_employed",
      "follow_up_months",
      "verification_method"
    ],
    "measurement_unit": "people and percent",
    "calculation_method": "Report employment and self-employment separately; denominator is graduates successfully traced or the programme-defined cohort, clearly stated.",
    "collection_method": "Graduate tracer survey and employer/enterprise verification",
    "recommended_source": "Implementing MDA, employer follow-up, graduate tracer survey",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "skill_area",
      "employment_type"
    ],
    "evidence_required": [
      "tracer survey summary",
      "verification record"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-05",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Youth placed in apprenticeships, internships or work experience",
    "definition": "Number of eligible youth commencing a verified apprenticeship, internship or structured work-experience placement during the reporting period.",
    "required_data_fields": [
      "eligible_youth_placed",
      "placement_type",
      "employer_or_host",
      "placement_start_date",
      "placement_register_reference"
    ],
    "measurement_unit": "people",
    "calculation_method": "Count unique youth who commenced a verified placement; distinguish offers from placements actually started.",
    "collection_method": "Placement register and host confirmation",
    "recommended_source": "Training provider, employer/host and implementing MDA records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "skill_area",
      "placement_type"
    ],
    "evidence_required": [
      "placement register",
      "host confirmation"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "LAB-06",
    "reporting_category": "Skill and labour",
    "pillar": "vocational",
    "segment": null,
    "indicator_name": "Supported enterprises operating after programme support",
    "definition": "Number and share of supported participant-owned enterprises verified as operating at the defined follow-up point.",
    "required_data_fields": [
      "enterprises_supported",
      "enterprises_operating",
      "follow_up_period",
      "verification_method",
      "enterprise_register_reference"
    ],
    "measurement_unit": "enterprises and percent",
    "calculation_method": "Report supported and operating enterprises; operating rate = enterprises_operating / enterprises_supported * 100, with the follow-up period stated.",
    "collection_method": "Enterprise follow-up and site/transaction verification",
    "recommended_source": "Enterprise support programme records and follow-up checks",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "enterprise_sector",
      "support_type"
    ],
    "evidence_required": [
      "enterprise register",
      "follow-up verification"
    ],
    "is_active": true,
    "created_at": "2026-10-15T08:45:23.824787+00:00",
    "updated_at": "2026-10-15T08:45:23.824787+00:00"
  },
  {
    "indicator_code": "VESB-01",
    "reporting_category": "Values/Ethics/Social behaviour",
    "pillar": "values_ethics_social_behaviour",
    "segment": null,
    "indicator_name": "Ethics and civic-values learning sessions delivered",
    "definition": "Number of structured ethics, integrity, civic responsibility or values-learning sessions delivered during the reporting period.",
    "required_data_fields": [
      "activity_id",
      "LGA",
      "community",
      "session_date",
      "session_type",
      "participants_total",
      "facilitator",
      "evidence_reference"
    ],
    "measurement_unit": "sessions",
    "calculation_method": "Count verified sessions delivered in the reporting period.",
    "collection_method": "Activity register and session attendance sheets",
    "recommended_source": "Implementing MDA/agency activity register",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "community",
      "session_type",
      "sex",
      "age_group"
    ],
    "evidence_required": [
      "session report",
      "attendance sheet",
      "dated photographs or equivalent evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "VESB-02",
    "reporting_category": "Values/Ethics/Social behaviour",
    "pillar": "values_ethics_social_behaviour",
    "segment": null,
    "indicator_name": "People reached through values and social-behaviour interventions",
    "definition": "Unique participants reached by verified ethics, civic-values or positive social-behaviour interventions.",
    "required_data_fields": [
      "activity_id",
      "LGA",
      "intervention_type",
      "participants_total",
      "participants_male",
      "participants_female",
      "participants_youth",
      "period",
      "source"
    ],
    "measurement_unit": "people",
    "calculation_method": "Count unique participants; document deduplication method where activities overlap.",
    "collection_method": "Attendance/beneficiary register and post-activity report",
    "recommended_source": "Implementing MDA/agency beneficiary register",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "disability_status",
      "intervention_type"
    ],
    "evidence_required": [
      "beneficiary register",
      "activity report"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "VESB-03",
    "reporting_category": "Values/Ethics/Social behaviour",
    "pillar": "values_ethics_social_behaviour",
    "segment": null,
    "indicator_name": "Ethics-related complaints resolved",
    "definition": "Percentage of formally recorded ethics/social-behaviour complaints resolved within the approved service standard.",
    "required_data_fields": [
      "complaints_received",
      "complaints_resolved",
      "resolution_standard_days",
      "period",
      "complaint_register_reference"
    ],
    "measurement_unit": "percent",
    "calculation_method": "complaints_resolved / complaints_received * 100; report counts as well; if no complaints were received, report N/A, not 0%.",
    "collection_method": "Review of complaint/grievance register and resolution records",
    "recommended_source": "Responsible MDA grievance/ethics desk",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "complaint_type",
      "resolution_status"
    ],
    "evidence_required": [
      "aggregated complaint register",
      "resolution evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "VESB-04",
    "reporting_category": "Values/Ethics/Social behaviour",
    "pillar": "values_ethics_social_behaviour",
    "segment": null,
    "indicator_name": "Community perception of ethical and positive social behaviour",
    "definition": "Share of valid respondents reporting improved awareness or practice against the defined survey questions.",
    "required_data_fields": [
      "survey_sample_size",
      "valid_responses",
      "questionnaire_version",
      "positive_responses",
      "survey_period",
      "methodology"
    ],
    "measurement_unit": "percent",
    "calculation_method": "positive_responses / valid_responses * 100; publish sample size and survey method.",
    "collection_method": "Structured beneficiary/community survey or pre/post assessment",
    "recommended_source": "Approved MDA survey or monitoring exercise",
    "reporting_frequency": "Annual",
    "disaggregation_dimensions": [
      "LGA",
      "sex",
      "age_group",
      "disability_status",
      "questionnaire_item"
    ],
    "evidence_required": [
      "survey instrument",
      "aggregated results",
      "methodology note"
    ],
    "is_active": true,
    "created_at": "2026-10-14T08:34:54.93816+00:00",
    "updated_at": "2026-10-14T08:34:54.93816+00:00"
  },
  {
    "indicator_code": "HCDS-01",
    "reporting_category": "HCD Settings",
    "pillar": "agriculture",
    "segment": null,
    "indicator_name": "Human capital development initiatives implemented in homes",
    "definition": "Number of distinct, verified human capital development initiatives delivered in household or home settings during the reporting period. Count an initiative only when implementation is evidenced; do not count individual activities within the same initiative as separate initiatives unless they have distinct approved initiative identifiers.",
    "required_data_fields": [
      "initiative_id",
      "initiative_name",
      "setting_type",
      "household_or_home_coverage",
      "target_population",
      "initiatives_planned",
      "implementation_status",
      "implementation_start_date",
      "implementation_end_date",
      "beneficiaries_reached",
      "reporting_period",
      "evidence_reference"
    ],
    "measurement_unit": "initiatives",
    "calculation_method": "Count distinct verified initiative_id values implemented in household or home settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.",
    "collection_method": "Review LGA and programme implementation registers, home/household outreach records, beneficiary registers, and supporting evidence; validate unique initiative identifiers before aggregation.",
    "recommended_source": "Approved HCD initiative register, household outreach reports, beneficiary registers, monitoring reports, and verified evidence records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "reporting_period",
      "programme_type",
      "target_population",
      "initiative_status"
    ],
    "evidence_required": [
      "approved initiative or activity record",
      "implementation report or household outreach register",
      "beneficiary or coverage record where applicable",
      "verification evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-16T09:36:48.477882+00:00",
    "updated_at": "2026-10-18T14:13:53.712079+00:00",
    "aggregation_method": "sum"
  },
  {
    "indicator_code": "HCDS-02",
    "reporting_category": "HCD Settings",
    "pillar": "agriculture",
    "segment": null,
    "indicator_name": "Human capital development initiatives implemented in communities",
    "definition": "Number of distinct, verified human capital development initiatives delivered in community settings during the reporting period, including community outreach, awareness, inclusion, wellbeing, and development initiatives within the approved HCD scope.",
    "required_data_fields": [
      "initiative_id",
      "initiative_name",
      "setting_type",
      "community_name",
      "target_population",
      "initiatives_planned",
      "implementation_status",
      "implementation_start_date",
      "implementation_end_date",
      "beneficiaries_reached",
      "reporting_period",
      "evidence_reference"
    ],
    "measurement_unit": "initiatives",
    "calculation_method": "Count distinct verified initiative_id values implemented in community settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.",
    "collection_method": "Review community programme registers, outreach reports, attendance/beneficiary records, and monitoring evidence; validate unique initiative identifiers before aggregation.",
    "recommended_source": "Approved HCD initiative register, community outreach and engagement reports, beneficiary registers, monitoring reports, and verified evidence records",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "reporting_period",
      "community",
      "programme_type",
      "target_population",
      "initiative_status"
    ],
    "evidence_required": [
      "approved initiative or activity record",
      "community implementation or outreach report",
      "attendance or beneficiary record where applicable",
      "verification evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-16T09:36:48.477882+00:00",
    "updated_at": "2026-10-18T14:13:53.712079+00:00",
    "aggregation_method": "sum"
  },
  {
    "indicator_code": "HCDS-03",
    "reporting_category": "HCD Settings",
    "pillar": "agriculture",
    "segment": null,
    "indicator_name": "Human capital development initiatives implemented in learning institutions",
    "definition": "Number of distinct, verified human capital development initiatives delivered through or within recognised learning institutions during the reporting period, including eligible early learning, school, technical/vocational, tertiary, and other approved learning settings.",
    "required_data_fields": [
      "initiative_id",
      "initiative_name",
      "setting_type",
      "institution_name",
      "institution_type",
      "target_population",
      "initiatives_planned",
      "implementation_status",
      "implementation_start_date",
      "implementation_end_date",
      "beneficiaries_reached",
      "reporting_period",
      "evidence_reference"
    ],
    "measurement_unit": "initiatives",
    "calculation_method": "Count distinct verified initiative_id values implemented in learning institutions during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.",
    "collection_method": "Review institution-level initiative registers, implementation reports, attendance/beneficiary records, and verification evidence with the relevant institution or supervising agency.",
    "recommended_source": "Approved HCD initiative register, institution returns, programme implementation reports, attendance and beneficiary records, and monitoring evidence",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "reporting_period",
      "institution_type",
      "programme_type",
      "target_population",
      "initiative_status"
    ],
    "evidence_required": [
      "approved initiative or activity record",
      "institution implementation report or confirmation",
      "attendance or beneficiary record where applicable",
      "verification evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-16T09:36:48.477882+00:00",
    "updated_at": "2026-10-18T14:13:53.712079+00:00",
    "aggregation_method": "sum"
  },
  {
    "indicator_code": "HCDS-04",
    "reporting_category": "HCD Settings",
    "pillar": "agriculture",
    "segment": null,
    "indicator_name": "Human capital development initiatives implemented in workplaces",
    "definition": "Number of distinct, verified human capital development initiatives delivered in workplace or employment settings during the reporting period, including eligible workplace learning, skills development, occupational wellbeing, inclusion, and labour participation initiatives within the approved HCD scope.",
    "required_data_fields": [
      "initiative_id",
      "initiative_name",
      "setting_type",
      "workplace_or_employer_name",
      "workplace_type",
      "target_population",
      "initiatives_planned",
      "implementation_status",
      "implementation_start_date",
      "implementation_end_date",
      "beneficiaries_reached",
      "reporting_period",
      "evidence_reference"
    ],
    "measurement_unit": "initiatives",
    "calculation_method": "Count distinct verified initiative_id values implemented in workplace settings during the reporting period. Exclude planned-only, cancelled, duplicate, and unsupported initiatives.",
    "collection_method": "Review employer/workplace programme registers, training and implementation records, participant registers, and monitoring evidence; validate unique initiative identifiers before aggregation.",
    "recommended_source": "Approved HCD initiative register, employer/workplace returns, workforce training reports, participant registers, and verified monitoring evidence",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "reporting_period",
      "workplace_type",
      "programme_type",
      "target_population",
      "initiative_status"
    ],
    "evidence_required": [
      "approved initiative or activity record",
      "workplace/employer implementation report or confirmation",
      "participant or beneficiary record where applicable",
      "verification evidence"
    ],
    "is_active": true,
    "created_at": "2026-10-16T09:36:48.477882+00:00",
    "updated_at": "2026-10-18T14:13:53.712079+00:00",
    "aggregation_method": "sum"
  },
  {
    "indicator_code": "HCDS-05",
    "reporting_category": "HCD Settings",
    "pillar": "agriculture",
    "segment": "data_governance",
    "indicator_name": "HCD reporting data completeness and evidence compliance (Inactive)",
    "definition": "Compliance rate of submitted activity measurements adhering to mandatory data fields, demographic disaggregation, and verifiable documentary evidence standards.",
    "required_data_fields": [
      "records_submitted",
      "records_compliant",
      "audit_score",
      "verification_date"
    ],
    "measurement_unit": "percent",
    "calculation_method": "records_compliant / records_submitted * 100",
    "collection_method": "Automated QA completeness audit and data quality review",
    "recommended_source": "AKS-HCD Data Quality Assurance engine / evidence vault audit",
    "reporting_frequency": "Quarterly",
    "disaggregation_dimensions": [
      "LGA",
      "pillar",
      "compliance_tier"
    ],
    "evidence_required": [
      "data quality audit report",
      "evidence vault verification stamp"
    ],
    "aggregation_method": "average",
    "is_active": false,
    "created_at": "2026-10-15T08:00:00.00000+00:00",
    "updated_at": "2026-10-18T14:13:53.712079+00:00"
  }
];

export type HCDSettingType = 'Home' | 'Communities' | 'Learning institutions' | 'Workplaces';

export const HCD_SETTINGS_MAP: Record<
  HCDSettingType,
  { code: string; label: string; unit: string; aggregation: string }
> = {
  Home: {
    code: 'HCDS-01',
    label: 'Human capital development initiatives implemented in homes',
    unit: 'initiatives',
    aggregation: 'sum',
  },
  Communities: {
    code: 'HCDS-02',
    label: 'Human capital development initiatives implemented in communities',
    unit: 'initiatives',
    aggregation: 'sum',
  },
  'Learning institutions': {
    code: 'HCDS-03',
    label: 'Human capital development initiatives implemented in learning institutions',
    unit: 'initiatives',
    aggregation: 'sum',
  },
  Workplaces: {
    code: 'HCDS-04',
    label: 'Human capital development initiatives implemented in workplaces',
    unit: 'initiatives',
    aggregation: 'sum',
  },
};

export const getSettingFromIndicatorCode = (code?: string | null): HCDSettingType | null => {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  for (const [setting, meta] of Object.entries(HCD_SETTINGS_MAP)) {
    if (meta.code === cleanCode) {
      return setting as HCDSettingType;
    }
  }
  return null;
};

export const getIndicatorCodeFromSetting = (setting?: string | null): string | null => {
  if (!setting) return null;
  const match = Object.keys(HCD_SETTINGS_MAP).find(
    (key) => key.toLowerCase() === setting.trim().toLowerCase()
  );
  if (match) {
    return HCD_SETTINGS_MAP[match as HCDSettingType].code;
  }
  return null;
};

export const isValidSetting = (setting?: string | null): setting is HCDSettingType => {
  if (!setting) return false;
  return Object.keys(HCD_SETTINGS_MAP).some(
    (key) => key.toLowerCase() === setting.trim().toLowerCase()
  );
};

