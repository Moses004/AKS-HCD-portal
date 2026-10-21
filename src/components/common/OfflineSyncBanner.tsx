import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Wifi, Database } from 'lucide-react';
import { SupabaseModal } from './SupabaseModal';

export const OfflineSyncBanner: React.FC = () => {
  const { isOnline, pendingSyncCount, syncOfflineQueue, isSyncing: globalSyncing, isSupabaseActive } = useData();
  const { isSimulatedOffline, toggleOfflineSimulation } = useAuth();
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  const isSyncing = globalSyncing || isSyncingLocal;

  const handleSync = async () => {
    setIsSyncingLocal(true);
    setSyncFeedback(null);
    try {
      const res = await syncOfflineQueue();
      if (res.failedCount > 0) {
        setSyncFeedback(`Synchronized ${res.syncedCount} record(s); ${res.failedCount} requires retry or permission.`);
      } else {
        setSyncFeedback(`Successfully synchronized ${res.syncedCount} queued record(s) & PTR test ledger to state cloud.`);
      }
      setTimeout(() => setSyncFeedback(null), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncFeedback(`Sync failed: ${msg}`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  // Only show banner if offline or pending items exist or feedback active
  if (isOnline && pendingSyncCount === 0 && !syncFeedback) {
    return null;
  }

  return (
    <aside aria-label="Field Synchronization Notice" className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}

          <div>
            {!isOnline ? (
              <span className="font-bold text-amber-950">
                Remote Field Offline Active:{' '}
                <span className="font-normal text-amber-900">
                  You can draft and record grassroots capacity activities without cellular reception.
                  {pendingSyncCount > 0 ? (
                    <strong className="ml-1 text-amber-950 font-bold">
                      {pendingSyncCount} record(s) currently stored in local browser cache.
                    </strong>
                  ) : (
                    ' New entries and PTR test logs are cached locally.'
                  )}
                </span>
              </span>
            ) : (
              <span className="font-bold text-emerald-950">
                Connection Restored:{' '}
                <span className="font-normal text-emerald-900">
                  {pendingSyncCount} offline record(s) and PTR test ledger ready for auto-sync with the State Cloud.
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {syncFeedback && (
            <span className="text-emerald-800 font-medium flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {syncFeedback}
            </span>
          )}

          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-700 text-xs transition-colors shadow-2xs"
            title="Supabase Cloud Database Settings & Sync"
          >
            <Database className="w-3 h-3 text-emerald-700" />
            <span className="hidden sm:inline">Supabase DB</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </button>

          {isSimulatedOffline && (
            <button
              onClick={toggleOfflineSimulation}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700 transition-colors"
            >
              Disable Offline Sim
            </button>
          )}

          {isOnline && pendingSyncCount > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : `Sync ${pendingSyncCount} Queue Now`}
            </button>
          )}
        </div>
      </div>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </aside>
  );
};
