import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { HcdLogo } from '../common/Logos';
import {
  Mail,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigate: (route: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid official email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await requestPasswordReset(email.trim());
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to dispatch password recovery email.');
      } else {
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-[#F8F9FA]">
      <div className="w-full max-w-md">
        {/* Navigation Breadcrumb / Return */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/sign-in')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Sign In</span>
          </button>

          <button
            onClick={() => onNavigate('/')}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Public Portal
          </button>
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
                  Credential Recovery
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Recover Account Access
                </h1>
              </div>
            </div>
            <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
              Submit your official registered email address to receive password reset authorization.
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

            {successMessage ? (
              <div className="space-y-4 text-center py-2 animate-in fade-in">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">Recovery Dispatch Sent</h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    {successMessage}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-[11px] text-slate-600">
                  <p>
                    Please verify your official inbox and click the enclosed secure link. If you do not see the message within 3 minutes, check your spam or quarantine folder.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessMessage(null);
                      setErrorMessage(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Resend / Change Email
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-bold text-slate-800 mb-1">
                    Official Email Address <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. your.name@akwaibomstate.gov.ng"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:bg-emerald-700/60 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Dispatching Recovery Instructions...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                        <span>Transmit Password Recovery Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span>Remembered your password? </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="font-bold text-emerald-800 hover:text-emerald-950 underline ml-1 cursor-pointer"
                  >
                    Authenticate now
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
