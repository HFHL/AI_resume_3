/**
 * 简历列表状态持久化工具
 * 使用 sessionStorage 保存状态，避免切换标签后丢失
 */

const STORAGE_KEY = 'resume_list_state';

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
};

export interface ResumeListState {
  currentPage: number;
  filters: {
    search: string;
    degrees: string[];
    schoolTags: string[];
    minYears: string;
    companyTypes: string[];
    tags: string[];
    special: string[];
  };
  selectedIds: string[];
  scrollPosition?: number;
  scrollTarget?: string; // 'window' or selector string
}

export const saveResumeListState = (state: ResumeListState) => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { console.log('[resumeState] saved', { currentPage: state.currentPage, scrollPosition: state.scrollPosition ?? null, scrollTarget: state.scrollTarget || null }); } catch (e) {}
  } catch (e) {
    console.warn('Failed to save resume list state:', e);
  }
};

export const loadResumeListState = (): Partial<ResumeListState> | null => {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      try { console.log('[resumeState] loaded', { currentPage: parsed.currentPage, scrollPosition: parsed.scrollPosition ?? null, scrollTarget: parsed.scrollTarget || null }); } catch (e) {}
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load resume list state:', e);
  }
  return null;
};

export const clearResumeListState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear resume list state:', e);
  }
};
