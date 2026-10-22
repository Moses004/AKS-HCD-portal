<!-- Archived from the legacy repository migration directory on 2026-10-21. This file is retained for audit/reference only and must not be applied by Supabase CLI. The authoritative applied migration history is in supabase/migrations/ using the exact versions recorded by the live project. -->

-- ==============================================================================
-- AKWA IBOM STATE HUMAN CAPITAL DEVELOPMENT (AKS-HCD) PLATFORM
-- AUTHENTICATION ENROLLMENT TRIGGER & ACCESS REQUEST REVIEW RPC
-- File: supabase/migrations/20261013_auth_trigger_and_review_rpc.sql
-- ==============================================================================

-- 1. Ensure columns exist on public.user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS staff_identifier TEXT,
  ADD COLUMN IF NOT EXISTS requested_role TEXT,
  ADD COLUMN IF NOT EXISTS requested_lga_id TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Apply constraints on approval_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_profiles_approval_status') THEN
    ALTER TABLE public.user_profiles 
      ADD CONSTRAINT chk_user_profiles_approval_status 
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

-- 3. Install user signup trigger to auto-create inactive pending user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    display_name,
    staff_identifier,
    department,
    role,
    lga_id,
    requested_role,
    requested_lga_id,
    approval_status,
    active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'staff_identifier',
    NEW.raw_user_meta_data->>'department',
    'public', -- Strictly public initially; never grant requested role immediately!
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'requested_role', 'lga_admin'),
    NEW.raw_user_meta_data->>'requested_lga_id',
    'pending',
    false, -- Inactive until executive review
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Install access request review RPC
CREATE OR REPLACE FUNCTION public.review_hcd_access_request(
  p_user_id UUID,
  p_decision TEXT,
  p_approved_role TEXT,
  p_approved_lga_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.user_profiles
  WHERE user_id = auth.uid() AND active = true AND approval_status = 'approved';

  IF v_caller_role IS NULL OR v_caller_role <> 'state_admin' THEN
    RAISE EXCEPTION 'Access Denied: Only verified State Super-Administrators may review access requests.';
  END IF;

  IF p_decision = 'approve' THEN
    UPDATE public.user_profiles
    SET role = COALESCE(p_approved_role, requested_role, 'public'),
        lga_id = CASE WHEN COALESCE(p_approved_role, requested_role) = 'lga_admin' THEN p_approved_lga_id ELSE NULL END,
        approval_status = 'approved',
        active = true,
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'reject' THEN
    UPDATE public.user_profiles
    SET approval_status = 'rejected',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'suspend' THEN
    UPDATE public.user_profiles
    SET approval_status = 'suspended',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'decision', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_hcd_access_request(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
