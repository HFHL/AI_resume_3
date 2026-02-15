'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { waitForElement } from '@/lib/domUtils';
import { loadUserProcessingState, saveUserProcessingState } from '@/lib/userProcessingState';

interface RecentUpload {
  uploadId: string;
  candidateId?: string | null;
  filename: string;
  userName: string;
  status: string;
  createdAt: string;
  ossRawPath?: string | null;
}

interface SummaryStats {
  totalUploads: number;
  todayUploads: number;
  weekUploads: number;
  pendingQueue: number;
  processingUploads: number;
  successUploads: number;
  failedUploads: number;
}

export const UserProcessingStats: React.FC = () => {
  const { user, displayName } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<SummaryStats>({
    totalUploads: 0,
    todayUploads: 0,
    weekUploads: 0,
    pendingQueue: 0,
    processingUploads: 0,
    successUploads: 0,
    failedUploads: 0
  });
  const [recentAll, setRecentAll] = useState<RecentUpload[]>([]);
  const [recentDisplayLimit, setRecentDisplayLimit] = useState<number>(1000);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filterMode, setFilterMode] = useState<'all'|'today'|'week'>('all');
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const returningFromRef = React.useRef(false);

  const mapStatus = (status: string) => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'processing';
  };

  const fetchUserStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Use server-side counts for accuracy
      const [{ count: total }, { count: successCount }, { count: failedCount }, { count: todayCount }, { count: weekCount }, { count: pendingCount }, { count: processingCount }] = await Promise.all([
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id),
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id).eq('status', 'SUCCESS'),
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id).eq('status', 'FAILED'),
        // today
        (async () => {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const { count } = await supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id).gte('created_at', todayStart.toISOString());
          return { count } as any;
        })(),
        // week
        (async () => {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          const { count } = await supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id).gte('created_at', weekStart.toISOString());
          return { count } as any;
        })(),
        // pending (PENDING or OCR_DONE)
        supabase.from('resume_uploads').select('*', { head: true, count: 'exact' }).eq('user_id', user.id).in('status', ['PENDING', 'OCR_DONE']),
        // processing = not success/failed/pending/ocr_done
        (async () => {
          const { count } = await supabase
            .from('resume_uploads')
            .select('*', { head: true, count: 'exact' })
            .eq('user_id', user.id)
            .not('status', 'in', '(SUCCESS,FAILED,PENDING,OCR_DONE)');
          return { count } as any;
        })(),
      ]).then(res => res.map(r => r as any)).catch((e) => { console.warn('server counts failed', e); return [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }]; });

      const totalNum = (total as number) || 0;
      setTotalCount(totalNum);

      // fetch recent rows for table (first page/chunk)
      const { data: rows, error: rowsErr } = await supabase
        .from('resume_uploads')
        .select('id,filename,status,created_at,oss_raw_path,candidates(id),uploader_name,uploader_email')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, Math.min(999, totalNum - 1));
      if (rowsErr) throw rowsErr;

      const recent = (rows || []).map((r: any) => ({
        uploadId: r.id,
        candidateId: r.candidates?.[0]?.id || r.candidates?.id || null,
        filename: r.filename || '未命名文件',
        userName: displayName || r.uploader_name || r.uploader_email || '我',
        status: mapStatus(r.status),
        createdAt: r.created_at,
        ossRawPath: r.oss_raw_path || null
      } as RecentUpload));

      setSummary({
        totalUploads: totalNum,
        todayUploads: (todayCount as number) || 0,
        weekUploads: (weekCount as number) || 0,
        pendingQueue: (pendingCount as number) || 0,
        processingUploads: (processingCount as number) || 0,
        successUploads: (successCount as number) || 0,
        failedUploads: (failedCount as number) || 0
      });

      setRecentAll(recent);
      setRecentDisplayLimit(Math.min(recent.length, 1000));
      setLoadProgress(Math.round((Math.min(recent.length, 1000) / Math.max(1, totalNum)) * 100));
      try {
        const detectScrollInfo = () => {
          try {
            if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
            const container = document.querySelector('.user-processing-scroll') as HTMLElement | null;
            const winY = window.scrollY || 0;
            if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
            let node: HTMLElement | null = container;
            while (node) {
              try {
                const style = window.getComputedStyle(node);
                const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
                if (canScroll) {
                  if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
                  if (node.classList && node.classList.contains('user-processing-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.user-processing-scroll' };
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
        try { console.log('[UserProcessingStats] detected scroll info before save', { scrollPosition, scrollTarget }); } catch (e) {}
        saveUserProcessingState({ summary: { totalUploads: totalNum, todayUploads: (todayCount as number) || 0, weekUploads: (weekCount as number) || 0, pendingQueue: (pendingCount as number) || 0, processingUploads: (processingCount as number) || 0, successUploads: (successCount as number) || 0, failedUploads: (failedCount as number) || 0 }, recentAll: recent, recentDisplayLimit: Math.min(recent.length, 1000), totalCount: totalNum, page, filterMode, loadProgress: Math.round((Math.min(recent.length, 1000) / Math.max(1, totalNum)) * 100), scrollPosition, scrollTarget });
      } catch (e) {}
      // if we're returning from detail, scroll to bottom now that data finished loading
      try {
        if ((returningFromRef as any).current) {
          console.log('[UserProcessingStats] detected returningFromRef during fetchUserStats, performing final scroll');
          const el = await waitForElement('.user-processing-scroll', 7000);
          if (el) {
            const bottom = (el.scrollHeight || 0) - (el.clientHeight || 0);
            try { el.scrollTo({ top: bottom || 0 }); } catch (e) {}
          } else {
            try { window.scrollTo({ top: document.body.scrollHeight || 0 }); } catch (e) {}
          }
          try { (returningFromRef as any).current = false; } catch (e) {}
        }
      } catch (e) {}
    } catch (err: any) {
      console.error('fetchUserStats failed', err);
    } finally {
      setLoading(false);
    }
  }, [user, displayName]);

  useEffect(() => {
    // try restoring snapshot first to avoid refetching when coming back from detail
    const skipInitialRef = { current: false } as any;
    const cached = loadUserProcessingState();
    if (cached && cached.recentAll && cached.recentAll.length > 0) {
      try {
        if (cached.summary) setSummary(cached.summary as SummaryStats);
        if (cached.recentAll) setRecentAll(cached.recentAll as RecentUpload[]);
        if (typeof cached.recentDisplayLimit === 'number') setRecentDisplayLimit(cached.recentDisplayLimit);
        if (typeof cached.totalCount === 'number') setTotalCount(cached.totalCount);
        if (typeof cached.page === 'number') setPage(cached.page);
        if (cached.filterMode) setFilterMode(cached.filterMode as any);
        if (typeof cached.loadProgress === 'number') setLoadProgress(cached.loadProgress);
        setLoading(false);
        // restore scroll according to saved target (skip if URL-driven return will handle it)
        try {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
          if (!(params && params.get('from'))) {
            if (cached.scrollTarget === 'window') {
              try { window.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
            } else {
              waitForElement(cached.scrollTarget || '.user-processing-scroll', 2000).then((el) => {
                try { if (el && typeof cached.scrollPosition === 'number') el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
              });
            }
          }
        } catch (e) {}
        skipInitialRef.current = true;
      } catch (e) {
        // fallthrough
      }
    }
    fetchUserStats();
    // subscribe to realtime updates for this user's uploads
    if (!user?.id) return;
    const sub = supabase
      .channel(`resume_uploads_user_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_uploads', filter: `user_id=eq.${user.id}` }, () => fetchUserStats())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [user, fetchUserStats]);

  // restore on popstate/pageshow
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restore = () => {
      try {
        // skip cached restore if URL indicates returning from detail
        try {
          const params = new URLSearchParams(window.location.search || '');
          if (params.get('from')) return;
        } catch (e) {}
        const cached = loadUserProcessingState();
        if (!cached) return;
        if (cached.summary) setSummary(cached.summary as SummaryStats);
        if (cached.recentAll) setRecentAll(cached.recentAll as RecentUpload[]);
        if (typeof cached.recentDisplayLimit === 'number') setRecentDisplayLimit(cached.recentDisplayLimit);
        if (typeof cached.totalCount === 'number') setTotalCount(cached.totalCount);
        if (typeof cached.page === 'number') setPage(cached.page);
        if (cached.filterMode) setFilterMode(cached.filterMode as any);
        if (typeof cached.loadProgress === 'number') setLoadProgress(cached.loadProgress);
        waitForElement('.user-processing-scroll', 2000).then((el) => {
          if (el && typeof cached.scrollPosition === 'number') el.scrollTo({ top: cached.scrollPosition || 0 });
        });
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

  const filteredRecent = React.useMemo(() => {
    if (!recentAll || recentAll.length === 0) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const filtered = recentAll.filter((item) => {
      const created = new Date(item.createdAt);
      if (filterMode === 'today') return created >= todayStart;
      if (filterMode === 'week') return created >= weekStart;
      return true;
    });
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [recentAll, filterMode]);

  const totalPages = Math.max(0, Math.ceil(filteredRecent.length / pageSize));

  useEffect(() => { setPage(1); }, [filterMode]);
  useEffect(() => { setPage((p) => Math.min(p, totalPages || 1)); }, [totalPages]);

  const goToResume = (resumeId?: string | null) => {
    if (!resumeId) return;
    try {
      const detectScrollInfo = () => {
        try {
          if (typeof window === 'undefined') return { scrollPosition: 0, scrollTarget: 'window' };
          const container = document.querySelector('.user-processing-scroll') as HTMLElement | null;
          const winY = window.scrollY || 0;
          if (winY && winY > 0) return { scrollPosition: winY, scrollTarget: 'window' };
          let node: HTMLElement | null = container;
          while (node) {
            try {
              const style = window.getComputedStyle(node);
              const canScroll = (node.scrollHeight || 0) > (node.clientHeight || 0) && /(auto|scroll)/.test(style.overflowY || '');
              if (canScroll) {
                if (node.tagName === 'MAIN') return { scrollPosition: node.scrollTop || 0, scrollTarget: 'main' };
                if (node.classList && node.classList.contains('user-processing-scroll')) return { scrollPosition: node.scrollTop || 0, scrollTarget: '.user-processing-scroll' };
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
      saveUserProcessingState({ summary, recentAll, recentDisplayLimit, totalCount, page, filterMode, loadProgress, scrollPosition, scrollTarget });
      try { console.log('[UserProcessingStats] saved snapshot before navigating to resume', { resumeId, scrollPosition, scrollTarget, page }); } catch (e) {}
      const qp = `?from=user_stats&page=${encodeURIComponent(String(page))}`;
      try { console.log('[UserProcessingStats] navigating to', `/resumes/${encodeURIComponent(resumeId)}${qp}`); } catch (e) {}
      router.push(`/resumes/${encodeURIComponent(resumeId)}${qp}`);
    } catch (e) {
      router.push(`/resumes/${encodeURIComponent(resumeId)}`);
    }
  };

  // restore when navigated back via query params (read from window.location.search)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const from = sp.get('from');
      if (from === 'user_stats') {
        const p = Number(sp.get('page') || page);
        if (!isNaN(p)) setPage(p);
        // mark returning
        (returningFromRef as any).current = true;
        const cached = loadUserProcessingState();
        const doScroll = async () => {
          try {
            if (cached && typeof cached.scrollPosition === 'number' && cached.scrollTarget) {
              try { console.log('[UserProcessingStats] URL-return detected, restoring cached scrollTarget', cached.scrollTarget, cached.scrollPosition); } catch (e) {}
              if (cached.scrollTarget === 'main') {
                const el = await waitForElement('main', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === '.user-processing-scroll') {
                const el = await waitForElement('.user-processing-scroll', 7000);
                if (el) { try { el.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {} ; return; }
              } else if (cached.scrollTarget === 'window') {
                try { window.scrollTo({ top: cached.scrollPosition || 0 }); } catch (e) {}
                return;
              }
            }
            const elFallback = await waitForElement('.user-processing-scroll', 7000);
            if (elFallback) {
              const bottom = (elFallback.scrollHeight || 0) - (elFallback.clientHeight || 0);
              try { elFallback.scrollTo({ top: bottom || 0 }); } catch (e) {}
            } else {
              try { window.scrollTo({ top: document.body.scrollHeight || 0 }); } catch (e) {}
            }
          } catch (e) {}
        };
        void doScroll();
        setTimeout(() => { void doScroll(); }, 500);
        setTimeout(() => { void doScroll(); }, 1500);
        setTimeout(() => { void doScroll(); }, 3000);
        setTimeout(() => { void doScroll(); }, 5000);
        try { router.replace('/my-stats'); } catch (e) {}
        setTimeout(() => { try { (returningFromRef as any).current = false; } catch (e) {} }, 5500);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 用户处理统计</h2>
          <p className="text-gray-500 mt-1">仅显示您自己的上传与处理状态</p>
        </div>
        <button
          onClick={fetchUserStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>上传记录</div>
            <div className="text-sm text-gray-500">共 {filteredRecent.length} 条</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'today' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >今日</button>
            <button
              onClick={() => setFilterMode('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'week' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >本周</button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'all' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >全部</button>
          </div>
        </div>
        <div className="overflow-auto user-processing-scroll">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">文件名</th>
                <th className="px-6 py-3 font-medium">上传时间</th>
                <th className="px-6 py-3 font-medium">状态</th>
                <th className="px-6 py-3 font-medium">重新解析</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                if (!filteredRecent || filteredRecent.length === 0) return (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">暂无上传数据</td>
                  </tr>
                );

                const loaded = filteredRecent.slice(0, recentDisplayLimit);
                if (loaded.length === 0) return (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">暂无上传数据</td>
                  </tr>
                );

                const start = (page - 1) * pageSize;
                const pageItems = loaded.slice(start, start + pageSize);

                return pageItems.map((item) => (
                  <tr key={item.uploadId} className="hover:bg-gray-50">
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-800 truncate max-w-[480px] cursor-pointer">{item.filename}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-500 cursor-pointer">{new Date(item.createdAt).toLocaleString()}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 cursor-pointer">
                      {item.status === 'success' && <span className="text-green-700">成功</span>}
                      {item.status === 'failed' && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={14} /> 失败</span>}
                      {item.status === 'processing' && <span className="text-amber-700">处理中</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('确定要重新解析此上传记录吗？这会重新执行 OCR 识别和 AI 结构化解析。')) return;
                          setLoadingIds((s) => ({ ...s, [item.uploadId]: true }));
                          try {
                            const { error } = await supabase
                              .from('resume_uploads')
                              .update({ status: 'PENDING', error_reason: null, ocr_content: null })
                              .eq('id', item.uploadId);
                            if (error) throw error;
                            alert('已提交重新解析，请等待后端处理完成。');
                            fetchUserStats();
                          } catch (err: any) {
                            console.error('重新解析提交失败', err);
                            alert('重新解析失败: ' + (err?.message || '未知错误'));
                          } finally {
                            setLoadingIds((s) => { const next = { ...s }; delete next[item.uploadId]; return next; });
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
                          onClick={(e) => { e.stopPropagation(); goToResume(item.candidateId); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-indigo-700 border-indigo-200 hover:bg-indigo-50`}
                        >
                          <Eye size={14} /> 详情
                        </button>
                        {/* 删除按钮 intentionally removed for user-scoped page */}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-1 rounded-md border text-sm ${page <= 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >上一页</button>
            <div className="text-sm text-gray-600">第 {page} / {totalPages || 0} 页</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-1 rounded-md border text-sm ${page >= totalPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >下一页</button>
            <button
              onClick={async () => {
                if (loadingMore) return;
                const alreadyLoaded = recentAll.length;
                if (alreadyLoaded >= totalCount) { alert('没有更多记录可加载'); return; }
                setLoadingMore(true);
                try {
                  const chunk = 100;
                  const start = alreadyLoaded;
                  const end = Math.min(totalCount - 1, start + chunk - 1);
                  const { data: moreData, error: moreErr } = await supabase
                    .from('resume_uploads')
                    .select('id,filename,status,created_at,oss_raw_path,candidates(id),uploader_name,uploader_email')
                    .eq('user_id', user?.id)
                    .order('created_at', { ascending: false })
                    .range(start, end);
                  if (moreErr) throw moreErr;
                  const newRows = (moreData || []) as any[];
                  const newRecent = newRows.map((row: any) => ({
                    uploadId: row.id,
                    candidateId: row.candidates?.[0]?.id || row.candidates?.id || null,
                    filename: row.filename || '未命名文件',
                    userName: displayName || row.uploader_name || row.uploader_email || '我',
                    status: mapStatus(row.status),
                    createdAt: row.created_at,
                    ossRawPath: row.oss_raw_path || null
                  }));

                  setRecentAll((prev) => {
                    const nextAll = [...prev, ...newRecent];
                    return nextAll;
                  });
                  setRecentDisplayLimit((prev) => prev + newRecent.length);
                  setLoadProgress(Math.round(((alreadyLoaded + newRecent.length) / Math.max(1, totalCount)) * 100));
                } catch (err: any) {
                  console.error('加载更多失败', err);
                  alert('加载更多失败: ' + (err?.message || '未知错误'));
                } finally {
                  setLoadingMore(false);
                }
              }}
              className={`px-3 py-1 rounded-md border text-sm text-gray-700 border-gray-200 hover:bg-gray-50`}
            >{loadingMore ? '加载中...' : '加载更多'}</button>
          </div>
        </div>
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
