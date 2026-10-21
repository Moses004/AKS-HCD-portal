import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserSession, Role, ApprovalStatus } from '../types';
import { ALL_31_LGAS, getLgaById } from '../data/lgas';
import { getSupabaseClient } from '../lib/supabase';

export interface SignUpParams {
  fullName: string;
  email: string;
  password: string;
  staffIdentifier: string;
  department: string;
  requestedRole: 'lga_admin' | 'state_admin';
  requestedLgaId: string | null;
}

export interface ReviewRequestParams {
  userId: string;
  decision: 'approve' | 'reject' | 'suspend';
  approvedRole: 'lga_admin' | 'state_admin' | null;
  approvedLgaId: string | null;
  notes?: string;
}

interface AuthContextType {
  currentUser: UserSession;
  authLoading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; user?: UserSession; error?: string }>;
  signUp: (params: SignUpParams) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  resetPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  reviewAccessRequest: (params: ReviewRequestParams) => Promise<{ success: boolean; error?: string }>;
  canAccessLga: (lgaId: string) => boolean;
  assertTenantAccess: (targetLgaId: string) => { allowed: boolean; error?: string };
  switchLga: (lgaId: string) => void;
  isSimulatedOffline: boolean;
  toggleOfflineSimulation: () => void;
}

const PUBLIC_GUEST_USER: UserSession = {
  id: 'usr-public-guest',
  name: 'Public Citizen / Civil Society Observer',
  email: 'citizen@akwaibomstate.gov.ng',
  role: 'public',
  isAuthenticated: false,
  isPrivileged: false,
  profileStatus: 'active',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Always initialize as unauthenticated public citizen - never trust local storage as proof of identity!
  const [currentUser, setCurrentUser] = useState<UserSession>(PUBLIC_GUEST_USER);

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return hash.includes('type=recovery') || search.includes('type=recovery');
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    return localStorage.getItem('aks_hcd_simulated_offline') === 'true';
  });

  // Restore and sync Supabase Auth session on component mount
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setAuthLoading(false);
      return;
    }

    // Clean up sensitive reset-tokens from URL hash to avoid leaking into browser history
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.includes('access_token') || window.location.hash.includes('type=recovery')) {
        setIsPasswordRecovery(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    const initAuth = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.debug('Supabase getSession notice:', error.message);
          setCurrentUser(PUBLIC_GUEST_USER);
        } else if (data?.session?.user) {
          await loadUserProfile(data.session.user);
        } else {
          setCurrentUser(PUBLIC_GUEST_USER);
        }
      } catch (err) {
        console.debug('Notice during Supabase session restoration:', err);
        setCurrentUser(PUBLIC_GUEST_USER);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    // Listen to real-time auth state changes (sign in, sign out, token refresh, password recovery)
    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        // Strip sensitive access token fragments immediately
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        setAuthLoading(true);
        await loadUserProfile(session.user);
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(PUBLIC_GUEST_USER);
        setIsPasswordRecovery(false);
        setAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        await loadUserProfile(session.user);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch verified user profile strictly from public.user_profiles table
  // The database profile is the only source of truth for approved role, active status, approval status, and assigned LGA.
  const loadUserProfile = async (supabaseUser: any): Promise<UserSession> => {
    const client = getSupabaseClient();
    if (!client) return PUBLIC_GUEST_USER;

    try {
      const { data: profile, error } = await client
        .from('user_profiles')
        .select('user_id, display_name, staff_identifier, department, role, lga_id, requested_role, requested_lga_id, approval_status, active, approved_by, approved_at, created_at, updated_at')
        .eq('user_id', supabaseUser.id)
        .single();

      if (error || !profile) {
        // Missing profile: Fail closed! Strictly default to unprivileged public role!
        // Never grant administrative privileges based on email substring or heuristics
        const unassignedUser: UserSession = {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'Authenticated User',
          email: supabaseUser.email || '',
          role: 'public',
          department: 'Public Observer (Awaiting Official Administrative Profile Provisioning)',
          staffIdentifier: supabaseUser.user_metadata?.staff_identifier,
          requestedRole: supabaseUser.user_metadata?.requested_role as Role,
          requestedLgaId: supabaseUser.user_metadata?.requested_lga_id,
          approvalStatus: 'pending',
          isActive: false,
          isAuthenticated: true,
          isPrivileged: false,
          profileStatus: 'missing',
          lastSignInAt: supabaseUser.last_sign_in_at || new Date().toISOString(),
        };
        setCurrentUser(unassignedUser);
        return unassignedUser;
      }

      const approvalStatus = (profile.approval_status as ApprovalStatus) || 'pending';
      const isActive = profile.active === true;
      const assignedRole = (profile.role as Role) || 'public';
      const assignedLgaId = profile.lga_id || undefined;
      const assignedLga = assignedLgaId ? getLgaById(assignedLgaId) : undefined;

      // ELIGIBLE FOR PRIVILEGED WORKSPACE ONLY WHEN DATABASE PROFILE IS APPROVED AND ACTIVE AND NOT IN RECOVERY MODE:
      const isApprovedAndActive = isActive && approvalStatus === 'approved';
      const isPrivileged = !isPasswordRecovery && isApprovedAndActive && (assignedRole === 'lga_admin' || assignedRole === 'state_admin');
      const effectiveRole: Role = isPrivileged ? assignedRole : 'public';
      const effectiveLgaId = (isPrivileged && assignedRole === 'lga_admin') ? assignedLgaId : undefined;

      let profileStatus: UserSession['profileStatus'] = 'pending';
      if (!isActive) {
        profileStatus = 'inactive';
      } else if (approvalStatus === 'approved') {
        profileStatus = 'active';
      } else if (approvalStatus === 'rejected') {
        profileStatus = 'rejected';
      } else if (approvalStatus === 'suspended') {
        profileStatus = 'suspended';
      } else {
        profileStatus = 'pending';
      }

      const verifiedUser: UserSession = {
        id: supabaseUser.id,
        name: profile.display_name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'State Personnel',
        email: supabaseUser.email || '',
        role: effectiveRole,
        assignedLgaId: effectiveLgaId,
        assignedLgaName: effectiveRole === 'lga_admin' ? assignedLga?.name : undefined,
        department:
          profile.department ||
          (effectiveRole === 'state_admin'
            ? "Governor's Cabinet & State HCD Council"
            : `${assignedLga?.name || 'LGA'} Secretariat`),
        staffIdentifier: profile.staff_identifier,
        requestedRole: profile.requested_role as Role,
        requestedLgaId: profile.requested_lga_id,
        approvalStatus,
        isActive,
        isAuthenticated: true,
        isPrivileged,
        profileStatus,
        lastSignInAt: supabaseUser.last_sign_in_at || new Date().toISOString(),
      };

      setCurrentUser(verifiedUser);
      return verifiedUser;
    } catch (err) {
      console.warn('Error fetching user_profile:', err);
      const fallbackUser: UserSession = {
        id: supabaseUser.id,
        name: supabaseUser.email || 'Authenticated User',
        email: supabaseUser.email || '',
        role: 'public',
        department: 'Profile Inspection Error',
        isAuthenticated: true,
        isPrivileged: false,
        profileStatus: 'missing',
      };
      setCurrentUser(fallbackUser);
      return fallbackUser;
    }
  };

  const refreshProfile = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.user) {
        await loadUserProfile(data.session.user);
      }
    } catch (err) {
      console.warn('Error refreshing profile:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('aks_hcd_simulated_offline', String(isSimulatedOffline));
  }, [isSimulatedOffline]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; user?: UserSession; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database client is not available.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const loadedUser = await loadUserProfile(data.user);
        return { success: true, user: loadedUser };
      }

      return { success: false, error: 'No user session returned.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication failed.' };
    }
  };

  // Submit registration through Supabase Auth (auth.signUp)
  // Never insert or update user_profiles directly from the browser - the DB trigger handles it
  const signUp = async (params: SignUpParams): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database service unavailable.' };
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            display_name: params.fullName.trim(),
            requested_role: params.requestedRole,
            requested_lga_id: params.requestedLgaId,
            staff_identifier: params.staffIdentifier.trim(),
            department: params.department.trim(),
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return {
          success: false,
          error: 'An account with this official email address already exists. Please sign in or reset your password.',
        };
      }

      const requiresEmailConfirmation = !data.session;
      return { success: true, requiresEmailConfirmation };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Sign out exception:', err);
      }
    }
    setCurrentUser(PUBLIC_GUEST_USER);
    localStorage.removeItem('aks_hcd_current_user');
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: '', error: 'Database connection unavailable.' };
    }

    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, message: '', error: error.message };
      }

      return {
        success: true,
        message: `Password recovery dispatch sent to ${email}. Please inspect your official inbox.`,
      };
    } catch (err: any) {
      return { success: false, message: '', error: err.message || 'Recovery request failed.' };
    }
  };

  const resetPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database connection unavailable.' };
    }

    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        return { success: false, error: error.message };
      }
      setIsPasswordRecovery(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password update failed.' };
    }
  };

  // State Executive Access-Request Review via backend RPC
  const reviewAccessRequest = async (params: ReviewRequestParams): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database client not available.' };
    }

    // Client-side guard for usability: must be state_admin & isPrivileged
    if (currentUser.role !== 'state_admin' || !currentUser.isPrivileged) {
      return { success: false, error: 'Unauthorized: Only an approved, active State Executive may review access requests.' };
    }

    try {
      const { error } = await client.rpc('review_hcd_access_request', {
        p_user_id: params.userId,
        p_decision: params.decision,
        p_approved_role: params.approvedRole,
        p_approved_lga_id: params.approvedLgaId,
        p_notes: params.notes || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Review request failed.' };
    }
  };

  // LGA Desk Worker CANNOT change their assigned LGA by frontend state
  const switchLga = (lgaId: string) => {
    if (currentUser.role === 'lga_admin') {
      return; // Strictly locked to assigned LGA!
    }

    // State Super-Admin has state-wide jurisdiction to switch view to any LGA
    if (currentUser.role === 'state_admin' && currentUser.isPrivileged) {
      const targetLga = getLgaById(lgaId);
      if (!targetLga) return;
      setCurrentUser((prev) => ({
        ...prev,
        assignedLgaId: targetLga.id,
        assignedLgaName: targetLga.name,
      }));
    }
  };

  const canAccessLga = (lgaId: string): boolean => {
    if (currentUser.role === 'state_admin' && currentUser.isPrivileged) return true;
    if (currentUser.role === 'lga_admin' && currentUser.isPrivileged) return currentUser.assignedLgaId === lgaId;
    return false;
  };

  const assertTenantAccess = (targetLgaId: string): { allowed: boolean; error?: string } => {
    if (currentUser.role === 'state_admin' && currentUser.isPrivileged) {
      return { allowed: true };
    }
    if (currentUser.role === 'lga_admin' && currentUser.isPrivileged) {
      if (currentUser.assignedLgaId === targetLgaId) {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: `Cross-Tenant Access Violation: You are authorized for [${currentUser.assignedLgaName || currentUser.assignedLgaId?.toUpperCase()} LGA], but requested action on [${targetLgaId.toUpperCase()} LGA].`,
      };
    }
    return {
      allowed: false,
      error: 'Unauthorized: Operational workspace actions require an approved and active administrative profile.',
    };
  };

  const toggleOfflineSimulation = () => {
    setIsSimulatedOffline((prev) => !prev);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authLoading,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        resetPassword,
        refreshProfile,
        reviewAccessRequest,
        canAccessLga,
        assertTenantAccess,
        switchLga,
        isSimulatedOffline,
        toggleOfflineSimulation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
