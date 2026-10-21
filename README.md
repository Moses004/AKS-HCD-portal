# Akwa Ibom State Human Capital Development (AKS-HCD) Platform

Official monitoring, tracking, and impact analytics portal for Akwa Ibom State's Human Capital Development initiatives and ARISE Agenda.

## Key capabilities

- Public transparency portal for published activities and approved impact reporting.
- Role-based LGA Desk Worker and State Executive workspaces.
- HCD indicator catalogue, annual targets, baselines, reporting periods, and performance calculations.
- State-Level Activities, action points, publication workflow, and consolidated reporting.
- Private evidence uploads through Supabase Storage.
- Offline-first drafts and synchronization, subject to authenticated scope and authorization.
- Reporting and export workflows.

## Technology

- React, TypeScript, Vite, Tailwind CSS
- Supabase Auth, PostgreSQL, Row Level Security (RLS), and private Storage
- Progressive Web App and offline support
- Recharts and export utilities

## Getting started

### Requirements

Use a Node.js version supported by the installed Vite and TypeScript versions (Node.js 22 LTS is the recommended CI baseline).

### Install

```bash
git clone https://github.com/Moses004/AKS-HCD-portal.git
cd AKS-HCD-portal
npm install
```

Create a local `.env` file using the environment variable names consumed by the existing application. For a Vite client, these may include:

```env
VITE_SUPABASE_URL=https://YOUR_STAGING_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Use the project's actual expected variable names if they differ. Never put a Supabase service-role key, database password, or other privileged secret in a frontend variable, committed file, or client bundle.

Start the development server:

```bash
npm run dev
```

Validate the production bundle:

```bash
npm run lint
npm run build
```

The repository's current `npm test` command includes Supabase integration checks. Do not run that command against the production project; see the testing section below. The example environment above is a placeholder: use a dedicated staging project, not production.

## Database setup and migrations

**Do not run legacy SQL snippets that grant anonymous/public write access to activities, audit logs, test telemetry, or make the evidence bucket public.** Those examples do not reflect the current production security model and may expose or corrupt government reporting data.

Use version-controlled Supabase migrations as the source of truth for schema, grants, RLS policies, functions, views, and Storage policies.

1. Review migration files and confirm they match the intended change.
2. Back up the database and verify a recovery procedure before production changes.
3. Apply migrations to a dedicated staging Supabase project first.
4. Validate schema, authentication, RLS, Storage policies, activity workflows, targets, state-level reporting, and exports in staging.
5. Apply reviewed migrations to production through a controlled deployment process.
6. Verify application health and security advisor findings after deployment.

Do not recreate existing production tables from README examples, run ad hoc broad grants, or replace established policies with sample policies. Do not expose private evidence by changing the `hcd-evidence-vault` bucket to public.

### Evidence and media

The `hcd-evidence-vault` bucket is private. Persist canonical object paths (such as `storagePath`) rather than permanent signed URLs. Signed URLs expire and should be generated when an authorized user needs to view a file. Public pages must not expose draft evidence, beneficiary documents, or other private records.

LGA uploads must remain scoped to the authenticated user's assigned LGA. State-level evidence uses the established `state-level/<activity-uuid>/...` path convention. Never put service-role credentials in browser code.

## Automated checks and testing

The GitHub Actions workflow should run dependency installation, lint/type checks, and a production build for pull requests and pushes to `main`.

Integration tests must use a dedicated staging/test Supabase project with synthetic data. They must not create, update, upload, or delete production records. Store staging credentials in GitHub Actions secrets; never commit them. Do not expose service-role credentials to pull-request workflows from untrusted forks.

Before enabling the repository's full integration test command in CI:

- Replace hard-coded production Supabase URLs and keys in test scripts with environment variables.
- Add a fail-closed guard that refuses to run if the configured project is the production project.
- Confirm all tests clean up only the synthetic records they create.
- Separate pure unit tests from integration tests that contact Supabase.
- Ensure CI jobs without staging credentials run only static checks and the production build.

## Release security checklist

- [ ] Active and approved profile checks are enforced; database RLS remains the security boundary.
- [ ] Anonymous users can read only explicitly public/published data.
- [ ] LGA users cannot read or modify another LGA's restricted records or evidence.
- [ ] State administrators can manage state-level activities only through authorized policies.
- [ ] Evidence storage remains private and signed URLs are short-lived.
- [ ] CI, type checks, lint, build, and staging integration tests pass.
- [ ] Supabase Auth settings and security-advisor findings have been reviewed.
- [ ] No secrets, real beneficiary data, or signed URLs are committed to Git.

## ARISE Agenda

The portal supports the Akwa Ibom State ARISE Agenda and Human Capital Development monitoring. Public reporting must be based on authorized, published data rather than demo or fallback records.

## License

Government of Akwa Ibom State and project contributors.
