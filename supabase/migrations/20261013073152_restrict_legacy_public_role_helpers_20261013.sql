-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

REVOKE EXECUTE ON FUNCTION public.aks_hcd_current_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aks_hcd_current_lga() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_lga() TO service_role;

