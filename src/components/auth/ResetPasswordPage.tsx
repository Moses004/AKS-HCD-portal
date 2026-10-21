import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { HcdLogo } from '../common/Logos';
import {
  Lock,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  Circle,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (route: string) => void;
}

interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  const { resetPassword, isPasswordRecovery, signOut } = useAuth();

  // Form Inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Progress State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [sessionInvalidReason, setSessionInvalidReason] = useState<string>(
    'No active recovery session was detected. Password recovery links are time-limited and single-use.'
  );
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(5);

  // Evaluate Password Strength in Real-Time
  const passwordEvaluation = useMemo(() => {
    const requirements: PasswordRequirement[] = [
      {
        id: 'length',
        label: 'Minimum 8 characters (12+ recommended)',
        met: password.length >= 8,
      },
      {
        id: 'upper_lower',
        label: 'Both uppercase & lowercase letters',
        met: /[a-z]/.test(password) && /[A-Z]/.test(password),
      },
      {
        id: 'number',
        label: 'At least one numeric digit (0-9)',
        met: /[0-9]/.test(password),
      },
      {
        id: 'special',
        label: 'At least one special symbol (!@#$%^&*)',
        met: /[^a-zA-Z0-9]/.test(password),
      },
    ];

    const metCount = requirements.filter((r) => r.met).length;

    let scoreLabel = 'Too Short';
    let scoreBg = 'bg-slate-200';
    let badgeClass = 'text-slate-400 bg-slate-50 border-slate-200';
    let progressPercent = '15%';

    if (password.length > 0) {
      if (metCount <= 1) {
        scoreLabel = 'Weak';
        scoreBg = 'bg-rose-500';
        badgeClass = 'text-rose-700 bg-rose-50 border-rose-200';
        progressPercent = '25%';
      } else if (metCount === 2) {
        scoreLabel = 'Fair';
        scoreBg = 'bg-amber-500';
        badgeClass = 'text-amber-800 bg-amber-50 border-amber-200';
        progressPercent = '50%';
      } else if (metCount === 3) {
        scoreLabel = 'Good';
        scoreBg = 'bg-blue-600';
        badgeClass = 'text-blue-800 bg-blue-50 border-blue-200';
        progressPercent = '75%';
      } else {
        scoreLabel = 'Strong';
        scoreBg = 'bg-emerald-600';
        badgeClass = 'text-emerald-800 bg-emerald-50 border-emerald-200';
        progressPercent = '100%';
      }
    }

    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const canSubmit = password.length >= 8 && metCount >= 2 && passwordsMatch;

    return {
      requirements,
      metCount,
      scoreLabel,
      scoreBg,
      badgeClass,
      progressPercent,
      passwordsMatch,
      canSubmit,
    };
  }, [password, confirmPassword]);

  // Inspect Session and URL Parameters on Mount
  useEffect(() => {
    let isMounted = true;

    const inspectRecoveryLifecycle = async () => {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash || '';
      const search = window.location.search || '';

      // 1. Detect if Supabase returned an explicit error parameter in hash or query
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(search);
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');

      if (errorDesc || errorCode) {
        const decoded = decodeURIComponent(errorDesc || 'The password reset link has expired or is invalid.');
        if (isMounted) {
          setSessionInvalidReason(decoded);
          setSessionInvalid(true);
          setCheckingSession(false);
        }
        // Scrub sensitive fragments from visible address bar
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      // 2. Strip sensitive access tokens from the address bar immediately
      if (hash.includes('access_token') || hash.includes('type=recovery')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // 3. Verify Active Session with Supabase Client
      const client = getSupabaseClient();
      if (!client) {
        if (isMounted) {
          setSessionInvalidReason('State database connectivity is temporarily unreachable. Please retry shortly.');
          setSessionInvalid(true);
          setCheckingSession(false);
        }
        return;
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          if (isMounted) {
            setSessionInvalidReason(error.message || 'Recovery authorization link is expired or invalid.');
            setSessionInvalid(true);
            setCheckingSession(false);
          }
          return;
        }

        if (data?.session?.user) {
          if (isMounted) {
            setAccountEmail(data.session.user.email || '');
            setSessionInvalid(false);
            setCheckingSession(false);
          }
        } else if (isPasswordRecovery) {
          if (isMounted) {
            setSessionInvalid(false);
            setCheckingSession(false);
          }
        } else {
          // Allow a brief settling window for Supabase hash token exchange
          setTimeout(async () => {
            if (!isMounted) return;
            const retry = await client.auth.getSession();
            if (retry.data?.session?.user) {
              setAccountEmail(retry.data.session.user.email || '');
              setSessionInvalid(false);
            } else if (!isPasswordRecovery) {
              setSessionInvalidReason('No active recovery session was detected. Password reset links are time-limited (1 hour) and single-use.');
              setSessionInvalid(true);
            }
            setCheckingSession(false);
          }, 800);
        }
      } catch (err: any) {
        if (isMounted) {
          setSessionInvalidReason(err.message || 'Verification exception occurred.');
          setSessionInvalid(true);
          setCheckingSession(false);
        }
      }
    };

    inspectRecoveryLifecycle();

    return () => {
      isMounted = false;
    };
  }, [isPasswordRecovery]);

  // Success auto-redirect countdown
  useEffect(() => {
    if (!isSuccess) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onNavigate('/sign-in');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, onNavigate]);

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('New account password must be at least 8 characters long for security compliance.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match. Please re-enter identical passwords.');
      return;
    }

    if (passwordEvaluation.metCount < 2) {
      setErrorMessage('Please strengthen your password by including uppercase, lowercase, numbers, or symbols.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPassword(password);
      if (!res.success) {
        setErrorMessage(
          res.error || 'Password update rejected. The recovery session may have expired. Please request a new link.'
        );
      } else {
        // Log out the temporary recovery session for complete security quarantine
        try {
          await signOut();
        } catch {}
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during password update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-[#F8F9FA]">
      <div className="w-full max-w-lg">
        {/* Navigation Breadcrumb / Return */}
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/sign-in')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-950 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Official Sign In</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            AKS-HCD · Credential Security
          </span>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Header Banner with Akwa Ibom Forest & Gold Branding */}
          <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-3.5 mb-2">
              <div className="p-1.5 rounded-xl bg-white border border-[#D4AF37]/50 shadow-xs shrink-0">
                <HcdLogo className="w-8 h-8 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  Identity & Access Governance
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Set New Account Password
                </h1>
              </div>
            </div>
            <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
              Establish a new, authenticated password for your verified Akwa Ibom State Human Capital Development personnel account.
            </p>
          </div>

          {/* Form Content / State Handlers */}
          <div className="p-6 sm:p-8 space-y-5">
            {/* 1. CHECKING SESSION LOADER */}
            {checkingSession ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3.5 text-center animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-emerald-700 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verifying Recovery Authorization</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Inspecting cryptographic session tokens and link validity...
                  </p>
                </div>
              </div>
            ) : sessionInvalid ? (
              /* 2. INVALID OR EXPIRED RECOVERY LINK SCREEN */
              <div className="space-y-5 text-center py-3 animate-in fade-in duration-200">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 border-2 border-amber-200 flex items-center justify-center mx-auto shadow-xs">
                  <AlertCircle className="w-7 h-7 text-amber-600" />
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    Recovery Token Inactive or Expired
                  </span>
                  <h2 className="text-lg font-black text-slate-900">
                    Password Reset Authorization Unavailable
                  </h2>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    {sessionInvalidReason}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 text-slate-600">
                  <div className="font-bold text-slate-800">Security Guidelines:</div>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>Recovery links expire automatically after 60 minutes for government security compliance.</li>
                    <li>Each password reset link can only be used once.</li>
                    <li>If you submitted multiple requests, only the link in the most recent email is active.</li>
                  </ul>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('/forgot-password')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                    <span>Request New Recovery Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : isSuccess ? (
              /* 3. SUCCESSFUL PASSWORD UPDATE SCREEN */
              <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-9 h-9 text-emerald-700" />
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Identity Ledger Updated
                  </span>
                  <h2 className="text-xl font-black text-slate-900">
                    Password Successfully Updated
                  </h2>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                    Your official password has been securely updated in the Akwa Ibom State Human Capital Development identity repository.
                  </p>
                  {accountEmail && (
                    <div className="inline-block mt-1 px-3 py-1 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-700 font-bold border border-slate-200">
                      {accountEmail}
                    </div>
                  )}
                </div>

                {/* Security Advice Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Security Policy:</strong> For administrative audit compliance, temporary recovery access tokens have been safely terminated. Please authenticate with your new credentials.
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Official Sign-In</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono">
                      {countdown}s
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Public Home
                  </button>
                </div>
              </div>
            ) : (
              /* 4. ACTIVE PASSWORD RESET FORM */
              <>
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">{errorMessage}</div>
                  </div>
                )}

                {accountEmail && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs flex items-center justify-between">
                    <span className="text-emerald-900 font-medium">Updating Credentials for:</span>
                    <span className="font-mono font-bold text-emerald-950 text-[11px] truncate max-w-[200px]">
                      {accountEmail}
                    </span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="reset-pwd" className="block text-xs font-bold text-slate-800">
                        New Account Password <span className="text-rose-600">*</span>
                      </label>
                      {password.length > 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${passwordEvaluation.badgeClass}`}
                        >
                          Strength: {passwordEvaluation.scoreLabel}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-pwd"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                        aria-invalid={password.length > 0 && password.length < 8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Dynamic Password Strength Progress Bar */}
                    {password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${passwordEvaluation.scoreBg}`}
                            style={{ width: passwordEvaluation.progressPercent }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="reset-pwd-confirm" className="block text-xs font-bold text-slate-800">
                        Confirm New Password <span className="text-rose-600">*</span>
                      </label>
                      {confirmPassword.length > 0 && (
                        <span
                          className={`text-[10px] font-semibold flex items-center gap-1 ${
                            passwordEvaluation.passwordsMatch ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {passwordEvaluation.passwordsMatch ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Passwords Match</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span>Does not match</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-pwd-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type identical password"
                        className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                        aria-invalid={confirmPassword.length > 0 && !passwordEvaluation.passwordsMatch}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Real-Time Requirements Checklist */}
                  <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Credential Requirements:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {passwordEvaluation.requirements.map((req) => (
                        <div
                          key={req.id}
                          className={`flex items-center gap-1.5 transition-colors ${
                            req.met ? 'text-emerald-800 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {req.met ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          )}
                          <span className="text-[11px]">{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !passwordEvaluation.canSubmit}
                      className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Updating Security Credentials...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                          <span>Establish New Password & Secure Session</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-1 text-xs text-slate-500">
                    <span>Changed your mind? </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/sign-in')}
                      className="font-bold text-emerald-800 hover:text-emerald-950 underline ml-1 cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
