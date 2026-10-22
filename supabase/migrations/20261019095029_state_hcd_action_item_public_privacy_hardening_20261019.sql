-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.
-- Do not expose internal responsible-person names or completion notes through
-- direct anonymous table access. Public transparency is provided through a
-- safe, published-only view with an explicit column allowlist.
DROP POLICY IF EXISTS state_hcd_action_items_read_published
  ON public.state_hcd_activity_action_items;
REVOKE SELECT ON public.state_hcd_activity_action_items FROM anon;

CREATE OR REPLACE VIEW public.state_hcd_public_action_items
WITH (security_barrier = true)
AS
SELECT
  ai.id,
  ai.activity_id,
  ai.action_title,
  ai.action_description,
  ai.responsible_institution,
  ai.due_date,
  ai.status,
  ai.created_at,
  ai.updated_at
FROM public.state_hcd_activity_action_items ai
JOIN public.state_hcd_activities a ON a.id = ai.activity_id
WHERE a.status = 'published';

GRANT SELECT ON public.state_hcd_public_action_items TO anon, authenticated;
COMMENT ON VIEW public.state_hcd_public_action_items IS
'Public-safe action items for published state-level HCD activities. Excludes responsible_person and internal completion_notes; underlying action-item table remains restricted to approved state administrators.';

