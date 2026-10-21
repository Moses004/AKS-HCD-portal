import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLgaById } from '../../data/lgas';
import { HcdLogo } from '../common/Logos';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  LogOut,
  Building2,
  User,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  ArrowLeft,
  Mail,
  CheckCircle2,
} from 'lucide-react';

interface AccessPendingPageProps {
  onNavigate: (route: string) => void;
}

export const AccessPendingPage: React.FC<AccessPendingPageProps> = ({ onNavigate }) => {
  const { currentUser, refreshProfile, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await refreshProfile();
      setRefreshMessage('Profile status refreshed from cloud repository.');
      setTimeout(() => setRefreshMessage(null), 3500);
    } catch {
      setRefreshMessage('Failed to refresh status.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onNavigate('/');
  };

  const requestedLga = currentUser.requestedLgaId ? getLgaById(currentUser.requestedLgaId) : undefined;
  const status = currentUser.profileStatus || 'pending';

  return (
    <div className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-[#F8F9FA]">
      <div className="w-full max-w-xl">
        {/* Navigation Breadcrumb / Return */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Public Transparency Portal</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Clearance Status
          </span>
        </div>

        {/* Main Status Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-3.5 mb-2">
              <div className="p-1.5 rounded-xl bg-white border border-[#D4AF37]/50 shadow-xs shrink-0">
                <HcdLogo className="w-8 h-8 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  Official Clearance Gateway
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Personnel Authorization Status
                </h1>
              </div>
            </div>
            <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
              Akwa Ibom State Human Capital Development platform requires verified role clearance for operational workspaces.
            </p>
          </div>

          {/* Status Details */}
          <div className="p-6 sm:p-8 space-y-6">
            {refreshMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{refreshMessage}</span>
              </div>
            )}

            {/* Status Type Card */}
            {status === 'active' && currentUser.isPrivileged && (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-200/60 text-emerald-900 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 inline-block mb-1">
                      Status: Official Clearance Granted
                    </span>
                    <h2 className="text-base font-bold text-emerald-950">
                      Account Approved & Active
                    </h2>
                    <p className="text-xs text-emerald-900/90 leading-relaxed">
                      Your clearance has been approved. You have full access to your assigned operational workspace.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => onNavigate(currentUser.role === 'state_admin' ? '/executive' : '/lga')}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Enter {currentUser.role === 'state_admin' ? 'State Executive Console' : 'LGA Desk Workspace'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === 'pending' && (
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-200/60 text-amber-900 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 inline-block mb-1">
                      Status: Pending Executive Review
                    </span>
                    <h2 className="text-base font-bold text-amber-950">
                      Authorization Request Under Review
                    </h2>
                    <p className="text-xs text-amber-900/90 leading-relaxed">
                      Your application has been received and queued in the State Executive Directorate review roster. For data integrity and statutory oversight, operational workspaces remain locked until authorized by a verified State Super-Administrator.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="p-5 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-200/60 text-rose-900 shrink-0 mt-0.5">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300 inline-block mb-1">
                      Status: Authorization Not Granted
                    </span>
                    <h2 className="text-base font-bold text-rose-950">
                      Application Was Not Approved
                    </h2>
                    <p className="text-xs text-rose-900/90 leading-relaxed">
                      Your request for privileged workspace access was reviewed and could not be approved at this time. Please confer with your Local Government Council Head of Service or the Directorate of Human Capital Development Secretariat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'suspended' && (
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-200 text-slate-800 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 inline-block mb-1">
                      Status: Account Access Suspended
                    </span>
                    <h2 className="text-base font-bold text-slate-950">
                      Administrative Privileges Suspended
                    </h2>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Operational privileges on this personnel account have been temporarily suspended by executive directive. Contact the State Super-Administrator to request reactivation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(status === 'missing' || status === 'inactive') && (
              <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-200/60 text-blue-900 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-200 text-blue-900 border border-blue-300 inline-block mb-1">
                      Status: Profile Unassigned
                    </span>
                    <h2 className="text-base font-bold text-blue-950">
                      Administrative Profile Pending Provisioning
                    </h2>
                    <p className="text-xs text-blue-900/90 leading-relaxed">
                      You are authenticated, but no active administrative profile record was located in the official state database. Operational access requires a provisioned profile row.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Applicant Details Roster Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <span className="text-xs font-bold text-slate-800 block uppercase tracking-wider border-b border-slate-200 pb-2">
                Recorded Personnel Request Profile
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Applicant Name</span>
                  <strong className="text-slate-900 font-semibold">{currentUser.name || 'N/A'}</strong>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Official Email</span>
                  <span className="font-mono text-slate-900">{currentUser.email || 'N/A'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Staff Identifier</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {currentUser.staffIdentifier || 'Pending documentation'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Department / Directorate</span>
                  <span className="text-slate-900">{currentUser.department || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Requested Capacity</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-950">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                    {currentUser.requestedRole === 'state_admin'
                      ? 'State Executive Directorate'
                      : currentUser.requestedRole === 'lga_admin'
                      ? 'LGA Desk Worker'
                      : 'Public Reviewer'}
                  </span>
                </div>

                {currentUser.requestedRole === 'lga_admin' && (
                  <div>
                    <span className="text-[11px] text-slate-500 block">Requested LGA Jurisdiction</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-950">
                      <Building2 className="w-3.5 h-3.5 text-emerald-800" />
                      {requestedLga ? `${requestedLga.name} LGA` : currentUser.requestedLgaId || 'Unspecified'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Checking Cloud...' : 'Refresh Status'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Browse Public Portal
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-700" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
