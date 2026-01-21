'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const ProcessingStats: React.FC = () => {
  const { isAdmin } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // 统计待处理数量（PENDING + OCR_DONE）
      const { count, error: fetchError } = await supabase
        .from('resume_uploads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'OCR_DONE']);

      if (fetchError) throw fetchError;
      setPendingCount(count || 0);
    } catch (e: any) {
      console.error('fetchStats failed:', e);
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

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
  }, [isAdmin]);

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
    <div className="p-8 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 处理统计</h2>
          <p className="text-gray-500 mt-1">查看待处理简历数量</p>
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

      {/* 待处理数量卡片 */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-8 text-white shadow-lg shadow-amber-200">
        <div className="flex items-center justify-between mb-6">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <Clock size={28} />
          </div>
          <span className="text-amber-100 text-sm font-medium">⏳ 待处理简历</span>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-3">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-xl">加载中...</span>
          </div>
        ) : (
          <>
            <div className="text-6xl font-bold mb-2">{pendingCount}</div>
            <div className="text-amber-100">份简历等待处理</div>
          </>
        )}
      </div>
    </div>
  );
};
