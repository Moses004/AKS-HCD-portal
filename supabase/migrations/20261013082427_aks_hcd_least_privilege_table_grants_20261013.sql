-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Least-privilege grants for AKS-HCD application tables.
-- RLS policies remain the row-level boundary; grants are the table-level boundary.
REVOKE ALL PRIVILEGES ON TABLE public.activities, public.audit_logs, public.ptr_test_logs, public.user_profiles FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.activities, public.audit_logs, public.ptr_test_logs, public.user_profiles FROM anon, authenticated;

-- Public portal may read only published activities; RLS enforces status = PUBLISHED.
GRANT SELECT ON TABLE public.activities TO anon;

-- Signed-in users receive only the verbs required by the app. RLS continues
-- to scope activity reads/writes, audit logs, PTR logs, and profiles.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activities TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ptr_test_logs TO authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;

-- Ensure the access-review RPC is not callable by anonymous or PUBLIC roles.
REVOKE ALL ON FUNCTION public.review_hcd_access_request(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_hcd_access_request(uuid, text, text, text, text) TO authenticated;

-- Ensure helper functions are not executable through the exposed public schema.
REVOKE ALL ON FUNCTION public.aks_hcd_current_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aks_hcd_current_lga() FROM PUBLIC, anon, authenticated;

