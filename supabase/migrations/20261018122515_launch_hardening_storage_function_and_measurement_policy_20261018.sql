-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Launch hardening: keep evidence private, tighten function exposure, and avoid per-row auth re-evaluation.
UPDATE storage.buckets
SET public = false
WHERE id = 'hcd-evidence-vault';

-- Signed URLs and authenticated Storage policies remain the only access path.
REVOKE ALL ON FUNCTION public.review_hcd_access_request(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_hcd_access_request(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_hcd_access_request(uuid, text, text, text, text) TO authenticated;

-- Existing policy already scopes measurement insertion to an owned activity and current tenant.
-- Wrap stable auth/role helper calls in SELECT so Postgres can evaluate them once per statement.
DROP POLICY IF EXISTS activity_measurements_insert_scoped ON public.activity_measurements;
CREATE POLICY activity_measurements_insert_scoped
ON public.activity_measurements
FOR INSERT TO authenticated
WITH CHECK (
  entered_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.activities AS a
    WHERE a.id = activity_measurements.activity_id
      AND (
        (SELECT private.aks_hcd_current_role()) = 'state_admin'
        OR (
          (SELECT private.aks_hcd_current_role()) = 'lga_admin'
          AND a.lga_id = (SELECT private.aks_hcd_current_lga())
          AND a.status IN ('DRAFT', 'REJECTED_DRAFT', 'PENDING_APPROVAL')
        )
      )
  )
);

COMMENT ON POLICY activity_measurements_insert_scoped ON public.activity_measurements IS
'Launch-hardening policy: authenticated actor must match entered_by and may only insert measurements for an activity within their authorized scope.';

