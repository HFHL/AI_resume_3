'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const ChangePassword: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    setError(null);
    if (!newPassword || newPassword.length < 8) {
      setError('新密码长度至少 8 位');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!user?.email) {
      setError('无法获取当前用户信息');
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      // If user provided current password, try re-authenticating first to verify.
      if (currentPassword) {
        const { error: signinErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signinErr) {
          throw new Error(signinErr.message || '当前密码验证失败');
        }
      }

      // Update password for current session/user
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      setMessage('密码已更新成功。请使用新密码登录（如果需要请重新登录）。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('change password failed', err);
      setError(err?.message || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-white border border-gray-100 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-2">修改密码</h3>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <div>
          <label className="text-xs text-gray-600">当前密码（可留空以直接修改）</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="当前密码（如果你记得）"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="至少 8 位"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="再次输入新密码"
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {message && <div className="text-sm text-green-700">{message}</div>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? '处理中...' : '修改密码'}
          </button>
        </div>
      </form>
    </div>
  );
};
