-- ==============================================================================
-- AKWA IBOM STATE HUMAN CAPITAL DEVELOPMENT (AKS-HCD) PLATFORM
-- SECURITY, ROLE-BASED ACCESS CONTROL, RLS AND FUNCTION PERMISSION MIGRATION
-- File: supabase/migrations/20261008_fix_security_and_grants.sql
-- ==============================================================================

-- 1. Ensure public helper functions exist and have proper security definitions
CREATE OR REPLACE FUNCTION public.aks_hcd_current_role()
RETURNS TEXT 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.aks_hcd_current_lga()
RETURNS TEXT 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT lga_id FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- CRITICAL FIX: Grant EXECUTE on helper functions to anon, authenticated, and service_role
-- Without this, public queries to activities fail with PostgreSQL 42501 (permission denied for function aks_hcd_current_lga)
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_lga() TO anon, authenticated, service_role;

-- 2. Verify Table Schemas and Constraints
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('public', 'lga_admin', 'state_admin')),
  lga_id TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  lga_id TEXT NOT NULL,
  lga_name TEXT NOT NULL,
  title TEXT NOT NULL,
  pillar TEXT NOT NULL,
  sub_category TEXT,
  community TEXT,
  lat DOUBLE PRECISION DEFAULT 5.0377,
  lng DOUBLE PRECISION DEFAULT 7.9128,
  beneficiaries_total INTEGER DEFAULT 0 CHECK (beneficiaries_total >= 0),
  beneficiaries_male INTEGER DEFAULT 0 CHECK (beneficiaries_male >= 0),
  beneficiaries_female INTEGER DEFAULT 0 CHECK (beneficiaries_female >= 0),
  youth_beneficiaries INTEGER DEFAULT 0 CHECK (youth_beneficiaries >= 0),
  budget_ngn NUMERIC DEFAULT 0 CHECK (budget_ngn >= 0),
  start_date DATE,
  completion_date DATE,
  lead_officer TEXT,
  officer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED_DRAFT')),
  overall_progress INTEGER DEFAULT 0 CHECK (overall_progress >= 0 AND overall_progress <= 100),
  milestones JSONB DEFAULT '[]'::jsonb,
  media_assets JSONB DEFAULT '[]'::jsonb,
  submission_notes TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_demographic_balance CHECK (beneficiaries_male + beneficiaries_female = beneficiaries_total)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  activity_id TEXT,
  activity_title TEXT,
  lga_id TEXT,
  performed_by TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.ptr_test_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  test_vector TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  executed_by TEXT
);

-- 3. Enable Row Level Security (RLS) across all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptr_test_logs ENABLE ROW LEVEL SECURITY;

-- 4. User Profiles RLS Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.aks_hcd_current_role() = 'state_admin');

DROP POLICY IF EXISTS "State admins can insert or update user profiles" ON public.user_profiles;
CREATE POLICY "State admins can insert or update user profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin')
  WITH CHECK (public.aks_hcd_current_role() = 'state_admin');

-- 5. Activities RLS Policies
DROP POLICY IF EXISTS "Public can view published activities" ON public.activities;
CREATE POLICY "Public can view published activities" ON public.activities
  FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');

DROP POLICY IF EXISTS "State admins can view all activities" ON public.activities;
CREATE POLICY "State admins can view all activities" ON public.activities
  FOR SELECT TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin');

DROP POLICY IF EXISTS "LGA admins can view their assigned LGA activities" ON public.activities;
CREATE POLICY "LGA admins can view their assigned LGA activities" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.aks_hcd_current_role() = 'lga_admin' 
    AND lga_id = public.aks_hcd_current_lga()
  );

DROP POLICY IF EXISTS "LGA admins can insert activities for their LGA" ON public.activities;
CREATE POLICY "LGA admins can insert activities for their LGA" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.aks_hcd_current_role() = 'lga_admin' AND lga_id = public.aks_hcd_current_lga())
    OR public.aks_hcd_current_role() = 'state_admin'
  );

DROP POLICY IF EXISTS "LGA admins can update their draft activities" ON public.activities;
CREATE POLICY "LGA admins can update their draft activities" ON public.activities
  FOR UPDATE TO authenticated
  USING (
    (public.aks_hcd_current_role() = 'lga_admin' AND lga_id = public.aks_hcd_current_lga() AND status IN ('DRAFT', 'REJECTED_DRAFT', 'PENDING_APPROVAL'))
    OR public.aks_hcd_current_role() = 'state_admin'
  )
  WITH CHECK (
    (public.aks_hcd_current_role() = 'lga_admin' AND lga_id = public.aks_hcd_current_lga())
    OR public.aks_hcd_current_role() = 'state_admin'
  );

DROP POLICY IF EXISTS "State admins can update, approve, publish any activity" ON public.activities;
CREATE POLICY "State admins can update, approve, publish any activity" ON public.activities
  FOR ALL TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin')
  WITH CHECK (public.aks_hcd_current_role() = 'state_admin');

DROP POLICY IF EXISTS "State admins can delete activities" ON public.activities;
CREATE POLICY "State admins can delete activities" ON public.activities
  FOR DELETE TO authenticated
  USING (public.aks_hcd_current_role() = 'state_admin');

-- 6. Audit Logs RLS Policies
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read audit logs for their scope" ON public.audit_logs;
CREATE POLICY "Users can read audit logs for their scope" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.aks_hcd_current_role() = 'state_admin'
    OR (public.aks_hcd_current_role() = 'lga_admin' AND lga_id = public.aks_hcd_current_lga())
  );

-- 7. PTR Test Logs RLS Policies
DROP POLICY IF EXISTS "Authenticated users can read and insert ptr_test_logs" ON public.ptr_test_logs;
CREATE POLICY "Authenticated users can read and insert ptr_test_logs" ON public.ptr_test_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Enable Supabase Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- 9. Storage Bucket setup for private evidence vault
INSERT INTO storage.buckets (id, name, public)
VALUES ('hcd-evidence-vault', 'hcd-evidence-vault', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policies: LGA-scoped private evidence access
DROP POLICY IF EXISTS "Authenticated users can upload evidence to their LGA" ON storage.objects;
CREATE POLICY "Authenticated users can upload evidence to their LGA" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hcd-evidence-vault'
    AND (
      public.aks_hcd_current_role() = 'state_admin'
      OR (public.aks_hcd_current_role() = 'lga_admin' AND (storage.foldername(name))[1] = public.aks_hcd_current_lga())
    )
  );

DROP POLICY IF EXISTS "Users can read evidence in their LGA scope" ON storage.objects;
CREATE POLICY "Users can read evidence in their LGA scope" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hcd-evidence-vault'
    AND (
      public.aks_hcd_current_role() = 'state_admin'
      OR (public.aks_hcd_current_role() = 'lga_admin' AND (storage.foldername(name))[1] = public.aks_hcd_current_lga())
    )
  );
