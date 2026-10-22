-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
-- Remove any inherited/default table and view privileges, then grant only
-- the operations explicitly required by the portal.
REVOKE ALL ON TABLE public.state_hcd_activities
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.state_hcd_activity_action_items
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hcd_activity_reporting_overview
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.state_hcd_public_action_items
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.state_hcd_activities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.state_hcd_activities TO authenticated;

GRANT SELECT ON TABLE public.state_hcd_activity_action_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.state_hcd_activity_action_items TO authenticated;

GRANT SELECT ON TABLE public.hcd_activity_reporting_overview TO anon, authenticated;
GRANT SELECT ON TABLE public.state_hcd_public_action_items TO anon, authenticated;

