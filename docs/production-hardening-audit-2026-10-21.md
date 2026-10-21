# Production Hardening Audit — 2026-10-21

Repository: https://github.com/Moses004/AKS-HCD-portal  
Working branch: audit/production-hardening-2026-10-21  
Pull request: https://github.com/Moses004/AKS-HCD-portal/pull/1 (draft; do not merge yet)

## Implemented in this branch

- Replaced unsafe legacy README SQL instructions that created broad public write policies and made `hcd-evidence-vault` public.
- Added separate CI jobs so frontend dependency/type/build validation and backend migration inventory/secret-pattern checks can run concurrently.
- Fixed the observed npm peer-dependency conflict by aligning `esbuild` with Vite 8's supported peer range (`^0.28.0`); do not use `--force` or `--legacy-peer-deps`.
- CI generates a temporary lockfile artifact if the repository lockfile is absent, then uses `npm ci`. The generated lockfile still needs to be downloaded, reviewed, and committed as `package-lock.json`; this transitional generation step should then be removed.
- Added a manual staging-only integration workflow requiring `TEST_SUPABASE_URL` and `TEST_SUPABASE_ANON_KEY` as secrets in the GitHub `staging` environment. It refuses the known production Supabase URL.
- Added a manual staging browser image smoke workflow and browser script. It requires `STAGING_PUBLISHED_ACTIVITY_URL` to point to a published activity page in the staging deployment; it checks image load state, uncaught page errors, page content, and uploads a short-retention screenshot artifact without logging signed URLs.
- Existing integration scripts now require explicit staging environment variables and refuse the known production Supabase URL.

## Current validation status

- The previous CI runs failed during `npm install` with an `ERESOLVE` peer dependency conflict: Vite 8 requires `esbuild ^0.27.0 || ^0.28.0`, while the project requested `esbuild ^0.25.0`. The branch now updates the esbuild range.
- Follow-up GitHub Actions runs have been created, but the latest runs were still queued when this audit was updated. Therefore lint/type-check, production build, backend static checks, and lockfile generation are **not yet verified as passing**.
- The reviewed lockfile has not yet been committed. The CI artifact must be downloaded/reviewed and committed before considering dependency reproducibility complete.
- Integration tests and browser smoke tests have **not** been run because no dedicated staging Supabase project credentials or staging published-activity URL are configured in the available context. Do not use production for these tests.

## Remaining release gates

1. **Lockfile:** wait for CI to generate `aks-hcd-generated-package-lock`, inspect dependency versions and peer resolutions, commit the reviewed `package-lock.json`, then remove the transitional lock-generation step and keep `npm ci`.
2. **CI:** confirm frontend type-check/build and backend migration-safety job pass on the final PR head. Fix any new failures from actual logs.
3. **Staging database:** configure GitHub Actions environment `staging` with `TEST_SUPABASE_URL` and `TEST_SUPABASE_ANON_KEY` for a dedicated non-production Supabase project. Apply the reviewed migrations to staging, seed only synthetic test data, and run the staging integration workflow.
4. **Browser media:** set `STAGING_PUBLISHED_ACTIVITY_URL` to a published staging activity that contains evidence images, then run the staging browser smoke workflow. Confirm image loads and inspect the screenshot artifact.
5. **Supabase Auth:** enable leaked-password protection in the Supabase Dashboard at https://supabase.com/dashboard/project/refjawgovrmsyigtcfdl/auth/providers?provider=Email and verify the security advisor no longer reports `auth_leaked_password_protection`. This is an Auth configuration setting, not a SQL migration; it has not been changed from this GitHub workflow.
6. **Authorization RPC:** reviewed the live function definition read-only. It uses an empty `search_path`, fully qualified table references, rejects anonymous callers, requires `private.aks_hcd_current_role()` to equal `state_admin`, prevents self-review, validates decisions and role assignments, and applies explicit LGA assignment for LGA Desk Workers. The generic advisor warning remains because `authenticated` can invoke a `SECURITY DEFINER` RPC; revoking that grant would break the intended frontend call unless the approval flow is redesigned. Verify this authorization with staging tests and retain the finding as reviewed/mitigated rather than blindly changing function privileges.
7. **Final release:** review the complete branch diff and all green checks. Keep the PR draft and do not merge/deploy until the above gates pass.

## Security and operational notes

- Never use production credentials for integration or browser testing. Never put a service-role key in client-side variables or repository files.
- `hcd-evidence-vault` must remain private; public UI must use appropriately scoped signed URLs and avoid logging signed URL query strings.
- Do not remove indexes solely because an advisor calls them unused; evaluate workload and query plans first.
- The staging workflows are manual and use the GitHub `staging` environment to keep credentials out of ordinary pull-request jobs.
