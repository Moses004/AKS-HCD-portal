import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Key, 
  RefreshCw, 
  X, 
  Check, 
  Layers, 
  ShieldCheck,
  Server,
  FileCode2,
  Lock
} from 'lucide-react';
import { 
  SUPABASE_URL, 
  getSupabaseAnonKey, 
  setRuntimeAnonKey, 
  MIGRATION_GUIDE_INSTRUCTIONS
} from '../../lib/supabase';
import { supabaseService, SupabaseConnectionStatus } from '../../services/supabaseService';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const { activities, auditLogs, seedBaselineActivities } = useData();
  const { currentUser } = useAuth();
  const [anonKey, setAnonKey] = useState<string>('');
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [status, setStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAnonKey(getSupabaseAnonKey());
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    setTesting(true);
    try {
      const res = await supabaseService.testConnection();
      setStatus(res);
    } catch (err: any) {
      setStatus({
        connected: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuntimeAnonKey(anonKey.trim());
    setFeedback('Supabase API key updated. Re-testing database connection...');
    await checkStatus();
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCopyGuide = () => {
    navigator.clipboard.writeText(MIGRATION_GUIDE_INSTRUCTIONS);
    setCopiedGuide(true);
    setTimeout(() => setCopiedGuide(false), 2500);
  };

  const handleSeedBaseline = async () => {
    if (!currentUser.isAuthenticated || currentUser.role !== 'state_admin' || currentUser.isDemo) {
      setFeedback('Unauthorized: Only verified, authenticated State Super-Administrators may import baseline records.');
      return;
    }

    setIsSeeding(true);
    setFeedback(null);
    try {
      const res = await seedBaselineActivities();
      if (res.success) {
        setFeedback(`Successfully imported all ${res.count} verified baseline activities across all 31 LGAs into Supabase!`);
      } else {
        setFeedback(`Baseline ingestion completed: ${res.count} succeeded, ${res.failedCount || 0} failed. ${res.error ? `Error: ${res.error}` : ''}`);
      }
    } catch (err: any) {
      setFeedback(`Import exception: ${err.message || 'Failed to seed baseline'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supabase-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="supabase-modal-title" className="text-lg font-bold flex items-center gap-2">
                Supabase Enterprise Architecture
                <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  RLS Enforced
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                PostgreSQL Cloud Database & Evidence Vault Diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {feedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-600" />
                Live Cloud Connection Health
              </span>
              <button
                type="button"
                onClick={checkStatus}
                disabled={testing}
                className="text-[11px] text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                Test Ping
              </button>
            </div>

            <div className="flex items-start gap-3">
              {testing ? (
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : status?.connected && status?.hasFunctionGrants ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {SUPABASE_URL}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    status?.connected && status?.hasFunctionGrants
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {status?.connected && status?.hasFunctionGrants ? 'Active & Permitted' : 'Diagnostic Required'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {status?.message || 'Testing cloud database reachability...'}
                </p>
              </div>
            </div>
          </div>

          {/* Anon Key Configuration */}
          <form onSubmit={handleSaveKey} className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="anon-key-input" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-700" />
                Supabase Public Key
              </label>
              <span className="text-[11px] text-slate-500">
                Safe public/publishable client key
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="anon-key-input"
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="flex-1 px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Update Key
              </button>
            </div>
          </form>

          {/* Safe Version-Controlled Migration Guide */}
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-emerald-700" />
                  Version-Controlled Migrations
                </span>
                <p className="text-[11px] text-slate-500">
                  All migrations are maintained in <code className="text-emerald-800">supabase/migrations/</code>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyGuide}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
              >
                {copiedGuide ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Migration Guide</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl p-3 text-[11px] font-mono text-slate-200 border border-slate-800">
              <pre className="whitespace-pre-wrap">{MIGRATION_GUIDE_INSTRUCTIONS}</pre>
            </div>
          </div>

          {/* Official Baseline Seeding (Restricted to Authorized State Admin) */}
          {currentUser.isAuthenticated && currentUser.role === 'state_admin' && (
            <div className="border-t border-slate-200 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/60">
              <div>
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  Executive Baseline Ingestion
                </span>
                <p className="text-[11px] text-emerald-800">
                  As an authenticated State Super-Admin, you can import verified historical 31-LGA activities.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSeedBaseline}
                disabled={isSeeding || !status?.connected}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-50"
              >
                {isSeeding ? 'Importing Baseline...' : 'Import 31-LGA Baseline'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Row Level Security (RLS) & Multi-Tenant LGA Isolation Enforced
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
