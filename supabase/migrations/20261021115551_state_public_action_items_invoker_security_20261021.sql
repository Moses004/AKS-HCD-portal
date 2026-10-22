-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Make the public action-item view explicitly invoker-security.
-- Anonymous callers receive column-level access only to fields intentionally exposed by the view.
ALTER VIEW public.state_hcd_public_action_items SET (security_invoker = true, security_barrier = true);

GRANT SELECT (
  id,
  activity_id,
  action_title,
  action_description,
  responsible_institution,
  due_date,
  status,
  created_at,
  updated_at
) ON public.state_hcd_activity_action_items TO anon, authenticated;

DROP POLICY IF EXISTS state_hcd_action_items_select_published_public ON public.state_hcd_activity_action_items;
CREATE POLICY state_hcd_action_items_select_published_public
ON public.state_hcd_activity_action_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.state_hcd_activities a
    WHERE a.id = state_hcd_activity_action_items.activity_id
      AND a.status = 'published'
  )
);

-- Keep the public view's exposed field list constrained; direct anonymous SELECT on
-- the base table is column-limited and RLS only allows rows for published activities.

