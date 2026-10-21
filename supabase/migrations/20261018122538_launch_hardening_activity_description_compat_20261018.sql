-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

-- Backward-compatible bridge while the frontend is being upgraded from sub_category to project_description.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS sub_category text;

CREATE OR REPLACE FUNCTION public.sync_activity_description_compat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.project_description := COALESCE(NULLIF(BTRIM(NEW.project_description), ''), NULLIF(BTRIM(NEW.sub_category), ''));
    NEW.sub_category := COALESCE(NULLIF(BTRIM(NEW.sub_category), ''), NULLIF(BTRIM(NEW.project_description), ''));
  ELSE
    IF NEW.project_description IS DISTINCT FROM OLD.project_description
       AND NEW.sub_category IS NOT DISTINCT FROM OLD.sub_category THEN
      NEW.sub_category := NEW.project_description;
    ELSIF NEW.sub_category IS DISTINCT FROM OLD.sub_category
       AND NEW.project_description IS NOT DISTINCT FROM OLD.project_description THEN
      NEW.project_description := NEW.sub_category;
    ELSE
      NEW.project_description := COALESCE(NULLIF(BTRIM(NEW.project_description), ''), NULLIF(BTRIM(NEW.sub_category), ''));
      NEW.sub_category := COALESCE(NULLIF(BTRIM(NEW.sub_category), ''), NULLIF(BTRIM(NEW.project_description), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_activity_description_compat ON public.activities;
CREATE TRIGGER trg_sync_activity_description_compat
BEFORE INSERT OR UPDATE OF project_description, sub_category
ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.sync_activity_description_compat();

COMMENT ON COLUMN public.activities.project_description IS
'Canonical description of the reported HCD project or intervention. Legacy sub_category is synchronized during frontend migration.';
COMMENT ON COLUMN public.activities.sub_category IS
'Deprecated compatibility field synchronized with project_description until all deployed clients are upgraded.';

