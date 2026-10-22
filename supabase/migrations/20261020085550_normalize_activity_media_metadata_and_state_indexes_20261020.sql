-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Normalize legacy activity media metadata: never persist expiring signed URLs as canonical image URLs.
UPDATE public.activities a
SET media_assets = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(m.value) = 'object' AND NULLIF(m.value->>'storagePath','') IS NOT NULL
        THEN (m.value - 'url') || jsonb_build_object('url', NULL)
      WHEN jsonb_typeof(m.value) = 'object'
        AND (m.value->>'url' LIKE '/src/%' OR m.value->>'url' LIKE 'data:%')
        THEN (m.value - 'url') || jsonb_build_object('url', NULL)
      ELSE m.value
    END
    ORDER BY m.ordinality
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(a.media_assets, '[]'::jsonb)) WITH ORDINALITY AS m(value, ordinality)
)
WHERE jsonb_typeof(COALESCE(a.media_assets, '[]'::jsonb)) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(a.media_assets, '[]'::jsonb)) m(value)
    WHERE jsonb_typeof(m.value) = 'object'
      AND (NULLIF(m.value->>'storagePath','') IS NOT NULL OR m.value->>'url' LIKE '/src/%' OR m.value->>'url' LIKE 'data:%')
  );

-- Cover user foreign keys flagged by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_state_hcd_activities_reviewed_by ON public.state_hcd_activities(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_state_hcd_activities_updated_by ON public.state_hcd_activities(updated_by);
CREATE INDEX IF NOT EXISTS idx_state_hcd_action_items_created_by ON public.state_hcd_activity_action_items(created_by);
CREATE INDEX IF NOT EXISTS idx_state_hcd_action_items_updated_by ON public.state_hcd_activity_action_items(updated_by);

