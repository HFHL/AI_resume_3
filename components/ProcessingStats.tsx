'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Users, Eye, Trash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadProcessingState, saveProcessingState } from '@/lib/processingState';
import { waitForElement } from '@/lib/domUtils';

interface UploadRow {
  id: string;
  user_id: string | null;
  uploader_name: string | null;
  uploader_email: string | null;
  filename: string | null;
  status: string;
  error?: string | null;
  created_at: string;
}

interface SummaryStats {
  totalUploads: number;
  todayUploads: number;
  weekUploads: number;
  pendingQueue: number;
  processingUploads: number;
  successUploads: number;
  failedUploads: number;
  activeUsers: number;
}

interface UserUploadStats {
  key: string;
  userId: string | null;
  name: string;
  email: string;
  total: number;
  today: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
}

interface RecentUpload {
  uploadId: string;
  candidateId?: string | null;
  filename: string;
  userName: string;
  status: string;
  error?: string | null;
  createdAt: string;
  ossRawPath?: string | null;
}

export const ProcessingStats: React.FC = () => {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<SummaryStats>({
    totalUploads: 0,
    todayUploads: 0,
    weekUploads: 0,
    pendingQueue: 0,
    processingUploads: 0,
    successUploads: 0,
    failedUploads: 0,
    activeUsers: 0
  });
  const [userStats, setUserStats] = useState<UserUploadStats[]>([]);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [recentAll, setRecentAll] = useState<RecentUpload[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'week'>('all');
  const [filenameQuery, setFilenameQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [recentDisplayLimit, setRecentDisplayLimit] = useState<number>(1000);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const loadIntervalRef = React.useRef<number | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [profileMapState, setProfileMapState] = useState<Record<string, { display_name: string; email?: string }>>({});

  const mapStatus = (status: string) => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'processing';
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // get exact total count
      const { count, error: countError } = await supabase
        .from('resume_uploads')
        .select('*', { head: true, count: 'exact' });
      if (countError) console.warn('count fetch failed:', countError);
      const total = (count as number) || 0;
      setTotalCount(total);

      // fetch aggregated status counts directly for accurate summary
      const [{ count: successCount }, { count: failedCount }] = await Promise.all([
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('status', 'SUCCESS'),
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('status', 'FAILED')
      ]).then((res) => res.map(r => r as any)).catch((e) => { console.warn('status counts fetch failed', e); return [{ count: 0 }, { count: 0 }]; });

      // fetch per-user minimal data for userStats (entire table) in paginated chunks
      let userRows: any[] = [];
      if (total > 0) {
        const chunkSize = 2000; // fetch in batches to avoid server-side limits
        for (let start = 0; start < total; start += chunkSize) {
          const end = Math.min(total - 1, start + chunkSize - 1);
          const { data: udata, error: uerr } = await supabase
            .from('resume_uploads')
            .select('user_id,uploader_name,uploader_email,status,created_at')
            .order('created_at', { ascending: false })
            .range(start, end);
          if (uerr) throw uerr;
          if (udata && udata.length) userRows.push(...(udata as any[]));
        }
      }

      // fetch initial recent rows (full fields) limited to recentDisplayLimit (initial 1000)
      const initialEnd = Math.max(0, Math.min(total - 1, recentDisplayLimit - 1));
      let rows: UploadRow[] = [];
      if (total > 0) {
        const { data, error: fetchError } = await supabase
          .from('resume_uploads')
          .select('id,user_id,uploader_name,uploader_email,filename,status,error_reason,created_at,oss_raw_path,candidates(id)')
          .order('created_at', { ascending: false })
          .range(0, initialEnd);
        if (fetchError) throw fetchError;
        rows = (data || []) as UploadRow[];
      }

      // collect user_ids referenced in fetched rows and userRows, then fetch display names from profiles
      const userIdSet = new Set<string>();
      rows.forEach(r => { if (r.user_id) userIdSet.add(r.user_id); });
      userRows.forEach(r => { if (r.user_id) userIdSet.add(r.user_id); });
      const userIds = Array.from(userIdSet);
      let profileMap: Record<string, { display_name: string; email?: string }> = {};
      if (userIds.length > 0) {
        // profiles table uses `user_id` as primary key (not `id`)
        const { data: profilesData, error: pErr } = await supabase
          .from('profiles')
          .select('user_id,display_name,email')
          .in('user_id', userIds);
        if (!pErr && profilesData) {
          profilesData.forEach((p: any) => { profileMap[p.user_id] = { display_name: p.display_name, email: p.email }; });
        }
      }
      // compute summary counts and per-user stats from the full table data (userRows)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      let todayUploads = 0;
      let weekUploads = 0;
      let pendingQueue = 0;
      let processingUploads = 0;
      // success/failed come from aggregated counts (successCount/failedCount)

      const userMap = new Map<string, UserUploadStats>();
      userRows.forEach((row: any) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const normalized = mapStatus(row.status);
        const isToday = createdAt ? createdAt >= todayStart : false;
        const isWeek = createdAt ? createdAt >= weekStart : false;
        const isPendingQueue = row.status === 'PENDING' || row.status === 'OCR_DONE';
        if (isToday) todayUploads += 1;
        if (isWeek) weekUploads += 1;
        if (isPendingQueue) pendingQueue += 1;
        if (normalized === 'processing') processingUploads += 1;

        // Group strictly by resume_uploads.user_id per requirement.
        // Use a stable placeholder for unknown user_id so all nulls are grouped together.
        const uidKey = row.user_id || 'UNKNOWN_USER';
        const displayName = (row.user_id && profileMap[row.user_id]?.display_name) || row.uploader_name || row.uploader_email || '未知用户';
        const email = (row.user_id && profileMap[row.user_id]?.email) || row.uploader_email || '-';
        const current = userMap.get(uidKey) || {
          key: uidKey,
          userId: row.user_id,
          name: displayName,
          email,
          total: 0,
          today: 0,
          pending: 0,
          processing: 0,
          success: 0,
          failed: 0
        };

        current.total += 1;
        if (isToday) current.today += 1;
        if (isPendingQueue) current.pending += 1;
        if (normalized === 'processing') current.processing += 1;
        if (normalized === 'success') current.success += 1;
        if (normalized === 'failed') current.failed += 1;

        userMap.set(uidKey, current);
      });

      let sortedUsers = Array.from(userMap.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.today - a.today;
      });

      // Include users from `profiles` who have no resume_uploads: show them with zero counts
      try {
        const { data: allProfiles } = await supabase.from('profiles').select('user_id,display_name,email');
        if (allProfiles && allProfiles.length) {
          allProfiles.forEach((p: any) => {
            const uid = p.user_id;
            if (!userMap.has(uid)) {
              const entry: UserUploadStats = {
                key: uid,
                userId: uid,
                name: p.display_name || p.email || '未知用户',
                email: p.email || '-',
                total: 0,
                today: 0,
                pending: 0,
                processing: 0,
                success: 0,
                failed: 0
              };
              userMap.set(uid, entry);
            }
          });
          sortedUsers = Array.from(userMap.values()).sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            return b.today - a.today;
          });
        }
      } catch (e) {
        console.warn('fetch all profiles for zero-fill failed', e);
      }

      const recent = rows.map((row: any) => ({
        uploadId: row.id,
        candidateId: row.candidates?.[0]?.id || row.candidates?.id || null,
        filename: row.filename || '未命名文件',
        userName: (row.user_id && profileMap[row.user_id]?.display_name) || row.uploader_name || row.uploader_email || '未知用户',
        status: mapStatus(row.status),
        error: row.error_reason || null,
        createdAt: row.created_at,
        ossRawPath: row.oss_raw_path || null
      }));
      setSummary({
        totalUploads: total || rows.length,
        todayUploads,
        weekUploads,
        pendingQueue,
        processingUploads,
        successUploads: (successCount as number) || 0,
        failedUploads: (failedCount as number) || 0,
        activeUsers: sortedUsers.length
      });
      // use aggregated user stats computed above (userMap)
      setUserStats(sortedUsers);
      setRecentAll(recent as RecentUpload[]);
      setRecentUploads(recent.slice(0, 20) as RecentUpload[]);
      // persist profile map for later incremental loads
      setProfileMapState(profileMap);

      // persist snapshot so returning from detail can reuse cached data (include scroll)
      try {
        // determine scroll target: detect scrollable ancestor (main / processing-scroll / window)
        const detectScrollInfo = () => {
          try {
            if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
            const container = document.querySelector('.processing-scroll') as HTMLElement | null;
            const winY = window.scrollY || 0;
            if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
            let node: HTMLElement | null = container;
            while (node) {
              try {
                const style = window.getComputedStyle(node);
                const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
                if (canScroll) {
                  if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
                  if (node.classList && node.classList.contains('processing-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.processing-scroll' };
                  return { scrollPosition: node.scrollTop || 0, scrollTarget: 'window' };
                }
              } catch (e) {}
              node = node.parentElement;
            }
            // fallback to document scrollingElement or window
            const docEl = document.scrollingElement as HTMLElement | null;
            if (docEl) return { scrollPosition: docEl.scrollTop || 0, scrollTarget: 'window' };
            return { scrollPosition: 0, scrollTarget: 'window' };
          } catch (e) {
            return { scrollPosition: 0, scrollTarget: 'window' };
          }
        };
        const { scrollPosition, scrollTarget } = detectScrollInfo();
        try { console.log('[ProcessingStats] detected scroll info before save', { scrollPosition, scrollTarget }); } catch (e) {}
        saveProcessingState({
          summary: {
            totalUploads: total || rows.length,
            todayUploads,
            weekUploads,
            pendingQueue,
            processingUploads,
            successUploads: (successCount as number) || 0,
            failedUploads: (failedCount as number) || 0,
            activeUsers: sortedUsers.length
          },
          userStats: sortedUsers,
          recentAll: recent,
          recentDisplayLimit,
          totalCount: total,
          profileMapState: profileMap,
          page,
          userPage,
          filterMode,
          loadProgress,
          scrollPosition,
          scrollTarget
        });
        try { console.log('[ProcessingStats] snapshot saved after fetch', { total, recent: recent.length, scrollPosition, scrollTarget }); } catch (e) {}
      } catch (e) {
        /* swallow */
      }
      // if we are returning from detail, ensure we scroll to bottom now that data is loaded
      try {
        if ((returningFromRef as any).current) {
          console.log('[ProcessingStats] detected returningFromRef during fetch, performing final scroll');
          const el = await waitForElement('.processing-scroll', 7000);
          if (el) {
            const bottom = (el.scrollHeight || 0) - (el.clientHeight || 0);
            try { el.scrollTo({ top: bottom || 0 }); } catch (e) {}
          } else {
            try { window.scrollTo({ top: document.body.scrollHeight || 0 }); } catch (e) {}
          }
          try { (returningFromRef as any).current = false; } catch (e) {}
        }
      } catch (e) {}
    } catch (e: any) {
      console.error('fetchStats failed:', e);
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [recentDisplayLimit, page, userPage, filterMode, loadProgress]);

  // refs for snapshot restore control
  const skipInitialFetchRef = React.useRef(false);
  const returningFromRef = React.useRef(false);
  const restoringRef = React.useRef(false);

  // load cached snapshot once on mount (do not re-run on filter/page changes)
  useEffect(() => {
    if (!isAdmin) return;
    const cached = loadProcessingState();
    if (cached && cached.recentAll && cached.recentAll.length > 0) {
      try {
        // mark restoring so other effects (reset/clamp) don't stomp restored values
        restoringRef.current = true;
        if (cached.summary) setSummary(cached.summary as SummaryStats);
        if (cached.userStats) setUserStats(cached.userStats as UserUploadStats[]);
        if (cached.recentAll) setRecentAll(cached.recentAll as RecentUpload[]);
        if (cached.recentAll) setRecentUploads((cached.recentAll as RecentUpload[]).slice(0, 20));
        if (typeof cached.recentDisplayLimit === 'number') setRecentDisplayLimit(cached.recentDisplayLimit);
        if (typeof cached.totalCount === 'number') setTotalCount(cached.totalCount);
        if (cached.profileMapState) setProfileMapState(cached.profileMapState as any);
        // apply filterMode first so the "reset to first page on filter change" effect
        // doesn't overwrite the restored `page` value.
        if (cached.filterMode) setFilterMode(cached.filterMode as any);
        if (typeof cached.page === 'number') setPage(cached.page);
        if (typeof cached.userPage === 'number') setUserPage(cached.userPage);
        if (typeof cached.loadProgress === 'number') setLoadProgress(cached.loadProgress);
        // restore scroll position after render (wait for element)
        setLoading(false);
        try {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
          if (params && params.get('from')) {
            // skip cached scroll restore to allow URL-driven restore to run
          } else if (cached.scrollTarget === 'window') {
            try { window.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
          } else {
            waitForElement(cached.scrollTarget || '.processing-scroll', 2000).then((scrollEl) => {
              try {
                if (scrollEl && typeof cached.scrollPosition === 'number') scrollEl.scrollTo({ top: cached.scrollPosition || 0 });
              } catch (e) {}
            });
          }
        } catch (e) {
          // ignore
        }
        skipInitialFetchRef.current = true;
        // release restoring flag after a short delay so dependent effects don't overwrite restored values
        setTimeout(() => { try { restoringRef.current = false; } catch (e) {} }, 200);
      } catch (e) {
        // fallthrough to normal fetch if anything goes wrong parsing
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // subscribe to realtime updates and trigger fetch; keep this effect dependent on fetchStats
  useEffect(() => {
    if (!isAdmin) return;
    const subscription = supabase
      .channel('resume_uploads_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_uploads' }, () => {
        fetchStats();
      })
      .subscribe();

    // only call initial fetch if we didn't restore from cache
    if (!skipInitialFetchRef.current) {
      fetchStats();
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdmin, fetchStats]);

  // Ensure scroll and snapshot are restored when navigating back (browser back / bfcache)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreFromStorage = () => {
      try {
        console.log('[ProcessingStats] restoreFromStorage triggered');
        const cached = loadProcessingState();
        console.log('[ProcessingStats] cached loaded in restoreFromStorage', cached);
        if (!cached) return;
        // if URL indicates we're returning from detail, skip this cached restore
        try {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
          if (params && params.get('from')) {
            console.log('[ProcessingStats] skipping cached restore because URL has from param');
            return;
          }
          if ((returningFromRef as any).current) {
            console.log('[ProcessingStats] skipping cached restore because returningFromRef set');
            return;
          }
        } catch (e) {}
        if (cached.recentAll) setRecentAll(cached.recentAll as RecentUpload[]);
        if (cached.userStats) setUserStats(cached.userStats as UserUploadStats[]);
        if (cached.summary) setSummary(cached.summary as SummaryStats);
        if (typeof cached.recentDisplayLimit === 'number') setRecentDisplayLimit(cached.recentDisplayLimit);
        if (typeof cached.totalCount === 'number') setTotalCount(cached.totalCount);
        if (cached.profileMapState) setProfileMapState(cached.profileMapState as any);
        // apply filterMode first so filter-change reset doesn't overwrite page
        restoringRef.current = true;
        if (cached.filterMode) setFilterMode(cached.filterMode as any);
        if (typeof cached.page === 'number') setPage(cached.page);
        if (typeof cached.userPage === 'number') setUserPage(cached.userPage);
        if (typeof cached.loadProgress === 'number') setLoadProgress(cached.loadProgress);
        setTimeout(() => { try { restoringRef.current = false; } catch (e) {} }, 200);
        waitForElement('.processing-scroll', 2000).then((scrollEl) => {
          if (scrollEl && typeof cached.scrollPosition === 'number') scrollEl.scrollTo({ top: cached.scrollPosition || 0 });
        });
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('popstate', restoreFromStorage);
    window.addEventListener('pageshow', restoreFromStorage);
    return () => {
      window.removeEventListener('popstate', restoreFromStorage);
      window.removeEventListener('pageshow', restoreFromStorage);
    };
  }, []);

  const filteredRecent = React.useMemo(() => {
    if (!recentAll || recentAll.length === 0) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const filtered = recentAll.filter((item) => {
      const created = new Date(item.createdAt);
      if (filterMode === 'today' && !(created >= todayStart)) return false;
      if (filterMode === 'week' && !(created >= weekStart)) return false;
      if (filenameQuery && filenameQuery.trim().length > 0) {
        try {
          if (!item.filename.toLowerCase().includes(filenameQuery.trim().toLowerCase())) return false;
        } catch (e) {
          return false;
        }
      }
      return true;
    });
    // ensure sorted by created_at desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [recentAll, filterMode, filenameQuery]);

  const totalPages = Math.max(0, Math.ceil(filteredRecent.length / pageSize));

  // Reset to first page when filter changes
  useEffect(() => {
    if (restoringRef.current) return;
    setPage(1);
  }, [filterMode, filenameQuery]);

  // clamp page when totalPages changes (e.g., after loading more)
  useEffect(() => {
    if (restoringRef.current) return;
    setPage((p) => Math.min(p, totalPages || 1));
  }, [totalPages]);

  // cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (loadIntervalRef.current) {
        clearInterval(loadIntervalRef.current);
        loadIntervalRef.current = null;
      }
    };
  }, []);

  const totalUserPages = Math.max(0, Math.ceil(userStats.length / userPageSize));
  useEffect(() => {
    if (restoringRef.current) return;
    setUserPage(1);
  }, [userStats]);

  const goToUserUploads = (userId: string | null) => {
    if (!userId) return;
    // save snapshot (including scroll) before navigating away
    try {
      const detectScrollInfo = () => {
        try {
          if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
          const container = document.querySelector('.processing-scroll') as HTMLElement | null;
          const winY = window.scrollY || 0;
          if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
          let node: HTMLElement | null = container;
          while (node) {
            try {
              const style = window.getComputedStyle(node);
              const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
              if (canScroll) {
                if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
                if (node.classList && node.classList.contains('processing-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.processing-scroll' };
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
      saveProcessingState({ summary, userStats, recentAll, recentDisplayLimit, totalCount, profileMapState, page, userPage, filterMode, loadProgress, scrollPosition, scrollTarget });
      try { console.log('[ProcessingStats] saved snapshot before navigating to user uploads', { userId, scrollPosition, scrollTarget }); } catch (e) {}
    } catch (e) {}
    router.push(`/upload?userId=${encodeURIComponent(userId)}`);
  };

  const goToResume = (resumeId?: string | null) => {
    if (!resumeId) {
      alert('该上传记录未关联候选人，无法打开候选人详情');
      return;
    }
    // save snapshot (including scroll) before navigating away so returning doesn't reload and scroll is restored
    try {
      const detectScrollInfo = () => {
        try {
          if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
          const container = document.querySelector('.processing-scroll') as HTMLElement | null;
          const winY = window.scrollY || 0;
          if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
          let node: HTMLElement | null = container;
          while (node) {
            try {
              const style = window.getComputedStyle(node);
              const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
              if (canScroll) {
                if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
                if (node.classList && node.classList.contains('processing-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.processing-scroll' };
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
      saveProcessingState({ summary, userStats, recentAll, recentDisplayLimit, totalCount, profileMapState, page, userPage, filterMode, loadProgress, scrollPosition, scrollTarget });
      try { console.log('[ProcessingStats] saved snapshot before navigating to resume', { resumeId, scrollPosition, scrollTarget, page }); } catch (e) {}
      // include minimal navigation state via query params so ResumeDetail can return explicitly
      const qp = `?from=admin_stats&page=${encodeURIComponent(String(page))}`;
      try { console.log('[ProcessingStats] navigating to', `/resumes/${encodeURIComponent(resumeId)}${qp}`); } catch (e) {}
      router.push(`/resumes/${encodeURIComponent(resumeId)}${qp}`);
    } catch (e) {
      router.push(`/resumes/${encodeURIComponent(resumeId)}`);
    }
  };

  // restore when navigated back via direct query params (read from window.location.search)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const from = sp.get('from');
      if (from === 'admin_stats') {
        const p = Number(sp.get('page') || page);
        if (!isNaN(p)) setPage(p);
        // mark we are returning so cached restore won't stomp us
        (returningFromRef as any).current = true;
        // try to read cached scroll target/position and restore that specific surface first
        const cached = loadProcessingState();
        const doScroll = async () => {
          try {
            if (cached && typeof cached.scrollPosition === 'number' && cached.scrollTarget) {
              try { console.log('[ProcessingStats] URL-return detected, restoring cached scrollTarget', cached.scrollTarget, cached.scrollPosition); } catch (e) {}
              if (cached.scrollTarget === 'main') {
                const el = await waitForElement('main', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === '.processing-scroll') {
                const el = await waitForElement('.processing-scroll', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === 'window') {
                try { window.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
                return;
              }
            }
            // fallback: scroll to bottom of whatever exists
            const elFallback = await waitForElement('.processing-scroll', 7000);
            if (elFallback) {
              const bottom = (elFallback.scrollHeight || 0) - (elFallback.clientHeight || 0);
              try { elFallback.scrollTo({ top: bottom || 0 }); } catch (e) {}
            } else {
              try { window.scrollTo({ top: document.body.scrollHeight || 0 }); } catch (e) {}
            }
          } catch (e) {}
        };
        // run multiple retries over 5 seconds
        void doScroll();
        setTimeout(() => { void doScroll(); }, 500);
        setTimeout(() => { void doScroll(); }, 1500);
        setTimeout(() => { void doScroll(); }, 3000);
        setTimeout(() => { void doScroll(); }, 5000);
        // clean url to avoid repeated application
        try { router.replace('/admin/stats'); } catch (e) {}
        // clear returning flag after retries window
        setTimeout(() => { try { (returningFromRef as any).current = false; } catch (e) {} }, 5500);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center text-gray-600">
          <div className="text-lg font-bold text-gray-900 mb-2">处理统计</div>
          <div>无权限访问（仅管理员可见）</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 处理统计</h2>
          <p className="text-gray-500 mt-1">查看全局上传统计，并按用户查看上传记录</p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-2">全部上传</div>
          <div className="text-3xl font-bold text-gray-900">{summary.totalUploads}</div>
          <div className="text-xs text-gray-500 mt-2">今日 {summary.todayUploads} / 近7天 {summary.weekUploads}</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <div className="text-xs text-amber-700 mb-2 flex items-center gap-1.5">
            <Clock size={14} /> 待处理队列
          </div>
          <div className="text-3xl font-bold text-amber-700">{summary.pendingQueue}</div>
          <div className="text-xs text-amber-700/80 mt-2">processing: {summary.processingUploads}</div>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-5">
          <div className="text-xs text-green-700 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> 解析成功
          </div>
          <div className="text-3xl font-bold text-green-700">{summary.successUploads}</div>
          <div className="text-xs text-green-700/80 mt-2">失败: {summary.failedUploads}</div>
        </div>
        <div className="bg-white border border-indigo-200 rounded-xl p-5">
          <div className="text-xs text-indigo-700 mb-2 flex items-center gap-1.5">
            <Users size={14} /> 活跃上传用户
          </div>
          <div className="text-3xl font-bold text-indigo-700">{summary.activeUsers}</div>
          <div className="text-xs text-indigo-700/80 mt-2">可快速查看用户上传记录</div>
        </div>
      </div>

      {loading && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> 统计数据加载中...
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">用户上传统计</div>
        <div className="overflow-auto">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">用户</th>
                <th className="px-6 py-3 font-medium">总上传</th>
                <th className="px-6 py-3 font-medium">今日</th>
                <th className="px-6 py-3 font-medium">待处理</th>
                <th className="px-6 py-3 font-medium">成功</th>
                <th className="px-6 py-3 font-medium">失败</th>
                <th className="px-6 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    暂无上传数据
                  </td>
                </tr>
              ) : (
                (() => {
                  const start = (userPage - 1) * userPageSize;
                  const pageItems = userStats.slice(start, start + userPageSize);
                  return pageItems.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{row.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[280px]">{row.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{row.total}</td>
                      <td className="px-6 py-4 text-gray-700">{row.today}</td>
                      <td className="px-6 py-4 text-amber-700">{row.pending}</td>
                      <td className="px-6 py-4 text-green-700">{row.success}</td>
                      <td className="px-6 py-4 text-red-600">{row.failed}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => goToUserUploads(row.userId)}
                          disabled={!row.userId}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            row.userId
                              ? 'text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                              : 'text-gray-400 border-gray-200 cursor-not-allowed'
                          }`}
                        >
                          <Eye size={14} /> 查看上传
                        </button>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">共 {userStats.length} 条 / 共 {totalUserPages} 页</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] userPage prev clicked, current', userPage); setUserPage((p) => Math.max(1, p - 1)); }}
              disabled={userPage <= 1}
              className={`px-3 py-1 rounded-md border text-sm ${userPage <= 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              上一页
            </button>
            <div className="text-sm text-gray-600">第 {userPage} / {totalUserPages || 0} 页</div>
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] userPage next clicked, current', userPage); setUserPage((p) => Math.min(totalUserPages || 1, p + 1)); }}
              disabled={userPage >= totalUserPages}
              className={`px-3 py-1 rounded-md border text-sm ${userPage >= totalUserPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>上传记录</div>
            <div className="text-sm text-gray-500">共 {filteredRecent.length} 条</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] filter=today clicked'); setFilterMode('today'); }}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'today' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] filter=week clicked'); setFilterMode('week'); }}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'week' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              本周
            </button>
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] filter=all clicked'); setFilterMode('all'); }}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'all' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              全部
            </button>
            <div className="ml-4">
              <input
                type="text"
                placeholder="搜索文件名"
                value={filenameQuery}
                onChange={(e) => setFilenameQuery(e.target.value)}
                className="px-3 py-1 rounded-md border border-gray-200 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="overflow-auto processing-scroll">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                  <th className="px-6 py-3 font-medium">文件名</th>
                  <th className="px-6 py-3 font-medium">上传人</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">错误信息</th>
                  <th className="px-6 py-3 font-medium">上传时间</th>
                  <th className="px-6 py-3 font-medium">重新解析</th>
                  <th className="px-6 py-3 font-medium">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                if (!filteredRecent || filteredRecent.length === 0) return (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      暂无上传数据
                    </td>
                  </tr>
                );

                // use currently loaded subset (controlled by recentDisplayLimit)
                const loaded = filteredRecent.slice(0, recentDisplayLimit);
                if (loaded.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                        暂无上传数据
                      </td>
                    </tr>
                  );
                }
                const start = (page - 1) * pageSize;
                const pageItems = loaded.slice(start, start + pageSize);

                return pageItems.map((item) => (
                  <tr key={item.uploadId} className="hover:bg-gray-50">
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-800 truncate max-w-[480px] cursor-pointer">{item.filename}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-700 cursor-pointer">{item.userName}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 cursor-pointer">
                      {item.status === 'success' && <span className="text-green-700">成功</span>}
                      {item.status === 'failed' && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={14} /> 失败</span>}
                      {item.status === 'processing' && <span className="text-amber-700">处理中</span>}
                    </td>
                    <td className="px-6 py-4 text-red-600 truncate max-w-[280px]" title={(item as any).error || ''}>
                      {item.status === 'failed' ? ((item as any).error || '-') : '-'}
                    </td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-500 cursor-pointer">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('确定要重新解析此上传记录吗？这会重新执行 OCR 识别和 AI 结构化解析。')) return;
                          // set per-row loading flag
                          setLoadingIds((s) => ({ ...s, [item.uploadId]: true }));
                          try {
                            const { error } = await supabase
                              .from('resume_uploads')
                              .update({ status: 'PENDING', error_reason: null, ocr_content: null })
                              .eq('id', item.uploadId);
                            if (error) throw error;
                            alert('已提交重新解析，请等待后端处理完成。');
                            fetchStats();
                          } catch (err: any) {
                            console.error('重新解析提交失败', err);
                            alert('重新解析失败: ' + (err?.message || '未知错误'));
                          } finally {
                            setLoadingIds((s) => {
                              const next = { ...s };
                              delete next[item.uploadId];
                              return next;
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50"
                        disabled={!!loadingIds[item.uploadId]}
                      >
                        {loadingIds[item.uploadId] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 重新解析
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (loadingIds[item.uploadId]) return;
                            goToResume(item.candidateId);
                          }}
                          disabled={!!loadingIds[item.uploadId]}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${loadingIds[item.uploadId] ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
                        >
                          {loadingIds[item.uploadId] ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} 详情
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (loadingIds[item.uploadId]) return;
                            if (!confirm('确定删除该上传记录及其存储文件？此操作不可恢复。')) return;
                            setLoadingIds((s) => ({ ...s, [item.uploadId]: true }));
                            try {
                              // delete storage object if path exists
                              if (item.ossRawPath) {
                                await supabase.storage.from('resume').remove([item.ossRawPath]);
                              }
                              const { error } = await supabase.from('resume_uploads').delete().eq('id', item.uploadId);
                              if (error) throw error;
                              // refresh list
                              fetchStats();
                            } catch (err: any) {
                              console.error('删除失败', err);
                              alert('删除失败: ' + (err?.message || '未知错误'));
                            } finally {
                              setLoadingIds((s) => {
                                const next = { ...s };
                                delete next[item.uploadId];
                                return next;
                              });
                            }
                          }}
                          disabled={!!loadingIds[item.uploadId]}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium ${loadingIds[item.uploadId] ? 'text-gray-400 border-gray-100 cursor-not-allowed' : 'text-red-700 border-red-200 hover:bg-red-50'}`}
                        >
                          {loadingIds[item.uploadId] ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />} 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">共 {filteredRecent.length} 条 (已加载 {Math.min(filteredRecent.length, recentDisplayLimit)}) / 共 {totalPages} 页</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] recent prev clicked, current page', page); setPage((p) => Math.max(1, p - 1)); }}
              disabled={page <= 1}
              className={`px-3 py-1 rounded-md border text-sm ${page <= 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              上一页
            </button>
            <div className="text-sm text-gray-600">第 {page} / {totalPages || 0} 页</div>
            <button
              type="button"
              onClick={() => { console.log('[ProcessingStats] recent next clicked, current page', page); setPage((p) => Math.min(totalPages || 1, p + 1)); }}
              disabled={page >= totalPages}
              className={`px-3 py-1 rounded-md border text-sm ${page >= totalPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              下一页
            </button>
            <button
              type="button"
              onClick={async () => {
                console.log('[ProcessingStats] load more clicked, alreadyLoaded', recentAll.length, 'totalCount', totalCount);
                if (loadingMore) return;
                const alreadyLoaded = recentAll.length;
                if (alreadyLoaded >= totalCount) {
                  alert('没有更多记录可加载');
                  return;
                }
                setLoadingMore(true);
                try {
                  const chunk = 100;
                  const start = alreadyLoaded;
                  const end = Math.min(totalCount - 1, start + chunk - 1);
                  const { data: moreData, error: moreErr } = await supabase
                    .from('resume_uploads')
                    .select('id,user_id,uploader_name,uploader_email,filename,status,error_reason,created_at,oss_raw_path,candidates(id)')
                    .order('created_at', { ascending: false })
                    .range(start, end);
                  if (moreErr) throw moreErr;
                  const newRows = (moreData || []) as any[];

                  // fetch missing profile display names
                  const missingIds = Array.from(new Set(
                    newRows.map((r: any) => r.user_id).filter((id): id is string => !!id).filter(id => !profileMapState[id])
                  ));
                  let profileMap = { ...profileMapState };
                  if (missingIds.length > 0) {
                    const { data: profilesData, error: pErr } = await supabase
                      .from('profiles')
                      .select('user_id,display_name,email')
                      .in('user_id', missingIds);
                    if (!pErr && profilesData) profilesData.forEach((p: any) => { profileMap[p.user_id] = { display_name: p.display_name, email: p.email }; });
                    setProfileMapState(profileMap);
                  }

                  const newRecent = newRows.map((row: any) => ({
                    uploadId: row.id,
                    candidateId: row.candidates?.[0]?.id || row.candidates?.id || null,
                    filename: row.filename || '未命名文件',
                    userName: (row.user_id && profileMap[row.user_id]?.display_name) || row.uploader_name || row.uploader_email || '未知用户',
                    status: mapStatus(row.status),
                    error: row.error_reason || null,
                    createdAt: row.created_at,
                    ossRawPath: row.oss_raw_path || null
                  }));

                  setRecentAll((prev) => {
                    const nextAll = [...prev, ...newRecent];
                    return nextAll;
                  });
                  // expand display limit so appended items become visible
                  setRecentDisplayLimit((prev) => prev + newRecent.length);
                  // do not change the current `page` — keep user's place after append
                  setLoadProgress(Math.round(((alreadyLoaded + newRecent.length) / Math.max(1, totalCount)) * 100));
                } catch (err: any) {
                  console.error('加载更多失败', err);
                  alert('加载更多失败: ' + (err?.message || '未知错误'));
                } finally {
                  setLoadingMore(false);
                }
              }}
              className={`px-3 py-1 rounded-md border text-sm text-gray-700 border-gray-200 hover:bg-gray-50`}
            >
              {loadingMore ? '加载中...' : '加载更多'}
            </button>
          </div>
        </div>
        {/* progress bar showing loaded percent */}
        <div className="px-6 pt-2 pb-4">
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.min(loadProgress, 100)}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">已加载 {recentAll.length} / {totalCount || filteredRecent.length} 条</div>
        </div>
      </div>
    </div>
  );
};
