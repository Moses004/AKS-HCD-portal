import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { supabaseService } from '../../services/supabaseService';
import { UserProfileRecord, Role } from '../../types';
import { ALL_31_LGAS, getLgaById } from '../../data/lgas';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Building2,
  Mail,
  Key,
  RefreshCw,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { isOnline, recordAuditEvent } = useData();

  const [profiles, setProfiles] = useState<UserProfileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state for provisioning new officer
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<Role>('lga_admin');
  const [newLgaId, setNewLgaId] = useState('uyo');
  const [newDepartment, setNewDepartment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await supabaseService.fetchUserProfiles();
      if (res.success) {
        setProfiles(res.data);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to fetch profiles.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error loading profiles.' });
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      setFeedback({ type: 'error', message: 'User UUID or Identifier is required.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const lga = getLgaById(newLgaId);
    const targetDept =
      newDepartment.trim() ||
      (newRole === 'state_admin'
        ? "Governor's Cabinet & State HCD Council"
        : `${lga?.name || 'LGA'} Department of Community Development`);

    const newRecord: UserProfileRecord = {
      user_id: newUserId.trim(),
      display_name: newUserId.trim(),
      role: newRole,
      lga_id: newRole === 'lga_admin' ? newLgaId : null,
      department: targetDept,
      approval_status: 'approved',
      active: true,
    };

    try {
      const res = await supabaseService.upsertUserProfile(newRecord);
      if (res.success) {
        await recordAuditEvent('USER_ACCESS_CHANGED', {
          activityId: newRecord.user_id,
          activityTitle: `RBAC Provisioning: ${newRecord.display_name}`,
          lgaId: newRole === 'lga_admin' ? newLgaId : undefined,
          notes: `Provisioned officer UID "${newRecord.user_id}" with role ${newRole}${newRole === 'lga_admin' ? ` (${lga?.name || newLgaId} LGA)` : ' (State-Wide Executive)'} · Dept: ${targetDept}.`,
        });
        setFeedback({
          type: 'success',
          message: `Officer successfully provisioned with ${newRole === 'state_admin' ? 'State Administrator' : `${lga?.name} LGA Desk Officer`} credentials.`,
        });
        setNewUserId('');
        setNewDepartment('');
        await loadProfiles();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to provision officer.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Provisioning exception.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeProfile = async (userId: string) => {
    const existingProfile = profiles.find((p) => p.user_id === userId);
    try {
      const res = await supabaseService.deleteUserProfile(userId);
      if (res.success) {
        await recordAuditEvent('USER_ACCESS_CHANGED', {
          activityId: userId,
          activityTitle: `RBAC Revocation: ${existingProfile?.display_name || userId}`,
          lgaId: existingProfile?.lga_id || undefined,
          notes: `Revoked platform access for officer "${existingProfile?.display_name || userId}" (Previous role: ${existingProfile?.role || 'unknown'}).`,
        });
        setFeedback({ type: 'success', message: 'Officer profile access revoked successfully.' });
        setProfiles((prev) => prev.filter((p) => p.user_id !== userId));
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to revoke access.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Revocation exception.' });
    }
  };

  if (!isOpen) return null;

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    const lgaName = p.lga_id ? getLgaById(p.lga_id)?.name.toLowerCase() : '';
    return (
      p.user_id.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      (p.department && p.department.toLowerCase().includes(q)) ||
      (lgaName && lgaName.includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-mgmt-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="user-mgmt-title" className="text-lg font-bold flex items-center gap-2">
                Officer & RBAC Provisioning Console
                <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  State Super-Admin
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                Manage LGA Desk Officers, State Administrator Credentials, and 31-LGA Jurisdictions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2.5 animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Provisioning Form Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-700" />
              Provision or Reassign Officer Access
            </h3>
            <form onSubmit={handleProvisionOfficer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Auth User UID (UUID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Assigned Platform Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="lga_admin">LGA Desk Officer (lga_admin)</option>
                  <option value="state_admin">State Super-Administrator (state_admin)</option>
                  <option value="public">Public Observer (public)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Designated LGA Jurisdiction
                </label>
                <select
                  value={newLgaId}
                  disabled={newRole !== 'lga_admin'}
                  onChange={(e) => setNewLgaId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:opacity-60"
                >
                  {ALL_31_LGAS.map((lga) => (
                    <option key={lga.id} value={lga.id}>
                      {lga.name} ({lga.senatorialDistrict.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Directorate / Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. Health & Education Desk"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSubmitting || !isOnline}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  {isSubmitting ? 'Provisioning...' : 'Provision Officer & Update RBAC'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Provisioned Officers Directory */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Provisioned Officers Directory ({profiles.length})
                </h3>
                <button
                  onClick={loadProfiles}
                  disabled={loading}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Refresh directory"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by LGA, Role, UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading official user profiles from PostgreSQL...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No user profiles found matching filter. Provision officer records above to activate roles.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {filteredProfiles.map((prof) => {
                  const lga = prof.lga_id ? getLgaById(prof.lga_id) : undefined;
                  const isStateAdmin = prof.role === 'state_admin';

                  return (
                    <div
                      key={prof.user_id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                              isStateAdmin
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {isStateAdmin ? 'State Administrator' : `${lga?.name || 'LGA'} Desk Officer`}
                          </span>
                          <span className="text-xs font-mono text-slate-700 font-semibold truncate">
                            {prof.user_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          {lga && (
                            <span className="flex items-center gap-1 font-medium text-emerald-800">
                              <Building2 className="w-3 h-3 text-emerald-600" />
                              {lga.name} LGA Secretariat
                            </span>
                          )}
                          {prof.department && (
                            <span className="text-slate-500 truncate">
                              · {prof.department}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRevokeProfile(prof.user_id)}
                          className="px-2.5 py-1 text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
