-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
-- State-level activity reporting is intentionally separate from LGA activities:
-- public.activities.lga_id and its existing RLS workflow remain unchanged.
-- Access is restricted to approved active state_admin users, with public read
-- access only after an activity is published.

CREATE TABLE IF NOT EXISTS public.state_hcd_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_code text UNIQUE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
  category text NOT NULL CHECK (category IN (
    'monitoring_evaluation',
    'partnerships_stakeholder_engagement',
    'national_level_engagements',
    'state_hcd_council_meetings',
    'state_hcd_working_group_activities',
    'other_state_level_initiatives'
  )),
  activity_date date NOT NULL,
  activity_end_date date,
  location text,
  lead_institution text NOT NULL,
  lead_unit text,
  participating_stakeholders jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(participating_stakeholders) = 'array'),
  description text NOT NULL CHECK (length(btrim(description)) >= 10),
  key_outcomes text,
  decisions_resolutions text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','published','rejected_draft','archived')),
  submission_notes text,
  rejection_reason text,
  evidence_files jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_files) = 'array'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (activity_end_date IS NULL OR activity_end_date >= activity_date),
  CHECK ((status <> 'published') OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.state_hcd_activity_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.state_hcd_activities(id) ON DELETE CASCADE,
  action_title text NOT NULL CHECK (length(btrim(action_title)) BETWEEN 3 AND 240),
  action_description text,
  responsible_institution text,
  responsible_person text,
  due_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','cancelled')),
  completion_notes text,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'completed') OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_state_hcd_activities_date
  ON public.state_hcd_activities (activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_hcd_activities_category_status
  ON public.state_hcd_activities (category, status, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_hcd_activities_created_by
  ON public.state_hcd_activities (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_state_hcd_action_items_activity
  ON public.state_hcd_activity_action_items (activity_id, status, due_date);

ALTER TABLE public.state_hcd_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_hcd_activity_action_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.state_hcd_activities FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.state_hcd_activity_action_items FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.state_hcd_activities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.state_hcd_activities TO authenticated;
GRANT SELECT ON TABLE public.state_hcd_activity_action_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.state_hcd_activity_action_items TO authenticated;

DROP POLICY IF EXISTS state_hcd_activities_read_published ON public.state_hcd_activities;
CREATE POLICY state_hcd_activities_read_published
  ON public.state_hcd_activities FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS state_hcd_activities_select_state_admin ON public.state_hcd_activities;
CREATE POLICY state_hcd_activities_select_state_admin
  ON public.state_hcd_activities FOR SELECT TO authenticated
  USING ((SELECT private.aks_hcd_current_role()) = 'state_admin');

DROP POLICY IF EXISTS state_hcd_activities_insert_state_admin ON public.state_hcd_activities;
CREATE POLICY state_hcd_activities_insert_state_admin
  ON public.state_hcd_activities FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.aks_hcd_current_role()) = 'state_admin'
    AND created_by = (SELECT auth.uid())
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
    AND status IN ('draft','pending_approval')
  );

DROP POLICY IF EXISTS state_hcd_activities_update_state_admin ON public.state_hcd_activities;
CREATE POLICY state_hcd_activities_update_state_admin
  ON public.state_hcd_activities FOR UPDATE TO authenticated
  USING ((SELECT private.aks_hcd_current_role()) = 'state_admin')
  WITH CHECK (
    (SELECT private.aks_hcd_current_role()) = 'state_admin'
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS state_hcd_activities_delete_state_admin_drafts ON public.state_hcd_activities;
CREATE POLICY state_hcd_activities_delete_state_admin_drafts
  ON public.state_hcd_activities FOR DELETE TO authenticated
  USING (
    (SELECT private.aks_hcd_current_role()) = 'state_admin'
    AND status IN ('draft','rejected_draft')
  );

DROP POLICY IF EXISTS state_hcd_action_items_read_published ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_read_published
  ON public.state_hcd_activity_action_items FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.state_hcd_activities a
      WHERE a.id = state_hcd_activity_action_items.activity_id
        AND a.status = 'published'
    )
  );

