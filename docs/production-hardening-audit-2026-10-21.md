# Production Hardening Audit — 2026-10-21

Repository: https://github.com/Moses004/AKS-HCD-portal  
Working branch: audit/production-hardening-2026-10-21  
Pull request: https://github.com/Moses004/AKS-HCD-portal/pull/1 (draft; do not merge yet)

## Implemented in this branch

- Replaced unsafe legacy README SQL instructions that created broad public write policies and made `hcd-evidence-vault` public.
- Added separate CI jobs so frontend dependency/type/build validation and backend migration inventory/secret-pattern checks can run concurrently.
- Fixed the observed npm peer-dependency conflict by aligning `esbuild` with Vite 8's supported peer range (`^0.28.0`); do not use `--force` or `--legacy-peer-deps`.
- CI currently generates a temporary lockfile artifact if `package-lock.json` is absent, then uses `npm ci`. The latest CI run passed dependency installation, TypeScript checking, production build, and migration/secret-safety checks. The lockfile remains uncommitted, so dependency reproducibility is not complete.
- Added a manual staging-only integration workflow requiring `TEST_SUPABASE_URL` and `TEST_SUPABASE_ANON_KEY` as secrets in the GitHub `staging` environment. It refuses the known production Supabase URL.
- Added a manual staging browser image smoke workflow and browser script. It requires `STAGING_PUBLISHED_ACTIVITY_URL` to point to a published activity page in the staging deployment; it checks image load state, uncaught page errors, page content, and uploads a short-retention screenshot artifact without logging signed URLs.
- Existing integration scripts now require explicit staging environment variables and refuse the known production Supabase URL.
- Removed the frontend client's silent production URL and hard-coded anonymous-key fallbacks. Missing project configuration now fails closed, and the staging integration workflow maps both `TEST_SUPABASE_*` and `VITE_SUPABASE_*` variables to the same staging secrets so imported clients cannot accidentally choose another project.

## Current validation status

- CI run `39620973299` passed both frontend and backend jobs after migration recovery and the initial migration inventory validation. A follow-up run `39621280063` is pending for the stricter filename/version and client production-fallback checks; it must complete successfully before merge.
- Earlier CI runs failed during `npm install` with an `ERESOLVE` peer dependency conflict. The branch now aligns `esbuild` with Vite 8's peer range (`^0.28.0`) and the latest observed frontend job passes.
- The reviewed lockfile has not yet been committed. The CI artifact must be downloaded/reviewed and committed before considering dependency reproducibility complete.
- A read-only database audit confirmed all 10 application tables in `public` have RLS enabled and at least one policy; all 3 public views use `security_invoker=true`; and `hcd-evidence-vault` is private with a 50 MiB object-size limit. This is a structural check, not proof that every role boundary is correct.
- The repository's `main` and audit branches are currently not protected. Configure branch protection/Rulesets to require PR review and successful CI before merging.
- Integration tests and browser smoke tests have **not** been run because no dedicated staging Supabase project credentials or staging published-activity URL are configured. Creating `AKS-HCD-Staging` in organization `nxjposepldjwlxkchlax` was blocked by Supabase's maximum of two active free projects; no project was created. Do not use production for these tests.
- Recovered all 27 applied SQL statements directly from the live Supabase migration ledger into ordered files under `supabase/migrations/`, using the exact recorded 14-digit versions and names. Archived the two unmatched legacy repository SQL files under `docs/legacy-migrations/` and removed them from the active migration directory. See `docs/database-migration-recovery-2026-10-21.md`. No migration was applied to production during recovery. Fresh staging replay remains unverified.

## Remaining release gates

1. **Lockfile:** download and review the `aks-hcd-generated-package-lock` artifact, commit it as `package-lock.json`, then remove the transitional lock-generation step and keep `npm ci`.
2. **CI:** confirm frontend type-check/build and backend migration-safety job pass on the final PR head. Fix any new failures from actual logs.
3. **Staging database:** free capacity by pausing/deleting an unused project or upgrade as appropriate, then create a dedicated non-production Supabase project. Review and apply the recovered ordered migration history to staging only; configure GitHub Actions environment `staging` with `TEST_SUPABASE_URL` and `TEST_SUPABASE_ANON_KEY`, seed only synthetic test data, and run the staging integration workflow.
4. **Browser media:** set `STAGING_PUBLISHED_ACTIVITY_URL` to a published staging activity that contains evidence images, then run the staging browser smoke workflow. Confirm image loads and inspect the screenshot artifact.
5. **Supabase Auth:** enable leaked-password protection in the Supabase Dashboard at https://supabase.com/dashboard/project/refjawgovrmsyigtcfdl/auth/providers?provider=Email and verify the security advisor no longer reports `auth_leaked_password_protection`. This is an Auth configuration setting, not a SQL migration; it has not been changed from this GitHub workflow.
6. **Authorization RPC:** reviewed the live function definition read-only. It uses an empty `search_path`, fully qualified table references, rejects anonymous callers, requires `private.aks_hcd_current_role()` to equal `state_admin`, prevents self-review, validates decisions and role assignments, and applies explicit LGA assignment for LGA Desk Workers. The generic advisor warning remains because `authenticated` can invoke a `SECURITY DEFINER` RPC; revoking that grant would break the intended frontend call unless the approval flow is redesigned. Verify this authorization with staging tests and retain the finding as reviewed/mitigated rather than blindly changing function privileges.
7. **Final release:** review the complete branch diff, fresh CI results after migration validation changes, successful staging migration replay, integration tests, browser media smoke test, and all remaining security-advisor findings. The PR remains draft and must not be merged yet.. Keep the PR draft and do not merge/deploy until the above gates pass.

## Security and operational notes

- Never use production credentials for integration or browser testing. Never put a service-role key in client-side variables or repository files.
- `hcd-evidence-vault` must remain private; public UI must use appropriately scoped signed URLs and avoid logging signed URL query strings.
- Do not remove indexes solely because an advisor calls them unused; evaluate workload and query plans first.
- The staging workflows are manual and use the GitHub `staging` environment to keep credentials out of ordinary pull-request jobs.
