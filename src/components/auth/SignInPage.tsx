import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { HcdLogo } from '../common/Logos';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Building2,
  FileText,
} from 'lucide-react';

interface SignInPageProps {
  onNavigate: (route: string) => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onNavigate }) => {
  const { signIn, currentUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both official email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signIn(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication rejected. Verify official credentials.');
      } else {
        setSuccessMessage('Identity verified. Routing to appropriate workspace...');
        // Brief moment to allow state to settle
        setTimeout(() => {
          const user = res.user || currentUser;
          if (user.role === 'state_admin' && user.isPrivileged) {
            onNavigate('/executive');
          } else if (user.role === 'lga_admin' && user.isPrivileged) {
            onNavigate('/lga');
          } else {
            onNavigate('/access-pending');
          }
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication service error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-[#F8F9FA]">
      <div className="w-full max-w-md">
        {/* Navigation Breadcrumb / Return to Portal */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Public Transparency Portal</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Official Portal
          </span>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-3.5 mb-2">
              <div className="p-1.5 rounded-xl bg-white border border-[#D4AF37]/50 shadow-xs shrink-0">
                <HcdLogo className="w-8 h-8 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  Government Secure Sign-In
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Personnel Authentication
                </h1>
              </div>
            </div>
            <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
              Access the official Akwa Ibom State Human Capital Development operational management console.
            </p>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-7 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>{successMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Official Email */}
              <div>
                <label htmlFor="signin-email" className="block text-xs font-bold text-slate-800 mb-1">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="official.name@akwaibomstate.gov.ng"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="signin-password" className="block text-xs font-bold text-slate-800">
                    Account Password
                  </label>
                  <button
                    type="button"
                    onClick={() => onNavigate('/forgot-password')}
                    className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter official password"
                    className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:bg-emerald-700/60 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      <span>Authenticate Secure Session</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Registration Promotion */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Do not have an authorized account?
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Local Government Area Desk Officers and State Executive Directorate personnel can submit a registration request.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/sign-up')}
                className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-emerald-900 border border-emerald-700/30 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Request Official Workspace Access
              </button>
            </div>

            {/* Public Portal Info */}
            <div className="text-center pt-2 text-xs text-slate-500">
              <p>
                Civil Society Observers and Citizens do not require authentication.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="font-bold text-emerald-800 hover:text-emerald-950 underline ml-0.5 cursor-pointer"
                >
                  Browse Public Transparency Portal
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
