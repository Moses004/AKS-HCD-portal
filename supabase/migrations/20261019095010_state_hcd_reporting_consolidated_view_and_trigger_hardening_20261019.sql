-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
-- Safe, RLS-respecting overview for dashboards that need to summarize both
-- governance levels without merging their transactional data models.
CREATE OR REPLACE VIEW public.hcd_activity_reporting_overview
WITH (security_invoker = true)
AS
SELECT
  'lga'::text AS reporting_level,
  a.id::text AS activity_id,
  a.title,
  COALESCE(a.start_date, a.created_at::date) AS activity_date,
  COALESCE(a.category, a.pillar) AS activity_category,
  a.pillar AS pillar_code,
  a.lga_id,
  a.lga_name,
  a.community AS location,
  a.status AS activity_status,
  a.project_description AS activity_description,
  a.beneficiaries_total,
  a.budget_ngn,
  a.overall_progress,
  a.created_at,
  a.updated_at
FROM public.activities a
UNION ALL
SELECT
  'state'::text AS reporting_level,
  s.id::text AS activity_id,
  s.title,
  s.activity_date,
  s.category AS activity_category,
  NULL::text AS pillar_code,
  NULL::text AS lga_id,
  'Akwa Ibom State'::text AS lga_name,
  s.location,
  s.status AS activity_status,
  s.description AS activity_description,
  NULL::integer AS beneficiaries_total,
  NULL::numeric AS budget_ngn,
  NULL::integer AS overall_progress,
  s.created_at,
  s.updated_at
FROM public.state_hcd_activities s;

GRANT SELECT ON public.hcd_activity_reporting_overview TO anon, authenticated;
COMMENT ON VIEW public.hcd_activity_reporting_overview IS
'RLS-respecting consolidated overview of LGA and state-level HCD activities. This is a read model only; writes must use the underlying level-specific tables and workflows.';

-- Ensure action items inserted as completed get a completion timestamp and
-- clear the timestamp if reopened. The shared trigger safely handles INSERT.
CREATE OR REPLACE FUNCTION public.set_state_hcd_activity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();

  IF TG_TABLE_NAME = 'state_hcd_activities' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'published'
       AND OLD.status IS DISTINCT FROM 'published' THEN
      NEW.published_at := COALESCE(NEW.published_at, now());
      NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
      NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    END IF;
  ELSIF TG_TABLE_NAME = 'state_hcd_activity_action_items' THEN
    IF NEW.status = 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      NEW.completed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_state_hcd_action_items_updated_at ON public.state_hcd_activity_action_items;
CREATE TRIGGER trg_state_hcd_action_items_updated_at
  BEFORE INSERT OR UPDATE ON public.state_hcd_activity_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_state_hcd_activity_updated_at();

