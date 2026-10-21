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

// Default to the provided Supabase project URL and anon public key
export const SUPABASE_URL = 
  getEnvVar('VITE_SUPABASE_URL') || 'https://refjawgovrmsyigtcfdl.supabase.co';

export const DEFAULT_SUPABASE_ANON_KEY = 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZmphd2dvdnJtc3lpZ3RjZmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODk4ODMsImV4cCI6MjEwNjk2NTg4M30.NJvqlQZVvfn8xfW_FimNWoKy-51Weu-35YqwB6EVBNs';

// Local storage key for runtime anon key input if not supplied in build env
const RUNTIME_ANON_KEY_STORAGE = 'aks_hcd_supabase_anon_key';

export const getSupabaseAnonKey = (): string => {
  return (
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem(RUNTIME_ANON_KEY_STORAGE) : null) ||
    DEFAULT_SUPABASE_ANON_KEY
  );
};

export const setRuntimeAnonKey = (key: string): void => {
  if (typeof localStorage === 'undefined') return;
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
      });
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
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
