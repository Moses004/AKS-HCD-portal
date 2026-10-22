-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

BEGIN;

-- Least-privilege grants: RLS remains the row-level authorization layer.
REVOKE ALL PRIVILEGES ON TABLE public.activities, public.audit_logs, public.ptr_test_logs, public.user_profiles FROM PUBLIC, anon, authenticated;

-- Public visitors may only SELECT; the existing RLS policy restricts this to PUBLISHED activities.
GRANT SELECT ON TABLE public.activities TO anon;

-- Authenticated activity CRUD is still constrained by the table's scoped RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activities TO authenticated;

-- Audit/PTR ledgers are append-only for application roles.
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ptr_test_logs TO authenticated;

-- Profiles are readable under their scoped RLS policy; changes must go through controlled backend/RPC administration.
GRANT SELECT ON TABLE public.user_profiles TO authenticated;

-- Tighten audit insert scope: LGA accounts cannot write state-wide/null-LGA audit entries.
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs;
CREATE POLICY audit_logs_insert_authenticated
ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = (SELECT auth.uid())
  AND role = private.aks_hcd_current_role()
  AND (
    private.aks_hcd_current_role() = 'state_admin'
    OR (
      private.aks_hcd_current_role() = 'lga_admin'
      AND lga_id = private.aks_hcd_current_lga()
    )
  )
);

-- Public helper functions are no longer needed by anonymous visitors; limit exposure.
CREATE OR REPLACE FUNCTION public.aks_hcd_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.role
  FROM public.user_profiles p
  WHERE p.user_id = (SELECT auth.uid())
    AND p.active = true
    AND p.approval_status = 'approved'
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.aks_hcd_current_lga()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.lga_id
  FROM public.user_profiles p
  WHERE p.user_id = (SELECT auth.uid())
    AND p.active = true
    AND p.approval_status = 'approved'
    AND p.role = 'lga_admin'
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.aks_hcd_current_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aks_hcd_current_lga() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_lga() TO authenticated, service_role;

-- Query-plan support for profile approval queues and scoped audit views.
CREATE INDEX IF NOT EXISTS user_profiles_approved_by_idx
  ON public.user_profiles (approved_by);
CREATE INDEX IF NOT EXISTS user_profiles_approval_status_created_at_idx
  ON public.user_profiles (approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_lga_timestamp_idx
  ON public.audit_logs (lga_id, "timestamp" DESC);

COMMIT;

