const STORAGE_KEY = 'processing_stats_state';

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
};

export interface ProcessingStateSnapshot {
  summary?: any;
  userStats?: any[];
  recentAll?: any[];
  recentDisplayLimit?: number;
  totalCount?: number;
  profileMapState?: Record<string, { display_name: string; email?: string }>;
  page?: number;
  userPage?: number;
  filterMode?: string;
  loadProgress?: number;
  scrollPosition?: number;
  scrollTarget?: string; // 'window' or selector string
}

export const saveProcessingState = (state: ProcessingStateSnapshot) => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { console.log('[processingState] saved', { keys: Object.keys(state), scrollPosition: state.scrollPosition ?? null, scrollTarget: state.scrollTarget || null }); } catch (e) {}
  } catch (e) {
    console.warn('Failed to save processing state:', e);
  }
};

export const loadProcessingState = (): ProcessingStateSnapshot | null => {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    try { console.log('[processingState] loaded', { keys: Object.keys(parsed), scrollPosition: parsed.scrollPosition ?? null, scrollTarget: parsed.scrollTarget || null }); } catch (e) {}
    return parsed;
  } catch (e) {
    console.warn('Failed to load processing state:', e);
    return null;
  }
};

export const clearProcessingState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear processing state:', e);
  }
};
