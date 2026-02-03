/**
 * 简历列表状态持久化工具
 * 使用 sessionStorage 保存状态，避免切换标签后丢失
 */

const STORAGE_KEY = 'resume_list_state';

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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save resume list state:', e);
  }
};

export const loadResumeListState = (): Partial<ResumeListState> | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load resume list state:', e);
  }
  return null;
};

export const clearResumeListState = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear resume list state:', e);
  }
};
