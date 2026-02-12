'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Users, Eye, Trash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UploadRow {
  id: string;
  user_id: string | null;
  uploader_name: string | null;
  uploader_email: string | null;
  filename: string | null;
  status: string;
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapStatus = (status: string) => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'processing';
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('resume_uploads')
        .select('id,user_id,uploader_name,uploader_email,filename,status,created_at,oss_raw_path,candidates(id)')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (fetchError) throw fetchError;

      const rows = (data || []) as UploadRow[];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      let todayUploads = 0;
      let weekUploads = 0;
      let pendingQueue = 0;
      let processingUploads = 0;
      let successUploads = 0;
      let failedUploads = 0;

      const userMap = new Map<string, UserUploadStats>();

      rows.forEach((row) => {
        const createdAt = new Date(row.created_at);
        const normalized = mapStatus(row.status);
        const isToday = createdAt >= todayStart;
        const isWeek = createdAt >= weekStart;
        const isPendingQueue = row.status === 'PENDING' || row.status === 'OCR_DONE';

        if (isToday) todayUploads += 1;
        if (isWeek) weekUploads += 1;
        if (isPendingQueue) pendingQueue += 1;
        if (normalized === 'success') successUploads += 1;
        if (normalized === 'failed') failedUploads += 1;
        if (normalized === 'processing') processingUploads += 1;

        const key = row.user_id || row.uploader_email || row.id;
        const displayName = row.uploader_name || row.uploader_email || '未知用户';
        const email = row.uploader_email || '-';
        const current = userMap.get(key) || {
          key,
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

        userMap.set(key, current);
      });

      const sortedUsers = Array.from(userMap.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.today - a.today;
      });

      const recent = rows.slice(0, 200).map((row: any) => ({
        uploadId: row.id,
        candidateId: row.candidates?.[0]?.id || row.candidates?.id || null,
        filename: row.filename || '未命名文件',
        userName: row.uploader_name || row.uploader_email || '未知用户',
        status: mapStatus(row.status),
        createdAt: row.created_at,
        ossRawPath: row.oss_raw_path || null
      }));

      setSummary({
        totalUploads: rows.length,
        todayUploads,
        weekUploads,
        pendingQueue,
        processingUploads,
        successUploads,
        failedUploads,
        activeUsers: sortedUsers.length
      });
      setUserStats(sortedUsers);
      setRecentAll(recent as RecentUpload[]);
      setRecentUploads(recent.slice(0, 20) as RecentUpload[]);
    } catch (e: any) {
      console.error('fetchStats failed:', e);
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();

      // 订阅实时更新
      const subscription = supabase
        .channel('resume_uploads_stats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_uploads' }, () => {
          fetchStats();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isAdmin, fetchStats]);

  const filteredRecent = React.useMemo(() => {
    if (!recentAll || recentAll.length === 0) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return recentAll.filter((item) => {
      const created = new Date(item.createdAt);
      if (filterMode === 'today') return created >= todayStart;
      if (filterMode === 'week') return created >= weekStart;
      return true;
    });
  }, [recentAll, filterMode]);

  const totalPages = Math.max(0, Math.ceil(filteredRecent.length / pageSize));

  // Reset to first page when filter or data changes
  useEffect(() => {
    setPage(1);
  }, [filterMode, recentAll]);

  const totalUserPages = Math.max(0, Math.ceil(userStats.length / userPageSize));
  useEffect(() => {
    setUserPage(1);
  }, [userStats]);

  const goToUserUploads = (userId: string | null) => {
    if (!userId) return;
    router.push(`/upload?userId=${encodeURIComponent(userId)}`);
  };

  const goToResume = (resumeId?: string | null) => {
    if (!resumeId) {
      alert('该上传记录未关联候选人，无法打开候选人详情');
      return;
    }
    router.push(`/resumes/${encodeURIComponent(resumeId)}`);
  };

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
              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
              disabled={userPage <= 1}
              className={`px-3 py-1 rounded-md border text-sm ${userPage <= 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              上一页
            </button>
            <div className="text-sm text-gray-600">第 {userPage} / {totalUserPages || 0} 页</div>
            <button
              onClick={() => setUserPage((p) => Math.min(totalUserPages || 1, p + 1))}
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
            <div>最近上传记录</div>
            <div className="text-sm text-gray-500">共 {filteredRecent.length} 条</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'today' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              今日
            </button>
            <button
              onClick={() => setFilterMode('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'week' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              本周
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium border ${filterMode === 'all' ? 'bg-indigo-700 text-white border-indigo-700' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              全部
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">文件名</th>
                <th className="px-6 py-3 font-medium">上传人</th>
                <th className="px-6 py-3 font-medium">状态</th>
                <th className="px-6 py-3 font-medium">上传时间</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                // compute filtered recent list
                if (!recentAll || recentAll.length === 0) return (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      暂无上传数据
                    </td>
                  </tr>
                );

                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

                const filtered = recentAll.filter((item) => {
                  const created = new Date(item.createdAt);
                  if (filterMode === 'today') return created >= todayStart;
                  if (filterMode === 'week') return created >= weekStart;
                  return true;
                }).slice(0, 200);

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                        暂无上传数据
                      </td>
                    </tr>
                  );
                }
                const start = (page - 1) * pageSize;
                const pageItems = filtered.slice(start, start + pageSize);

                return pageItems.map((item) => (
                  <tr key={item.uploadId} className="hover:bg-gray-50">
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-800 truncate max-w-[480px] cursor-pointer">{item.filename}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-700 cursor-pointer">{item.userName}</td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 cursor-pointer">
                      {item.status === 'success' && <span className="text-green-700">成功</span>}
                      {item.status === 'failed' && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={14} /> 失败</span>}
                      {item.status === 'processing' && <span className="text-amber-700">处理中</span>}
                    </td>
                    <td onClick={() => goToResume(item.candidateId)} className="px-6 py-4 text-gray-500 cursor-pointer">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => goToResume(item.candidateId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Eye size={14} /> 详情
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('确定删除该上传记录及其存储文件？此操作不可恢复。')) return;
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
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium text-red-700 border-red-200 hover:bg-red-50"
                        >
                          <Trash size={14} /> 删除
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
          <div className="text-sm text-gray-500">共 {filteredRecent.length} 条 / 共 {totalPages} 页</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-1 rounded-md border text-sm ${page <= 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              上一页
            </button>
            <div className="text-sm text-gray-600">第 {page} / {totalPages || 0} 页</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-1 rounded-md border text-sm ${page >= totalPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
