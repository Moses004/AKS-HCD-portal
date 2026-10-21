import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLgaById } from '../../data/lgas';
import {
  ShieldCheck,
  Building2,
  User,
  X,
  LogOut,
  BadgeCheck,
  Briefcase,
  Mail,
  ExternalLink,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface RoleSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ isOpen, onClose, onNavigate }) => {
  const { currentUser, signOut } = useAuth();

  if (!isOpen) return null;

  const handleSignOut = async () => {
    await signOut();
    onClose();
    if (onNavigate) {
      onNavigate('/');
    }
  };

  const assignedLga = currentUser.assignedLgaId ? getLgaById(currentUser.assignedLgaId) : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#D4AF37]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Official Account & Identity
              </h3>
              <p className="text-xs text-emerald-200">
                Akwa Ibom State · ARISE Agenda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {currentUser.isAuthenticated ? (
            /* Authenticated User Profile Summary */
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{currentUser.name}</h4>
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{currentUser.email}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      currentUser.role === 'state_admin'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : currentUser.role === 'lga_admin'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {currentUser.isPrivileged
                      ? currentUser.role.replace('_', ' ')
                      : 'Pending Clearance'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 text-xs border-t border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Staff Identifier</span>
                    <span className="font-mono text-slate-900 font-semibold">
                      {currentUser.staffIdentifier || 'Verified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Department</span>
                    <span className="text-slate-900 truncate block">
                      {currentUser.department || 'State Service'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Jurisdiction Scope</span>
                    <strong className="text-slate-900 font-semibold">
                      {currentUser.role === 'state_admin'
                        ? 'State-Wide (All 31 LGAs)'
                        : assignedLga
                        ? `${assignedLga.name} LGA`
                        : 'Unassigned'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Clearance Status</span>
                    <span className="text-slate-900 font-semibold">
                      {currentUser.isPrivileged ? 'Active & Approved' : 'Under Review'}
                    </span>
                  </div>
                </div>
              </div>

              {!currentUser.isPrivileged && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Workspace clearance is pending executive review.</span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigate('/access-pending');
                      }}
                      className="font-bold underline text-amber-950 shrink-0 cursor-pointer"
                    >
                      View Status
                    </button>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-700" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logged-Out Visitor Modal */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mx-auto">
                <User className="w-6 h-6 text-emerald-700" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Public Citizen / Observer Mode
                </h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  You are browsing the Akwa Ibom State Human Capital Development Public Transparency Portal. Official personnel can authenticate or request workspace credentials below.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigate) onNavigate('/sign-in');
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Sign In to Official Account
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigate) onNavigate('/sign-up');
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Request Official Workspace Access
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
