import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
      return (import.meta as any).env[name];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process && process.env) {
      return process.env[name];
    }
  } catch {}
  return undefined;
};

// Fail closed unless the deployment explicitly configures the Supabase project.
// Keep the anon key public, but never embed a project URL or key as a fallback.
export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || '';
export const DEFAULT_SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || '';

// Local storage key for runtime anon key input if not supplied in build env
const RUNTIME_ANON_KEY_STORAGE = 'aks_hcd_supabase_anon_key';

// Circuit-breaker state to prevent repeated "TypeError: Failed to fetch" console spam when cloud host is unreachable
let unreachableSince = 0;
const UNREACHABLE_COOLDOWN_MS = 60_000; // 60 seconds cooldown before automatic retry

export const isSupabaseUnreachable = (): boolean => {
  if (unreachableSince === 0) return false;
  if (Date.now() - unreachableSince > UNREACHABLE_COOLDOWN_MS) {
    unreachableSince = 0;
    return false;
  }
  return true;
};

export const resetSupabaseReachability = (): void => {
  unreachableSince = 0;
};

const createSyntheticOfflineResponse = (): Response => {
  return new Response(
    JSON.stringify({
      code: 'NETWORK_UNREACHABLE',
      message: 'Cloud endpoint unreachable; operating with verified local dataset.',
      details: 'Network fetch failed or cloud instance paused',
      hint: '',
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  // Short-circuit background requests while circuit breaker cooldown is active
  if (isSupabaseUnreachable()) {
    return createSyntheticOfflineResponse();
  }

  try {
    const response = await fetch(input, init);
    // Successful HTTP connection means host is reachable
    unreachableSince = 0;
    return response;
  } catch {
    // Mark endpoint unreachable for cooldown window so subsequent queries don't spam Failed to fetch
    unreachableSince = Date.now();
    return createSyntheticOfflineResponse();
  }
};

export const getSupabaseAnonKey = (): string => {
  return (
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem(RUNTIME_ANON_KEY_STORAGE) : null) ||
    DEFAULT_SUPABASE_ANON_KEY
  );
};

export const setRuntimeAnonKey = (key: string): void => {
  if (typeof localStorage === 'undefined') return;
  resetSupabaseReachability();
  supabaseInstance = null;
  if (key) {
    localStorage.setItem(RUNTIME_ANON_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(RUNTIME_ANON_KEY_STORAGE);
  }
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const anonKey = getSupabaseAnonKey();
  if (!SUPABASE_URL || !anonKey) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: resilientSupabaseFetch,
        },
      });
    } catch (err) {
      console.debug('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
};

export const isSupabaseReady = (): boolean => {
  return Boolean(SUPABASE_URL && getSupabaseAnonKey());
};

// Safe diagnostic instructions referencing version-controlled database migrations
export const MIGRATION_GUIDE_INSTRUCTIONS = `-- AKS-HCD Enterprise Database Migrations
-- Database policies and schemas are strictly version-controlled in:
-- supabase/migrations/20261008_fix_security_and_grants.sql
--
-- Row Level Security (RLS) is strictly enforced:
-- - public.activities: Read published records (public); LGA sandboxed (lga_admin); State oversight (state_admin)
-- - public.audit_logs: Scoped by role; Append-only for authenticated actions
-- - public.ptr_test_logs: Authenticated execution only
-- - public.user_profiles: Authenticated read of own profile; Admin management
-- - Storage bucket: hcd-evidence-vault (Private, signed URLs only)
`;
