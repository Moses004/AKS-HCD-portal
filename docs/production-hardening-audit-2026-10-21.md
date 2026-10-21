# Production Hardening Audit — 2026-10-21

Repository: https://github.com/Moses004/AKS-HCD-portal
Working branch: audit/production-hardening-2026-10-21

## Changes made in this branch
- Replaced legacy README database setup instructions that created broad public write policies and made hcd-evidence-vault public.
- Updated clone instructions to this repository.
- Added .github/workflows/ci.yml to run TypeScript/lint checks and a production build.
- Integration tests are deliberately excluded from CI because current scripts make live Supabase calls and some simulate Storage upload/write attempts.
- CI temporarily uses npm install because package-lock.json was not found in the repository snapshot. Add and review a lockfile, then switch to npm ci.

## Confirmed risks requiring follow-up
1. scripts/test_suite.ts hard-codes the production Supabase URL and anon key and performs live Storage/database probes. It also invokes audit-log and PTR logging service methods with a synthetic session; whether these persist depends on service implementation and production RLS.
2. scripts/test_image_reliability.ts hard-codes the production Supabase URL and anon key. It attempts evidence uploads and queries production activities, action items, and target tables. Do not run it against production.
3. scripts/test_state_activities.ts uses the application's default Supabase client, whose fallback URL points to production. Its checks are primarily reads, but it should still require explicit staging configuration.
4. src/lib/supabase.ts falls back to the production project URL and embeds the public anon key. An anon key is not a service-role secret, but the production fallback makes accidental production calls from scripts easier. Tests should fail closed unless a staging URL is explicitly provided.
5. package-lock.json was not found in the repository snapshot. A lockfile is needed for reliable npm ci installs.
6. Supabase Auth leaked-password protection and the authorization/grants review for review_hcd_access_request(...) remain dashboard/security-review actions.
7. Image resolution should be verified in a real browser against the published activity. The underlying object was previously confirmed present and stale signed URL metadata was normalized, but a successful browser image request has not yet been established.

## Checks performed
- Read package.json, README, media resolver, and the image-reliability, master, and state-activity test scripts from the audit branch.
- Confirmed package scripts: lint runs tsc --noEmit; build runs vite build; test runs all three test scripts.
- Confirmed no package-lock.json or existing .github/workflows/ci.yml was found before the workflow was added.
- Added a CI workflow but have not executed GitHub Actions, installed dependencies in a build runner, or verified lint/build results in this session.

## Release gates
- [ ] Require explicit staging environment variables in all integration test scripts and refuse the production project.
- [ ] Separate pure/unit tests from integration tests; configure staging secrets only for trusted workflow contexts.
- [ ] Add a reviewed lockfile and switch CI to npm ci.
- [ ] Run CI and fix actual lint/build failures.
- [ ] Verify image signed-URL resolution in a browser without logging tokens or exposing private evidence.
- [ ] Address Supabase Auth and security-advisor findings.
- [ ] Review branch diff, then open a pull request. Do not merge until release gates are met.
