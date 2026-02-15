'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { FilterSidebar } from '@/components/FilterSidebar';
import { ResumeList } from '@/components/ResumeList';
import { useAuth } from '@/contexts/AuthContext';
import { FilterState, Candidate } from '@/types';
import { supabase } from '@/lib/supabase';
import { loadResumeListState, saveResumeListState } from '@/lib/resumeState';
import { waitForElement } from '@/lib/domUtils';

// 全局数据缓存（模块级，避免切换标签时丢失）
// 缓存永久有效，除非用户手动刷新浏览器
let cachedCandidates: Candidate[] = [];
let cachedSyncStats = { pagesLoaded: 0, totalLoaded: 0 };
let cachedForUserId: string | null = null;

export default function ResumesPage() {
  const { user } = useAuth();
  const isInitialMount = useRef(true);
  const router = useRouter();
  const returningFromRef = useRef(false);
  // If the page was opened via a return URL (e.g. ?from=resumes), mark
  // returningFromRef synchronously so save-effect doesn't overwrite the
  // restored scroll position during initial mount.
  if (typeof window !== 'undefined') {
    try {
      const spInit = new URLSearchParams(window.location.search || '');
      const fromInit = spInit.get('from');
      if (fromInit === 'resumes') {
        returningFromRef.current = true;
      }
    } catch (e) {}
  }
  const lastScrollRef = useRef<{ scrollTarget: string; scrollPosition: number } | null>(null);

  // 从 sessionStorage 恢复状态
  const savedState = loadResumeListState();
  const [candidates, setCandidates] = useState<Candidate[]>(cachedCandidates);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStats, setSyncStats] = useState<{ pagesLoaded: number; totalLoaded: number }>(
    cachedCandidates.length > 0 ? cachedSyncStats : { pagesLoaded: 0, totalLoaded: 0 }
  );
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(
    savedState?.filters || {
      search: '', degrees: [], schoolTags: [], minYears: '', companyTypes: [], tags: [], special: []
    }
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(savedState?.selectedIds || []);
  const [currentPage, setCurrentPage] = useState<number>(savedState?.currentPage || 1);
  const [itemsPerPage] = useState<number>(10);

  // 保存状态到 sessionStorage（包含滚动位置）
  useEffect(() => {
    // Capture the actual element that receives scroll events so we know
    // whether the user is scrolling the window, the top-level <main>, or
    // the internal `.resumes-scroll` container. This is more reliable than
    // computing from styles because some browsers/layouts attach the
    // scrollbar to different elements.
    if (typeof window !== 'undefined') {
      const onScroll = (ev: Event) => {
        try {
          const target = ev.target as any;
          let tag = 'window';
          let pos = 0;
          if (target === document || target === document.scrollingElement || target === window) {
            tag = 'window';
            pos = window.scrollY || (document.scrollingElement && (document.scrollingElement as HTMLElement).scrollTop) || 0;
          } else if (target && target.tagName === 'MAIN') {
            tag = 'main';
            pos = (target as HTMLElement).scrollTop || 0;
          } else if (target && target.classList && target.classList.contains('resumes-scroll')) {
            tag = '.resumes-scroll';
            pos = (target as HTMLElement).scrollTop || 0;
          } else if (target && 'scrollTop' in target) {
            pos = (target as HTMLElement).scrollTop || 0;
          }
          lastScrollRef.current = { scrollTarget: tag, scrollPosition: pos };
        } catch (e) {}
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      const mainEl = document.querySelector('main');
      const resumesEl = document.querySelector('.resumes-scroll');
      mainEl?.addEventListener('scroll', onScroll, { passive: true });
      resumesEl?.addEventListener('scroll', onScroll, { passive: true });

      // cleanup
      return () => {
        try {
          window.removeEventListener('scroll', onScroll as EventListener);
          mainEl?.removeEventListener('scroll', onScroll as EventListener);
          resumesEl?.removeEventListener('scroll', onScroll as EventListener);
        } catch (e) {}
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存状态到 sessionStorage（包含滚动位置）
  useEffect(() => {
    // Don't overwrite saved scroll while we're returning and restoring
    if (returningFromRef.current) {
      try { console.log('[resumes] skip saving scroll state while returningFromRef'); } catch (e) {}
      return;
    }
    const detectScrollInfo = () => {
      try {
        if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
        // Prefer the last observed actual scroll target if available.
        if (lastScrollRef.current) {
          try { console.log('[resumes] using lastScrollRef', lastScrollRef.current); } catch (e) {}
          return { scrollPosition: lastScrollRef.current.scrollPosition || 0, scrollTarget: lastScrollRef.current.scrollTarget || 'window' };
        }
        const container = document.querySelector('.resumes-scroll') as HTMLElement | null;
        const winY = window.scrollY || 0;
        if (winY && winY > 0) {
          try { console.log('[resumes] detectScrollInfo: window.scrollY', winY); } catch (e) {}
          return { scrollPosition: winY, scrollTarget: 'window' };
        }
        let node: HTMLElement | null = container;
        while (node) {
          try {
            const style = window.getComputedStyle(node);
            const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
            if (canScroll) {
              if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
              if (node.classList && node.classList.contains('resumes-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.resumes-scroll' };
              return { scrollPosition: node.scrollTop || 0, scrollTarget: 'window' };
            }
          } catch (e) {}
          node = node.parentElement;
        }
        const docEl = document.scrollingElement as HTMLElement | null;
        if (docEl) return { scrollPosition: docEl.scrollTop || 0, scrollTarget: 'window' };
        return { scrollPosition: 0, scrollTarget: 'window' };
      } catch (e) {
        return { scrollPosition: 0, scrollTarget: 'window' };
      }
    };
    const { scrollPosition, scrollTarget } = detectScrollInfo();
    try {
      const docEl = document.scrollingElement as HTMLElement | null;
      const mainEl = document.querySelector('main') as HTMLElement | null;
      const resumesEl = document.querySelector('.resumes-scroll') as HTMLElement | null;
      console.log('[resumes] detected scroll info before save', { currentPage, scrollPosition, scrollTarget });
      console.log('[resumes] rawScrollStatus', {
        windowScrollY: window.scrollY,
        docScrollTop: docEl ? docEl.scrollTop : null,
        mainScrollTop: mainEl ? mainEl.scrollTop : null,
        resumesScrollTop: resumesEl ? resumesEl.scrollTop : null,
        resumesScrollClientHeight: resumesEl ? resumesEl.clientHeight : null,
        resumesScrollScrollHeight: resumesEl ? resumesEl.scrollHeight : null,
        lastScrollRef: lastScrollRef.current
      });
    } catch (e) {}
    saveResumeListState({
      currentPage,
      filters,
      selectedIds,
      scrollPosition,
      scrollTarget
    });
  }, [currentPage, filters, selectedIds]);

  // 在挂载时恢复滚动位置（如果存在）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (savedState && typeof savedState.scrollPosition === 'number') {
      // wait for the resumes list container to render then restore
      // restore according to saved target
      try { console.log('[resumes] initial mount restore attempt', savedState); } catch (e) {}
      if (savedState.scrollTarget === 'window') {
        try { window.scrollTo({ top: savedState.scrollPosition || 0 }); } catch (e) {}
        try { console.log('[resumes] after window.scrollTo', { windowScrollY: window.scrollY }); } catch (e) {}
      } else {
        waitForElement(savedState.scrollTarget || '.resumes-scroll', 2000).then((scrollEl) => {
          if (scrollEl) {
            try { (scrollEl as HTMLElement).scrollTo({ top: savedState.scrollPosition || 0 }); } catch (e) {}
            try { console.log('[resumes] after element.scrollTo', { tag: (scrollEl as HTMLElement).tagName, className: (scrollEl as HTMLElement).className, scrollTop: (scrollEl as HTMLElement).scrollTop, scrollHeight: (scrollEl as HTMLElement).scrollHeight, clientHeight: (scrollEl as HTMLElement).clientHeight, windowScrollY: window.scrollY }); } catch (e) {}
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // also restore on popstate/pageshow so browser back and bfcache work reliably
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restore = () => {
      try {
        console.log('[resumes] popstate/pageshow restore triggered');
        const s = loadResumeListState();
        console.log('[resumes] loaded snapshot', s);
        if (!s) return;
        if (typeof s.currentPage === 'number') setCurrentPage(s.currentPage);
        if (s.filters) setFilters(s.filters as any);
        if (s.selectedIds) setSelectedIds(s.selectedIds as string[]);
        try {
          if (s.scrollTarget === 'window') {
            try { window.scrollTo({ top: s.scrollPosition || 0 }); } catch (e) {}
          } else if (s.scrollTarget === 'main') {
            waitForElement('main', 2000).then((el) => { if (el && typeof s.scrollPosition === 'number') try { el.scrollTo({ top: s.scrollPosition || 0 }); } catch (e) {} });
          } else {
            waitForElement(s.scrollTarget || '.resumes-scroll', 2000).then((scrollEl) => {
              if (scrollEl && typeof s.scrollPosition === 'number') try { scrollEl.scrollTo({ top: s.scrollPosition || 0 }); } catch (e) {}
            });
          }
        } catch (e) {}
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  // restore when navigated back via query params (e.g., ResumeDetail pushes back with ?from=resumes&page=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const from = sp.get('from');
      if (from === 'resumes') {
        const p = Number(sp.get('page') || currentPage);
        if (!isNaN(p)) setCurrentPage(p);
        returningFromRef.current = true;
        const cached = loadResumeListState();
        const doRestore = async () => {
          try {
            if (cached && typeof cached.scrollPosition === 'number' && cached.scrollTarget) {
              try { console.log('[resumes] URL-return detected, restoring cached scrollTarget', cached.scrollTarget, cached.scrollPosition); } catch (e) {}
              if (cached.scrollTarget === 'main') {
                const el = await waitForElement('main', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === '.resumes-scroll') {
                const el = await waitForElement('.resumes-scroll', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === 'window') {
                try { window.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
                return;
              }
            }
            const elFallback = await waitForElement('.resumes-scroll', 7000);
            if (elFallback) {
              const bottom = (elFallback.scrollHeight || 0) - (elFallback.clientHeight || 0);
              try { elFallback.scrollTo({ top: bottom || 0 }); } catch (e) {}
              try { console.log('[resumes] fallback scroll applied', { tag: (elFallback as HTMLElement).tagName, className: (elFallback as HTMLElement).className, scrollTop: (elFallback as HTMLElement).scrollTop, scrollHeight: (elFallback as HTMLElement).scrollHeight, clientHeight: (elFallback as HTMLElement).clientHeight, windowScrollY: window.scrollY }); } catch (e) {}
            } else {
              try { window.scrollTo({ top: document.body.scrollHeight || 0 }); } catch (e) {}
              try { console.log('[resumes] fallback window scroll applied', { windowScrollY: window.scrollY }); } catch (e) {}
            }
          } catch (e) {}
        };
        void doRestore();
        setTimeout(() => { void doRestore(); }, 500);
        setTimeout(() => { void doRestore(); }, 1500);
        setTimeout(() => { void doRestore(); }, 3000);
        setTimeout(() => { void doRestore(); }, 5000);
        try { router.replace('/resumes'); } catch (e) {}
        setTimeout(() => { try { returningFromRef.current = false; } catch (e) {} }, 5500);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch candidates from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchCandidates = async (isBackground = false) => {
      let cancelled = false;

      const formatCandidates = (data: any[]): Candidate[] => {
        return (data || []).map((item: any) => {
          const works = item.candidate_work_experiences || [];
          const latestWork = works.length > 0 ? works[0] : null;
          const edus = item.candidate_educations || [];
          const mainEdu = edus.length > 0 ? edus[0] : null;

          const candidateTags = (item.candidate_tags || []).map((t: any, idx: number) => ({
            id: t.tags?.id ?? `${t.tags?.tag_name || ''}-${idx}`,
            tag_name: t.tags?.tag_name || '',
            category: t.tags?.category || ''
          })).filter((t: any) => t.tag_name);

          const tagNames = candidateTags.map((t: any) => t.tag_name);

          return {
            id: item.id,
            name: (item.name && item.name.trim()) || 'Unknown',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`,
            title: latestWork?.role || '待定职位',
            work_years: item.work_years || 0,
            degree: item.degree_level || mainEdu?.degree || '未知',
            phone: item.phone,
            email: item.email || '',
            school: {
              name: mainEdu?.school || '未填写',
              tags: mainEdu?.school_tags || []
            },
            company: latestWork?.company || '未填写',
            company_tags: [],
            is_outsourcing: false,
            location: item.location || '未知',
            skills: tagNames,
            match_score: Math.floor(Math.random() * 40) + 60,
            last_active: new Date(item.updated_at).toLocaleDateString(),
            work_experiences: works.map((w: any) => ({
              company: w.company || '',
              role: w.role || '',
              department: w.department || '',
              start_date: w.start_date || '',
              end_date: w.end_date || '',
              description: w.description || ''
            })),
            educations: edus.map((e: any) => ({
              school: e.school || '',
              degree: e.degree || '',
              major: e.major || '',
              school_tags: e.school_tags || []
            })),
            projects: (item.candidate_projects || []).map((p: any) => ({
              project_name: p.project_name || '',
              role: p.role || '',
              description: p.description || ''
            })),
            self_evaluation: item.self_evaluation || '',
            tags: candidateTags
          };
        });
      };

      if (!isBackground) {
        setLoading(true);
      }
      setSyncing(false);
      if (!isBackground) {
        setSyncStats({ pagesLoaded: 0, totalLoaded: 0 });
      }
      setError(null);

      try {
        const PAGE_SIZE = 1000;
        const fetchPage = async (page: number) => {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          return await supabase
            .from('candidates')
            .select(`
              *,
              candidate_educations (school, degree, major, school_tags),
              candidate_work_experiences (company, role, department, start_date, end_date, description),
              candidate_projects (project_name, role, description),
              candidate_tags (
                tags (tag_name, category)
              )
            `)
            .order('updated_at', { ascending: false })
            .range(from, to);
        };

        const first = await fetchPage(0);
        if (first.error) throw first.error;
        const firstFormatted = formatCandidates(first.data || []);
        if (!cancelled) {
          setCandidates(firstFormatted);
          cachedCandidates = firstFormatted;
          cachedForUserId = user.id;
          const newStats = { pagesLoaded: 1, totalLoaded: firstFormatted.length };
          setSyncStats(newStats);
          cachedSyncStats = newStats;
          if (!isBackground) {
            setLoading(false);
          }
        }

        if ((first.data || []).length >= PAGE_SIZE) {
          // 只有在非后台刷新时才显示同步提示
          if (!cancelled && !isBackground) setSyncing(true);
          let page = 1;
          let hasMore = true;

          while (hasMore && !cancelled) {
            const res = await fetchPage(page);
            if (res.error) {
              console.error('Error fetching candidates (background):', res.error);
              setError(res.error.message || '加载失败');
              break;
            }

            const rows = res.data || [];
            if (rows.length === 0) {
              hasMore = false;
              break;
            }

            const formatted = formatCandidates(rows);
            setCandidates(prev => {
              const updated = [...prev, ...formatted];
              cachedCandidates = updated;
              cachedForUserId = user.id;
              return updated;
            });
            setSyncStats(prev => {
              const newStats = {
                pagesLoaded: prev.pagesLoaded + 1,
                totalLoaded: prev.totalLoaded + formatted.length,
              };
              cachedSyncStats = newStats;
              return newStats;
            });

            if (rows.length < PAGE_SIZE) hasMore = false;
            page += 1;
          }

          if (!cancelled && !isBackground) setSyncing(false);
        } else {
          if (!cancelled && !isBackground) setSyncing(false);
        }
      } catch (err: any) {
        console.error('Error fetching candidates:', err);
        if (!cancelled) {
          setError(err.message);
          if (!isBackground) {
            setLoading(false);
            setSyncing(false);
          }
        }
      }
    };

    // 如果有缓存，先展示缓存，然后后台静默刷新，避免新解析成功的简历搜索不到
    const cacheBelongsToCurrentUser = cachedForUserId === user.id;
    if (cachedCandidates.length > 0 && cacheBelongsToCurrentUser && isInitialMount.current) {
      console.log('Using cached candidates and refreshing in background');
      setCandidates(cachedCandidates);
      setSyncStats(cachedSyncStats);
      setLoading(false);
      isInitialMount.current = false;
      fetchCandidates(true);
      return;
    }
    
    // 首次加载、缓存为空或缓存用户不匹配时获取数据
    if (isInitialMount.current) {
      fetchCandidates();
      isInitialMount.current = false;
    }
  }, [user]);

  const filteredCandidates = useMemo(() => {
    const result = candidates.filter(c => {
      if (!c.id || !c.name || c.name === 'Unknown') {
        return false;
      }

      if (filters.search) {
        const searchText = filters.search.trim();
        if (!searchText) return true;

        const keywords = searchText.split(/\s+/).filter(k => k.length > 0);
        if (keywords.length === 0) return true;

        const searchFields = [
          c.name || '',
          c.email?.toLowerCase() || '',
          c.phone || '',
          c.location || '',
          c.title || '',
          c.company || '',
          c.degree || '',
          c.self_evaluation || '',
          c.school?.name || '',
          ...(c.school?.tags || []),
          ...(c.skills || []),
          ...(c.work_experiences || []).flatMap(w => [
            w.company || '', w.role || '', w.department || '', w.description || ''
          ]),
          ...(c.educations || []).flatMap(e => [
            e.school || '', e.degree || '', e.major || '', ...(e.school_tags || [])
          ]),
          ...(c.projects || []).flatMap(p => [
            p.project_name || '', p.role || '', p.description || ''
          ])
        ];

        const fullText = searchFields.join(' ');
        const fullTextLower = fullText.toLowerCase();

        const allKeywordsMatch = keywords.every(keyword => {
          const keywordLower = keyword.toLowerCase();
          if (/[\u4e00-\u9fa5]/.test(keyword)) {
            return fullText.includes(keyword);
          }
          return fullTextLower.includes(keywordLower);
        });

        if (!allKeywordsMatch) {
          return false;
        }
      }
      if (filters.degrees.length > 0 && !filters.degrees.includes(c.degree)) return false;
      if (filters.schoolTags.length > 0 && !c.school.tags.some(t => filters.schoolTags.includes(t))) return false;
      if (filters.minYears && c.work_years < parseInt(filters.minYears)) return false;
      if (filters.companyTypes.length > 0 && !c.company_tags.some(t => filters.companyTypes.includes(t))) return false;
      if (filters.tags.length > 0 && !c.skills.some(s => filters.tags.includes(s))) return false;
      if (filters.special.includes('outsourcing') && !c.is_outsourcing) return false;
      if (filters.special.includes('noPhone') && c.phone !== null) return false;
      return true;
    });

    if (filters.search) {
      console.log(`Search "${filters.search}": ${result.length} results from ${candidates.length} total`);
    }

    return result;
  }, [filters, candidates]);

  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCandidates.slice(startIndex, endIndex);
  }, [filteredCandidates, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);

  // 筛选条件变化时，重置到第1页
  const lastFilterKeyRef = useRef<string>('');
  // Initialize the lastFilterKeyRef with the initial filters to ensure
  // the first real user change will trigger a page reset.
  useEffect(() => {
    lastFilterKeyRef.current = JSON.stringify(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const filterKey = JSON.stringify(filters);
    // 只有当筛选条件真正变化时才重置页码（避免初始化时重置）
    if (filterKey !== lastFilterKeyRef.current && lastFilterKeyRef.current !== '') {
      setCurrentPage(1);
    }
    lastFilterKeyRef.current = filterKey;
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({ search: '', degrees: [], schoolTags: [], minYears: '', companyTypes: [], tags: [], special: [] });
    setSelectedIds([]);
  };

  const handleCandidateClick = (id: string) => {
    // 在打开详情页前保存当前滚动位置，便于从详情页回退时恢复
    const detectScrollInfo = () => {
      try {
        if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
        const container = document.querySelector('.resumes-scroll') as HTMLElement | null;
        const winY = window.scrollY || 0;
        if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
        let node: HTMLElement | null = container;
        while (node) {
          try {
            const style = window.getComputedStyle(node);
            const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
            if (canScroll) {
              if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
              if (node.classList && node.classList.contains('resumes-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.resumes-scroll' };
              return { scrollPosition: node.scrollTop || 0, scrollTarget: 'window' };
            }
          } catch (e) {}
          node = node.parentElement;
        }
        const docEl = document.scrollingElement as HTMLElement | null;
        if (docEl) return { scrollPosition: docEl.scrollTop || 0, scrollTarget: 'window' };
        return { scrollPosition: 0, scrollTarget: 'window' };
      } catch (e) {
        return { scrollPosition: 0, scrollTarget: 'window' };
      }
    };
    const { scrollPosition, scrollTarget } = detectScrollInfo();
    saveResumeListState({ currentPage, filters, selectedIds, scrollPosition, scrollTarget });

    // navigate in the same tab instead of opening a new window; include from so detail can return explicitly
    const url = `/resumes/${id}?from=resumes&page=${encodeURIComponent(String(currentPage))}`;
    router.push(url);
  };

  return (
    <MainLayout>
      <div className="flex h-full w-full">
        <FilterSidebar filters={filters} setFilters={setFilters} onReset={handleResetFilters} />
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
            <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
            <p>正在加载简历数据...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-red-500">
            <p>加载失败: {error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">
              重试
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            {syncing && (
              <div className="px-6 py-2 text-xs text-indigo-700 bg-indigo-50 border-b border-indigo-100">
                正在后台同步简历数据：已加载 <span className="font-medium">{syncStats.totalLoaded}</span> 条（第{' '}
                <span className="font-medium">{syncStats.pagesLoaded}</span> 页）…
              </div>
            )}
            <ResumeList
              candidates={paginatedCandidates}
              allCandidates={filteredCandidates}
              filters={filters}
              setFilters={setFilters}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onUploadClick={() => (window.location.href = '/upload')}
              onCandidateClick={handleCandidateClick}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
