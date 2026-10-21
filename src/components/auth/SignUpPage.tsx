import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ALL_31_LGAS } from '../../data/lgas';
import { HcdLogo } from '../common/Logos';
import {
  ShieldCheck,
  Building2,
  Mail,
  Lock,
  User,
  BadgeCheck,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SignUpPageProps {
  onNavigate: (route: string) => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigate }) => {
  const { signUp } = useAuth();

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [department, setDepartment] = useState('');
  const [requestedRole, setRequestedRole] = useState<'lga_admin' | 'state_admin'>('lga_admin');
  const [requestedLgaId, setRequestedLgaId] = useState<string>('uyo');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Validation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedRole, setSubmittedRole] = useState<'lga_admin' | 'state_admin'>('lga_admin');
  const [submittedLgaName, setSubmittedLgaName] = useState('');
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Official Full Name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid official government email address is required.');
      return;
    }

    if (!staffIdentifier.trim()) {
      setErrorMessage('Official Staff / Personnel Identifier is required for administrative verification.');
      return;
    }

    if (!department.trim()) {
      setErrorMessage('Official Directorate / Department is required.');
      return;
    }

    if (requestedRole === 'lga_admin' && !requestedLgaId) {
      setErrorMessage('Please select your assigned Local Government Area.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long for security compliance.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedLga = ALL_31_LGAS.find((l) => l.id === requestedLgaId);
      const chosenLgaId = requestedRole === 'lga_admin' ? requestedLgaId : null;

      const res = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        staffIdentifier: staffIdentifier.trim(),
        department: department.trim(),
        requestedRole,
        requestedLgaId: chosenLgaId,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration request could not be processed.');
      } else {
        setSubmittedEmail(email.trim());
        setSubmittedRole(requestedRole);
        setSubmittedLgaName(selectedLga?.name || '');
        setRequiresEmailConfirmation(!!res.requiresEmailConfirmation);
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-[#F8F9FA]">
      <div className="w-full max-w-xl">
        {/* Navigation Breadcrumb / Return */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Public Transparency Portal</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Akwa Ibom State · ARISE
          </span>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-emerald-500/10 pointer-events-none" />
            <div className="flex items-center gap-3.5 mb-2">
              <div className="p-1.5 rounded-xl bg-white border border-[#D4AF37]/50 shadow-xs shrink-0">
                <HcdLogo className="w-8 h-8 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  Official Personnel Enrollment
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Request Official Workspace Access
                </h1>
              </div>
            </div>
            <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
              Official registration for Local Government Area Desk Officers and State Executive Directorate personnel. All submissions undergo executive verification before workspace activation.
            </p>
          </div>

          {/* Form Content / Success Screen */}
          <div className="p-6 sm:p-8">
            {isSuccess ? (
              /* Post-Registration Explanation Screen */
              <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 border-2 border-amber-300 flex items-center justify-center mx-auto shadow-xs">
                  <Clock className="w-8 h-8 text-amber-700 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Access Request Logged · Pending Executive Review
                  </span>
                  <h2 className="text-xl font-black text-slate-900">
                    Application Awaiting Administrative Clearance
                  </h2>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you. Your official registration request for{' '}
                    <strong>
                      {submittedRole === 'state_admin'
                        ? 'State Executive Directorate'
                        : `LGA Desk Worker (${submittedLgaName} LGA)`}
                    </strong>{' '}
                    has been recorded in the state repository.
                  </p>
                </div>

                {/* Status Explanation Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-slate-700">
                      <strong>Security Policy:</strong> Operational workspace capabilities remain disabled until your staff credentials and assigned role are confirmed by the State Super-Administrator.
                    </div>
                  </div>

                  {requiresEmailConfirmation && (
                    <div className="flex items-start gap-2.5 border-t border-slate-200/80 pt-2.5">
                      <Mail className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <div className="text-slate-700">
                        <strong>Email Verification:</strong> A confirmation dispatch was transmitted to{' '}
                        <span className="font-mono text-slate-900 font-semibold">{submittedEmail}</span>. Please click the link enclosed in the email to verify account ownership.
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('/access-pending')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>Check Request Status</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                  >
                    Go to Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-medium"
                  >
                    Public Transparency Portal
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">{errorMessage}</div>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-bold text-slate-800 mb-1">
                    Official Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dr. Bassey Akpan"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Official Email */}
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-bold text-slate-800 mb-1">
                    Official Email Address <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. b.akpan@akwaibomstate.gov.ng"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Use your official government or institutional email address.
                  </p>
                </div>

                {/* Grid: Staff Identifier & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="reg-staff-id" className="block text-xs font-bold text-slate-800 mb-1">
                      Staff / Employee ID <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-staff-id"
                        type="text"
                        required
                        value={staffIdentifier}
                        onChange={(e) => setStaffIdentifier(e.target.value)}
                        placeholder="e.g. AKS-CIV-2024-884"
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-dept" className="block text-xs font-bold text-slate-800 mb-1">
                      Department / Directorate <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-dept"
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Community & Human Dev."
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Account-Request Dropdown */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label htmlFor="reg-role" className="block text-xs font-bold text-slate-800 mb-1">
                      Requested Official Capacity <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="reg-role"
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as 'lga_admin' | 'state_admin')}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      <option value="lga_admin">LGA Desk Worker</option>
                      <option value="state_admin">State Executive</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {requestedRole === 'lga_admin'
                        ? 'Enables field activity documentation and milestone logging for your assigned Local Council.'
                        : 'Enables statewide verification, quality assurance, report generation, and PTR oversight.'}
                    </p>
                  </div>

                  {/* Required LGA Dropdown when LGA Desk Worker is selected */}
                  {requestedRole === 'lga_admin' && (
                    <div className="animate-in fade-in duration-150 pt-2 border-t border-slate-200">
                      <label htmlFor="reg-lga" className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                        <span>Assigned Local Government Area <span className="text-rose-600">*</span></span>
                        <span className="text-[10px] text-emerald-800 font-semibold">31 LGAs Canonical</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          id="reg-lga"
                          required
                          value={requestedLgaId}
                          onChange={(e) => setRequestedLgaId(e.target.value)}
                          className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        >
                          {ALL_31_LGAS.map((lga) => (
                            <option key={lga.id} value={lga.id}>
                              {lga.name} LGA ({lga.senatorialDistrict.split(' ')[0]})
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Select the council where you serve as designated Human Capital Development officer.
                      </p>
                    </div>
                  )}
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="reg-pwd" className="block text-xs font-bold text-slate-800 mb-1">
                      Account Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-pwd"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-pwd-confirm" className="block text-xs font-bold text-slate-800 mb-1">
                      Confirm Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-pwd-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                        className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:bg-emerald-700/60 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Transmitting Official Request...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                        <span>Submit Official Access Request</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Footer Switcher */}
                <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span>Already hold an active official account? </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/sign-in')}
                    className="font-bold text-emerald-800 hover:text-emerald-950 underline ml-1 cursor-pointer"
                  >
                    Authenticate here
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