DROP POLICY IF EXISTS state_hcd_action_items_select_state_admin ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_select_state_admin
  ON public.state_hcd_activity_action_items FOR SELECT TO authenticated
  USING ((SELECT private.aks_hcd_current_role()) = 'state_admin');

DROP POLICY IF EXISTS state_hcd_action_items_insert_state_admin ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_insert_state_admin
  ON public.state_hcd_activity_action_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.aks_hcd_current_role()) = 'state_admin'
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.state_hcd_activities a
      WHERE a.id = state_hcd_activity_action_items.activity_id
    )
  );

DROP POLICY IF EXISTS state_hcd_action_items_update_state_admin ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_update_state_admin
  ON public.state_hcd_activity_action_items FOR UPDATE TO authenticated
  USING ((SELECT private.aks_hcd_current_role()) = 'state_admin')
  WITH CHECK (
    (SELECT private.aks_hcd_current_role()) = 'state_admin'
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.state_hcd_activities a
      WHERE a.id = state_hcd_activity_action_items.activity_id
    )
  );

DROP POLICY IF EXISTS state_hcd_action_items_delete_state_admin ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_delete_state_admin
  ON public.state_hcd_activity_action_items FOR DELETE TO authenticated
  USING ((SELECT private.aks_hcd_current_role()) = 'state_admin');

CREATE OR REPLACE FUNCTION public.set_state_hcd_activity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'state_hcd_activities' THEN
    IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
      NEW.published_at := COALESCE(NEW.published_at, now());
      NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
      NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    END IF;
  ELSIF TG_TABLE_NAME = 'state_hcd_activity_action_items' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF NEW.status <> 'completed' THEN
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_state_hcd_activities_updated_at ON public.state_hcd_activities;
CREATE TRIGGER trg_state_hcd_activities_updated_at
  BEFORE UPDATE ON public.state_hcd_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_state_hcd_activity_updated_at();

DROP TRIGGER IF EXISTS trg_state_hcd_action_items_updated_at ON public.state_hcd_activity_action_items;
CREATE TRIGGER trg_state_hcd_action_items_updated_at
  BEFORE UPDATE ON public.state_hcd_activity_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_state_hcd_activity_updated_at();

COMMENT ON TABLE public.state_hcd_activities IS
'State-level HCD coordination, monitoring, partnership, governance, and engagement activity register. Separate from LGA-scoped public.activities. Only approved active state_admin users can manage records; public can read published records.';
COMMENT ON COLUMN public.state_hcd_activities.evidence_files IS
'Array of evidence metadata including private storage object paths, original file name, MIME type, size, and upload timestamp. Never store public URLs for private evidence.';
COMMENT ON TABLE public.state_hcd_activity_action_items IS
'Normalized action-point register for state-level HCD activities, with responsibility, due dates, status, and completion tracking.';

-- Allow state admins to upload into the dedicated state-level/ prefix in the existing private bucket,
-- while preserving LGA users' strict first-folder-segment LGA isolation.
DROP POLICY IF EXISTS hcd_evidence_insert_scoped ON storage.objects;
CREATE POLICY hcd_evidence_insert_scoped
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hcd-evidence-vault'
  AND (
    (
      (SELECT private.aks_hcd_current_role()) = 'state_admin'
      AND (storage.foldername(name))[1] = 'state-level'
    )
    OR
    (
      (SELECT private.aks_hcd_current_role()) = 'lga_admin'
      AND (storage.foldername(name))[1] = (SELECT private.aks_hcd_current_lga())
    )
  )
);

COMMENT ON POLICY hcd_evidence_insert_scoped ON storage.objects IS
'Private HCD evidence uploads: approved state admins may upload only under state-level/; approved LGA admins may upload only under their own LGA folder.';

