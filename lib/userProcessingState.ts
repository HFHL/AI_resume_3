const STORAGE_KEY = 'user_processing_stats_state';

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
};

export interface UserProcessingStateSnapshot {
  summary?: any;
  recentAll?: any[];
  recentDisplayLimit?: number;
  totalCount?: number;
  page?: number;
  filterMode?: string;
  loadProgress?: number;
  scrollPosition?: number;
  scrollTarget?: string;
}

export const saveUserProcessingState = (state: UserProcessingStateSnapshot) => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { console.log('[userProcessingState] saved', { keys: Object.keys(state), scrollPosition: state.scrollPosition ?? null, scrollTarget: state.scrollTarget || null }); } catch (e) {}
  } catch (e) {
    console.warn('Failed to save user processing state:', e);
  }
};

export const loadUserProcessingState = (): UserProcessingStateSnapshot | null => {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    try { console.log('[userProcessingState] loaded', { keys: Object.keys(parsed), scrollPosition: parsed.scrollPosition ?? null, scrollTarget: parsed.scrollTarget || null }); } catch (e) {}
    return parsed;
  } catch (e) {
    console.warn('Failed to load user processing state:', e);
    return null;
  }
};

export const clearUserProcessingState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear user processing state:', e);
  }
};
