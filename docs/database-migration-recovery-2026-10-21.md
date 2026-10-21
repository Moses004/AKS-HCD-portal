# Production migration-history recovery — 2026-10-21

## What was done

The live project `refjawgovrmsyigtcfdl` reported 27 applied migrations in `supabase_migrations.schema_migrations`. Their exact recorded SQL statements were read from that ledger and restored to `supabase/migrations/` using the exact 14-digit versions and migration names. No SQL was applied to production during this recovery.

The two pre-existing repository SQL files used dates that did not match the live migration ledger. They were moved to `docs/legacy-migrations/` for audit/reference only and removed from the active Supabase migration directory so a fresh environment will not unexpectedly treat them as pending migrations.

## Important deployment rules

- The restored migration files represent changes already applied to the production database. **Do not re-run them against production.**
- A fresh staging project should apply this ordered history once, then receive synthetic test fixtures only.
- Before any staging application, review the recovered SQL and verify a fresh project can apply it from an empty database. If a migration fails, stop and correct the migration history in source control; do not skip or mark it applied without evidence.
- Do not apply migrations from `docs/legacy-migrations/`.
- Production changes remain gated by staging verification, a backup/recovery plan, reviewed PR, and explicit deployment.

## Recovered applied migrations

| Version | Migration |
|---|---|
| 20261009011021 | aks_hcd_durable_storage_and_rls_baseline |
| 20261009011035 | aks_hcd_rls_hardening_and_indexes |
| 20261009074734 | aks_hcd_private_rls_helpers_and_public_read_split |
| 20261009083216 | aks_hcd_server_stamp_audit_and_ptr_actors |
| 20261009150133 | aks_hcd_access_request_approval_workflow |
| 20261009150429 | aks_hcd_access_review_guardrails |
| 20261013073120 | critical_security_hardening_20261013 |
| 20261013073152 | restrict_legacy_public_role_helpers_20261013 |
| 20261013082427 | aks_hcd_least_privilege_table_grants_20261013 |
| 20261014083454 | aks_hcd_reporting_taxonomy_and_cross_cutting_metrics_20261014 |
| 20261014091811 | hcd_pillar_display_names_and_lga_report_indexes_20261014 |
| 20261015084523 | add_health_education_skill_labour_reporting_indicators_20261015 |
| 20261015084621 | hcd_indicator_catalogue_audit_index_cleanup_20261015 |
| 20261016093648 | hcd_lga_annual_targets_and_hcd_settings_pillar_20261016 |
| 20261016093717 | hcd_target_performance_view_and_aggregation_methods_20261016 |
| 20261016093728 | hcd_target_metric_types_and_performance_aggregation_20261016 |
| 20261016093750 | hcd_target_audit_indexes_20261016 |
| 20261016093754 | restrict_lga_target_visibility_to_approved_targets_20261016 |
| 20261018122515 | launch_hardening_storage_function_and_measurement_policy_20261018 |
| 20261018122538 | launch_hardening_activity_description_compat_20261018 |
| 20261018141353 | hcd_settings_initiative_target_indicators_20261018 |
| 20261019094936 | state_level_hcd_activity_reporting_module_20261019 |
| 20261019095010 | state_hcd_reporting_consolidated_view_and_trigger_hardening_20261019 |
| 20261019095029 | state_hcd_action_item_public_privacy_hardening_20261019 |
| 20261019095037 | state_hcd_reporting_explicit_privilege_hardening_20261019 |
| 20261020085550 | normalize_activity_media_metadata_and_state_indexes_20261020 |
| 20261021115551 | state_public_action_items_invoker_security_20261021 |

## Still unverified

- A new staging project could not be created because the organization reached its two-active-free-project limit.
- Fresh-database replay of all 27 migrations has not been tested.
- Staging integration tests, RLS role-boundary tests, and browser media rendering remain pending.
- This document is migration-history recovery, not a production-readiness certification.
