/**
 * AKS-HCD Durable Offline Storage & Queue Engine
 * Uses IndexedDB for reliable offline queueing, local caching, and media storage.
 */

export interface QueuedOperation {
  id: string; // Stable UUID or op-timestamp-random
  recordId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_TRANSITION';
  payload: any;
  userContext: {
    id: string;
    name: string;
    role: string;
    assignedLgaId?: string;
  };
  lgaId: string;
  createdAt: string;
  lastAttemptAt?: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  errorDetails?: string;
  conflictInfo?: string;
}

export interface CachedEvidence {
  id: string;
  fileName: string;
  lgaId: string;
  activityId: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

const DB_NAME = 'aks_hcd_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export const openOfflineDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Pending operations queue
      if (!db.objectStoreNames.contains('pending_operations')) {
        const opStore = db.createObjectStore('pending_operations', { keyPath: 'id' });
        opStore.createIndex('status', 'status', { unique: false });
        opStore.createIndex('createdAt', 'createdAt', { unique: false });
        opStore.createIndex('recordId', 'recordId', { unique: false });
        opStore.createIndex('lgaId', 'lgaId', { unique: false });
      }

      // 2. Offline cached activities
      if (!db.objectStoreNames.contains('cached_activities')) {
        const actStore = db.createObjectStore('cached_activities', { keyPath: 'id' });
        actStore.createIndex('lgaId', 'lgaId', { unique: false });
        actStore.createIndex('status', 'status', { unique: false });
      }

      // 3. Offline binary evidence assets
      if (!db.objectStoreNames.contains('offline_evidence')) {
        db.createObjectStore('offline_evidence', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

// Queue operations
export const enqueueOperation = async (
  op: Omit<QueuedOperation, 'id' | 'createdAt' | 'retryCount' | 'status'>
): Promise<QueuedOperation> => {
  const fullOp: QueuedOperation = {
    ...op,
    id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      const req = store.put(fullOp);
      req.onsuccess = () => resolve(fullOp);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Fallback to local storage for offline operation:', err);
    // Graceful in-memory / localStorage fallback if IndexedDB is blocked
    const fallback = getFallbackQueue();
    fallback.push(fullOp);
    saveFallbackQueue(fallback);
    return fullOp;
  }
};

export interface UserIsolationContext {
  id?: string;
  role?: string;
  assignedLgaId?: string;
  isAuthenticated?: boolean;
  isPrivileged?: boolean;
}

export const getPendingOperations = async (userContext?: UserIsolationContext): Promise<QueuedOperation[]> => {
  let allOps: QueuedOperation[] = [];
  try {
    const db = await openOfflineDb();
    allOps = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const store = tx.objectStore('pending_operations');
      const req = store.getAll();
      req.onsuccess = () => {
        const ops = (req.result || []) as QueuedOperation[];
        resolve(ops.filter((o) => o.status === 'pending' || o.status === 'failed'));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    allOps = getFallbackQueue().filter((o) => o.status === 'pending' || o.status === 'failed');
  }

  // Tenant & User Isolation:
  // If no user context provided, return all pending operations
  if (!userContext) {
    return allOps;
  }

  // Unauthenticated or unprivileged public users must NEVER see pending admin operations!
  if (!userContext.isAuthenticated || !userContext.isPrivileged) {
    return [];
  }

  // LGA Desk Worker: strictly isolate to their assigned LGA and user ID
  if (userContext.role === 'lga_admin') {
    return allOps.filter(
      (op) =>
        op.lgaId === userContext.assignedLgaId &&
        op.userContext?.id === userContext.id
    );
  }

  // State Administrator: sees all operations within the state
  if (userContext.role === 'state_admin') {
    return allOps;
  }

  return [];
};

export const getAllOperations = async (): Promise<QueuedOperation[]> => {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const store = tx.objectStore('pending_operations');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as QueuedOperation[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return getFallbackQueue();
  }
};

export const updateOperation = async (op: QueuedOperation): Promise<void> => {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = getFallbackQueue().map((o) => (o.id === op.id ? op : o));
    saveFallbackQueue(list);
  }
};

export const removeOperation = async (id: string): Promise<void> => {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    saveFallbackQueue(getFallbackQueue().filter((o) => o.id !== id));
  }
};

// In-memory fallback stores for non-browser / SSR / restricted environments
let inMemoryCachedActivities: any[] = [];
let inMemoryFallbackQueue: QueuedOperation[] = [];

const ACTIVITIES_FALLBACK_KEY = 'aks_hcd_cached_activities_fallback';
function getFallbackActivities(): any[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ACTIVITIES_FALLBACK_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return inMemoryCachedActivities;
}

function saveFallbackActivities(activities: any[]): void {
  inMemoryCachedActivities = activities;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVITIES_FALLBACK_KEY, JSON.stringify(activities.slice(0, 100)));
    }
  } catch {}
}

