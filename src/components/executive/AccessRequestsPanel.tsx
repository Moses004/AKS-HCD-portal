import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ALL_31_LGAS, getLgaById } from '../../data/lgas';
import { UserProfileRecord, Role, ApprovalStatus } from '../../types';
import { getSupabaseClient } from '../../lib/supabase';
import {
  ShieldCheck,
  Building2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  BadgeCheck,
  Briefcase,
  Calendar,
  Lock,
  ChevronRight,
  UserCheck,
  UserX,
  ShieldAlert,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';

export const AccessRequestsPanel: React.FC = () => {
  const { currentUser, reviewAccessRequest } = useAuth();

  const [profiles, setProfiles] = useState<UserProfileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApprovalStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal State
  const [reviewingProfile, setReviewingProfile] = useState<UserProfileRecord | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'suspend'>('approve');
  const [assignedRole, setAssignedRole] = useState<'lga_admin' | 'state_admin'>('lga_admin');
  const [assignedLgaId, setAssignedLgaId] = useState<string>('uyo');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Fetch access requests
  const fetchRequests = async () => {
    setIsLoading(true);
    setFetchError(null);
    const client = getSupabaseClient();
    if (!client) {
      setFetchError('Database connection unavailable.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await client
        .from('user_profiles')
        .select('user_id, display_name, staff_identifier, department, role, lga_id, requested_role, requested_lga_id, approval_status, active, approved_by, approved_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        setFetchError(`Error fetching access requests: ${error.message}`);
      } else {
        setProfiles((data || []) as UserProfileRecord[]);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to retrieve access requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const client = getSupabaseClient();
    if (!client) return;

    try {
      const channel = client
        .channel('hcd-realtime-access-requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_profiles' },
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const newRecord = payload.new as UserProfileRecord;
              setProfiles((prev) => {
                if (prev.some((p) => p.user_id === newRecord.user_id)) {
                  return prev.map((p) => (p.user_id === newRecord.user_id ? newRecord : p));
                }
                return [newRecord, ...prev];
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updated = payload.new as UserProfileRecord;
              setProfiles((prev) =>
                prev.map((p) => (p.user_id === updated.user_id ? updated : p))
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const deletedId = (payload.old as any).user_id;
              setProfiles((prev) => prev.filter((p) => p.user_id !== deletedId));
            }
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription on user_profiles failed:', err);
    }
  }, []);

  // Open review modal for a specific user
  const handleOpenReview = (p: UserProfileRecord, initialDecision: 'approve' | 'reject' | 'suspend') => {
    setReviewingProfile(p);
    setDecision(initialDecision);
    setReviewError(null);
    setReviewNotes('');

    // Pre-populate role and LGA from request
    const roleToApprove = (p.requested_role as 'lga_admin' | 'state_admin') || (p.role === 'state_admin' ? 'state_admin' : 'lga_admin');
    setAssignedRole(roleToApprove);

    const lgaToApprove = p.requested_lga_id || p.lga_id || 'uyo';
    setAssignedLgaId(lgaToApprove);
  };

  // Submit decision via backend RPC
  const handleExecuteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProfile) return;

    setReviewError(null);

    // Validation for LGA Desk Worker
    if (decision === 'approve' && assignedRole === 'lga_admin' && !assignedLgaId) {
      setReviewError('Please specify and confirm the authorized Local Government Area.');
      return;
    }

    setIsSubmittingReview(true);

    try {
      const p_approved_role = decision === 'approve' ? assignedRole : null;
      const p_approved_lga_id = decision === 'approve' && assignedRole === 'lga_admin' ? assignedLgaId : null;

      const res = await reviewAccessRequest({
        userId: reviewingProfile.user_id,
        decision,
        approvedRole: p_approved_role,
        approvedLgaId: p_approved_lga_id,
        notes: reviewNotes.trim() || undefined,
      });

      if (!res.success) {
        setReviewError(res.error || 'Server rejected access review decision.');
      } else {
        setFeedbackSuccess(
          `Successfully executed ${decision.toUpperCase()} for ${reviewingProfile.display_name}.`
        );
        setTimeout(() => setFeedbackSuccess(null), 4000);
        setReviewingProfile(null);
        await fetchRequests();
      }
    } catch (err: any) {
      setReviewError(err.message || 'An error occurred during decision execution.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Counts
  const pendingCount = profiles.filter((p) => p.approval_status === 'pending').length;
  const approvedCount = profiles.filter((p) => p.approval_status === 'approved' && p.active).length;
  const rejectedCount = profiles.filter((p) => p.approval_status === 'rejected').length;
  const suspendedCount = profiles.filter((p) => p.approval_status === 'suspended' || (!p.active && p.approval_status === 'approved')).length;

  // Filtered List
  const filteredProfiles = profiles.filter((p) => {
    // Status filter
    if (statusFilter !== 'ALL' && p.approval_status !== statusFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.display_name || '').toLowerCase().includes(q);
      const matchStaffId = (p.staff_identifier || '').toLowerCase().includes(q);
      const matchDept = (p.department || '').toLowerCase().includes(q);
      const matchLga = (p.requested_lga_id || p.lga_id || '').toLowerCase().includes(q);
      if (!matchName && !matchStaffId && !matchDept && !matchLga) return false;
    }

    return true;
  });

  return (
    <div className="space-y-subsection">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-950 text-white rounded-2xl p-card-pad sm:p-card-pad-lg shadow-md border border-[#D4AF37]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Executive Authorization Registry
            </span>
            <span className="text-xs text-emerald-200">
              State Directorate Oversight
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Personnel Access Requests & Vetting
          </h2>
          <p className="text-xs text-emerald-100/90 max-w-2xl mt-1 leading-relaxed">
            Review registration submissions from Local Government Area Desk Officers and State Executives. Authorizations strictly execute through the authenticated backend RPC <code className="bg-emerald-900/60 px-1 py-0.5 rounded font-mono text-[10px]">review_hcd_access_request</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-900/80 border border-emerald-600/60 text-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Realtime Stream
          </span>
          <button
            onClick={fetchRequests}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {fetchError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Analytical Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-card-gap lg:gap-card-gap-lg">
        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">
            Pending Clearances
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700 font-mono">
              {pendingCount}
            </span>
            <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
              Requires Action
            </span>
          </div>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">
            Approved Active Personnel
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-800 font-mono">
              {approvedCount}
            </span>
            <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
              Operational
            </span>
          </div>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">
            Applications Rejected
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-700 font-mono">
              {rejectedCount}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Denied</span>
          </div>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">
            Suspended Accounts
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-800 font-mono">
              {suspendedCount}
            </span>
            <span className="text-[10px] text-rose-800 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
              Locked
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>Pending Review ({pendingCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Approved Active ({approvedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-100 text-rose-950 font-bold border border-rose-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-700" />
            <span>Rejected ({rejectedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'suspended'
                ? 'bg-slate-200 text-slate-900 font-bold border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-slate-700" />
            <span>Suspended ({suspendedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Roster ({profiles.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, staff ID, LGA..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Requests Table / Card View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-800" />
            <p className="text-xs font-semibold">Retrieving official access applications...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No personnel records match current filter</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {statusFilter === 'pending'
                ? 'No pending access requests require executive review at this moment.'
                : 'Adjust your search query or filter selection to view personnel records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Applicant & Staff ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Requested Capacity</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4">Date Submitted</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((p) => {
                  const reqLga = p.requested_lga_id ? getLgaById(p.requested_lga_id) : undefined;
                  const appLga = p.lga_id ? getLgaById(p.lga_id) : undefined;
                  const isPending = p.approval_status === 'pending';
                  const isApproved = p.approval_status === 'approved' && p.active;

                  return (
                    <tr key={p.user_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Staff Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {p.display_name || 'Unnamed Applicant'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{p.staff_identifier || 'No Staff ID Provided'}</span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-medium">{p.department || 'Unspecified'}</div>
                      </td>

                      {/* Requested Role & LGA */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {p.requested_role === 'state_admin' ? (
                            <span className="text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                              State Executive
                            </span>
                          ) : (
                            <span className="text-emerald-950 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-emerald-700" />
                              <span>{reqLga?.name || p.requested_lga_id || 'LGA'} Desk Worker</span>
                            </span>
                          )}
                        </div>

                        {/* Approved role badge if approved */}
                        {p.approval_status === 'approved' && p.role && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Approved as: <strong className="text-slate-800">{p.role} {appLga ? `(${appLga.name})` : ''}</strong>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {p.approval_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Pending Review
                          </span>
                        )}
                        {p.approval_status === 'approved' && p.active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Approved & Active
                          </span>
                        )}
                        {p.approval_status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            Rejected
                          </span>
                        )}
                        {p.approval_status === 'suspended' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
                            <AlertTriangle className="w-3 h-3 text-slate-700" />
                            Suspended
                          </span>
                        )}
                        {p.approval_status === 'approved' && !p.active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Timestamps */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleOpenReview(p, 'approve')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleOpenReview(p, 'reject')}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => handleOpenReview(p, 'suspend')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <UserX className="w-3.5 h-3.5 text-slate-600" />
                              <span>Suspend</span>
                            </button>
                          )}

                          {!isPending && !isApproved && (
                            <button
                              onClick={() => handleOpenReview(p, 'approve')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Re-evaluate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {reviewingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#D4AF37]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Executive Review Decision
                  </h3>
                  <p className="text-xs text-emerald-200 font-mono">
                    Applicant ID: {reviewingProfile.user_id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewingProfile(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleExecuteReview} className="p-6 space-y-4">
              {reviewError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{reviewError}</div>
                </div>
              )}

              {/* Applicant Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-slate-900 text-sm font-bold">
                    {reviewingProfile.display_name}
                  </strong>
                  <span className="font-mono text-[11px] text-slate-500">
                    {reviewingProfile.staff_identifier || 'No Staff ID'}
                  </span>
                </div>
                <div className="text-slate-600">
                  Department: <span className="font-medium text-slate-800">{reviewingProfile.department || 'N/A'}</span>
                </div>
                <div className="text-slate-600">
                  Requested Role:{' '}
                  <span className="font-semibold text-emerald-900">
                    {reviewingProfile.requested_role === 'state_admin'
                      ? 'State Executive'
                      : `LGA Desk Worker (${reviewingProfile.requested_lga_id?.toUpperCase() || 'LGA'})`}
                  </span>
                </div>
              </div>

              {/* Decision Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Action Decision <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDecision('approve')}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      decision === 'approve'
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('reject')}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      decision === 'reject'
                        ? 'bg-rose-800 text-white border-rose-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('suspend')}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      decision === 'suspend'
                        ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Suspend
                  </button>
                </div>
              </div>

              {/* Approval Details Configuration */}
              {decision === 'approve' && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      Approved Capacity Role <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={assignedRole}
                      onChange={(e) => setAssignedRole(e.target.value as 'lga_admin' | 'state_admin')}
                      className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      <option value="lga_admin">LGA Desk Worker</option>
                      <option value="state_admin">State Executive Directorate</option>
                    </select>
                  </div>

                  {assignedRole === 'lga_admin' && (
                    <div>
                      <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center justify-between">
                        <span>Assigned LGA Territory Jurisdiction <span className="text-rose-600">*</span></span>
                        <span className="text-[10px] text-emerald-800 font-semibold">Strict Boundary</span>
                      </label>
                      <select
                        value={assignedLgaId}
                        onChange={(e) => setAssignedLgaId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      >
                        {ALL_31_LGAS.map((lga) => (
                          <option key={lga.id} value={lga.id}>
                            {lga.name} LGA ({lga.senatorialDistrict.split(' ')[0]})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-emerald-800 mt-1">
                        Desk Worker will only be permitted to document and modify activities within this council.
                      </p>
                    </div>
                  )}

                  {assignedRole === 'state_admin' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                      <strong>Statewide Authority:</strong> This approval grants full executive review and PTR telemetry oversight across all 31 Local Government Areas.
                    </div>
                  )}
                </div>
              )}

              {/* Reviewer Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Executive Decision Notes {decision !== 'approve' && <span className="text-rose-600">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    decision === 'approve'
                      ? 'Optional authorization notes (e.g., Confirmed with Head of Service).'
                      : 'Specify justification or correction directives for this decision.'
                  }
                  required={decision !== 'approve'}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReviewingProfile(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    decision === 'approve'
                      ? 'bg-emerald-800 hover:bg-emerald-900'
                      : decision === 'reject'
                      ? 'bg-rose-800 hover:bg-rose-900'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {isSubmittingReview ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Executing Decision...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      <span>Confirm {decision.toUpperCase()} Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
