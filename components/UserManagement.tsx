'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Shield, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile, UserRole, ApprovalStatus } from '@/types';

export const UserManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,display_name,role,approval_status,created_at,updated_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setRows((data || []) as any);
    } catch (e: any) {
      console.error('fetchUsers failed:', e);
      setError(e?.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const pending = useMemo(() => rows.filter(r => r.approval_status === 'pending'), [rows]);
  const approved = useMemo(() => rows.filter(r => r.approval_status === 'approved'), [rows]);
  const rejected = useMemo(() => rows.filter(r => r.approval_status === 'rejected'), [rows]);

  const updateUser = async (userId: string, patch: Partial<Pick<UserProfile, 'approval_status' | 'role'>>) => {
    setActingId(userId);
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('user_id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (e: any) {
      console.error('updateUser failed:', e);
      alert(e?.message || '操作失败（请确认已执行 SQL migration + 管理员权限正确）');
    } finally {
      setActingId(null);
    }
  };

  const setApproval = (userId: string, status: ApprovalStatus) =>
    updateUser(userId, { approval_status: status });

  const setRole = (userId: string, role: UserRole) => updateUser(userId, { role });

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center text-gray-600">
          <div className="text-lg font-bold text-gray-900 mb-2">用户管理</div>
          <div>无权限访问（仅管理员可见）</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">用户管理（注册审批）</h2>
          <p className="text-gray-500 mt-1">查看待审批用户，支持通过/拒绝与授予管理员</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UserListCard
          title={`待审批（${pending.length}）`}
          rows={pending}
          actingId={actingId}
          onApprove={(id) => setApproval(id, 'approved')}
          onReject={(id) => setApproval(id, 'rejected')}
          onSetRole={setRole}
          showApprovalActions
        />
        <UserListCard
          title={`已通过（${approved.length}）`}
          rows={approved}
          actingId={actingId}
          onApprove={(id) => setApproval(id, 'approved')}
          onReject={(id) => setApproval(id, 'rejected')}
          onSetRole={setRole}
        />
        <UserListCard
          title={`已拒绝（${rejected.length}）`}
          rows={rejected}
          actingId={actingId}
          onApprove={(id) => setApproval(id, 'approved')}
          onReject={(id) => setApproval(id, 'rejected')}
          onSetRole={setRole}
        />
      </div>
    </div>
  );
};

const RoleBadge = ({ role }: { role: string }) => {
  const cls =
    role === 'super_admin'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : role === 'admin'
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-gray-100 text-gray-700 border-gray-200';
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{role}</span>;
};

const StatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === 'approved'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>;
};

const UserListCard = ({
  title,
  rows,
  actingId,
  onApprove,
  onReject,
  onSetRole,
  showApprovalActions,
}: {
  title: string;
  rows: UserProfile[];
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSetRole: (id: string, role: UserRole) => void;
  showApprovalActions?: boolean;
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 font-bold text-gray-800">
        {title}
      </div>
      <div className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">暂无数据</div>
        ) : (
          rows.map((u) => {
            const busy = actingId === u.user_id;
            const status = String((u as any).approval_status || '').trim().toLowerCase();
            const canToggleLogin = status !== 'pending' && status !== '';
            const isApproved = status === 'approved';
            const isRejected = status === 'rejected';
            return (
              <div key={u.user_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{u.display_name}</div>
                    <div className="text-xs text-gray-500 truncate" title={u.email || ''}>
                      {u.email || '-'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={u.approval_status} />
                      <RoleBadge role={u.role} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* 待审批用户：显示通过/拒绝按钮 */}
                    {showApprovalActions && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => onApprove(u.user_id)}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-1.5 text-xs"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          通过
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onReject(u.user_id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5 text-xs"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          拒绝
                        </button>
                      </>
                    )}

                    {/* 启用 / 禁用账号（控制是否允许登录）
                        注意：有些历史数据可能存在大小写/空格导致判断不命中，这里统一做 trim+lower 并加兜底。
                     */}
                    {canToggleLogin && (
                      <button
                        disabled={busy}
                        onClick={() => (isApproved ? onReject(u.user_id) : onApprove(u.user_id))}
                        className={
                          isApproved
                            ? 'px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 disabled:opacity-60 flex items-center gap-1.5 text-xs'
                            : 'px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 disabled:opacity-60 flex items-center gap-1.5 text-xs'
                        }
                        title={
                          isApproved
                            ? '禁用账号（该用户将无法再登录）'
                            : isRejected
                              ? '启用账号（允许该用户重新登录）'
                              : `切换登录状态（当前 status=${status || '-'})`
                        }
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isApproved ? (
                          <XCircle size={14} />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        {isApproved ? '禁用账号' : '启用账号'}
                      </button>
                    )}

                    <button
                      disabled={busy}
                      onClick={() => onSetRole(u.user_id, u.role === 'admin' ? 'user' : 'admin')}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1.5 text-xs text-gray-700"
                      title="授予/取消管理员权限（不影响登录，仅影响是否有管理权限）"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                      {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