// Activity local caching with tenant isolation
export const cacheActivitiesLocally = async (
  activities: any[],
  userContext?: UserIsolationContext
): Promise<void> => {
  const annotated = (activities || []).map((act) => ({
    ...act,
    _cachedByUserId: userContext?.id || 'anon',
    _cachedByLgaId: userContext?.assignedLgaId || 'all',
  }));

  try {
    const db = await openOfflineDb();
    const tx = db.transaction('cached_activities', 'readwrite');
    const store = tx.objectStore('cached_activities');
    store.clear();
    for (const act of annotated) {
      store.put(act);
    }
  } catch (err) {
    saveFallbackActivities(annotated);
  }
};

export const clearLocalActivityCache = async (userContext?: UserIsolationContext): Promise<void> => {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction('cached_activities', 'readwrite');
    tx.objectStore('cached_activities').clear();
  } catch {}
  saveFallbackActivities([]);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('aks_hcd_cached_activities');
      localStorage.removeItem(ACTIVITIES_FALLBACK_KEY);
      if (userContext?.id) {
        localStorage.removeItem(`aks_hcd_cached_activities_${userContext.id}`);
      }
    }
  } catch {}
};

export const getCachedActivities = async (userContext?: UserIsolationContext): Promise<any[]> => {
  let allCached: any[] = [];
  try {
    const db = await openOfflineDb();
    allCached = await new Promise((resolve, reject) => {
      const tx = db.transaction('cached_activities', 'readonly');
      const store = tx.objectStore('cached_activities');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    allCached = getFallbackActivities();
  }

  // Tenant boundary guard on cached items:
  // If public / unauthenticated: strictly return only PUBLISHED records
  if (!userContext || !userContext.isAuthenticated || !userContext.isPrivileged) {
    return allCached.filter((a) => a.status === 'PUBLISHED');
  }

  // LGA desk worker: return activities from their own LGA, or published from anywhere
  if (userContext.role === 'lga_admin') {
    return allCached.filter(
      (a) => a.lgaId === userContext.assignedLgaId || a.status === 'PUBLISHED'
    );
  }

  // State executive: access to all cached government activities
  if (userContext.role === 'state_admin') {
    return allCached;
  }

  return allCached.filter((a) => a.status === 'PUBLISHED');
};

// Binary evidence asset caching
export const storeOfflineEvidence = async (evidence: CachedEvidence): Promise<void> => {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction('offline_evidence', 'readwrite');
    tx.objectStore('offline_evidence').put(evidence);
  } catch (err) {
    console.warn('Unable to cache offline evidence blob:', err);
  }
};

export const getOfflineEvidence = async (id: string): Promise<CachedEvidence | null> => {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_evidence', 'readonly');
      const req = tx.objectStore('offline_evidence').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

// LocalStorage helpers for fallback
const FALLBACK_KEY = 'aks_hcd_pending_ops_fallback';
function getFallbackQueue(): QueuedOperation[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FALLBACK_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return inMemoryFallbackQueue;
}
function saveFallbackQueue(ops: QueuedOperation[]): void {
  inMemoryFallbackQueue = ops;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(ops));
    }
  } catch {}
}
