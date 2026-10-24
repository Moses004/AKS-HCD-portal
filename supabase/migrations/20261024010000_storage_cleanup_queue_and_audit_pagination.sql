-- =============================================================================
-- Migration: 20261024010000_storage_cleanup_queue_and_audit_pagination.sql
-- Purpose:
--   1. Create `public.storage_cleanup_queue` to track superseded storage objects
--      in `hcd-evidence-vault` when client-side storage DELETE is restricted by RLS,
--      enabling safe administrative cleanup without weakening bucket permissions.
--   2. Provide `SECURITY DEFINER` RPC `public.enqueue_superseded_storage_object`
--      for authorized LGA Desk Officers & State Admins.
--   3. Add composite pagination indexes on `public.audit_logs` and `public.activities`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL DEFAULT 'hcd-evidence-vault',
  storage_path TEXT NOT NULL,
  activity_id TEXT,
  lga_id TEXT,
  reason TEXT NOT NULL DEFAULT 'superseded_evidence_replacement',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purged', 'retained')),
  queued_by UUID DEFAULT auth.uid(),
  queued_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_status_created
  ON public.storage_cleanup_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_path
  ON public.storage_cleanup_queue (bucket_id, storage_path);

ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- State Super-Admins can read and manage the storage cleanup queue
DROP POLICY IF EXISTS "storage_cleanup_queue_state_admin_select" ON public.storage_cleanup_queue;
CREATE POLICY "storage_cleanup_queue_state_admin_select"
  ON public.storage_cleanup_queue
  FOR SELECT
  TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin');

DROP POLICY IF EXISTS "storage_cleanup_queue_state_admin_update" ON public.storage_cleanup_queue;
CREATE POLICY "storage_cleanup_queue_state_admin_update"
  ON public.storage_cleanup_queue
  FOR UPDATE
  TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin')
  WITH CHECK (public.aks_hcd_current_role() = 'state_admin');

-- Authorized LGA Admins and State Admins can insert cleanup records for their jurisdiction
DROP POLICY IF EXISTS "storage_cleanup_queue_authorized_insert" ON public.storage_cleanup_queue;
CREATE POLICY "storage_cleanup_queue_authorized_insert"
  ON public.storage_cleanup_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.aks_hcd_current_role() = 'state_admin'
    OR (
      public.aks_hcd_current_role() = 'lga_admin'
      AND (lga_id IS NULL OR lga_id = public.aks_hcd_current_lga())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.storage_cleanup_queue TO authenticated;

-- Guarded RPC to enqueue superseded storage objects safely
CREATE OR REPLACE FUNCTION public.enqueue_superseded_storage_object(
  p_storage_path TEXT,
  p_activity_id TEXT DEFAULT NULL,
  p_lga_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'superseded_evidence_replacement'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_lga TEXT;
  v_display_name TEXT;
  v_id UUID;
BEGIN
  v_role := public.aks_hcd_current_role();
  v_user_lga := public.aks_hcd_current_lga();

  IF v_role IS NULL OR v_role NOT IN ('lga_admin', 'state_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only approved LGA Desk Officers or State Super-Administrators may enqueue superseded storage paths.';
  END IF;

  IF v_role = 'lga_admin' AND p_lga_id IS NOT NULL AND p_lga_id <> v_user_lga THEN
    RAISE EXCEPTION 'Cross-LGA violation: Cannot enqueue storage cleanup for another LGA.';
  END IF;

  SELECT display_name INTO v_display_name
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.storage_cleanup_queue (
    bucket_id,
    storage_path,
    activity_id,
    lga_id,
    reason,
    status,
    queued_by,
    queued_by_name
  ) VALUES (
    'hcd-evidence-vault',
    p_storage_path,
    p_activity_id,
    COALESCE(p_lga_id, v_user_lga),
    COALESCE(p_reason, 'superseded_evidence_replacement'),
    'pending',
    auth.uid(),
    COALESCE(v_display_name, 'Authorized Officer')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_id,
    'storage_path', p_storage_path
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_superseded_storage_object(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Composite indexes for server-side audit log & activity archive pagination
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_lga_action
  ON public.audit_logs (timestamp DESC, lga_id, action);

CREATE INDEX IF NOT EXISTS idx_activities_status_updated_lga
  ON public.activities (status, updated_at DESC, lga_id);
