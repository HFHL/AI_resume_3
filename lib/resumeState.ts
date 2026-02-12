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
}

export const saveResumeListState = (state: ResumeListState) => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      return JSON.parse(stored);
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
