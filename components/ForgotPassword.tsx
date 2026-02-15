"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChangePassword } from './ChangePassword';

export const ForgotPassword: React.FC = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    // If already logged in, reuse the ChangePassword UI
    return <ChangePassword />;
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('新密码长度至少 8 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || '重置失败');
      setMessage('密码已重置成功。你现在可以使用新密码登录。');
      setEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('forgot password failed', err);
      setError(err?.message || '发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-xl font-bold">重置密码</h2>
          <p className="text-sm text-gray-500 mt-1">请输入你的注册邮箱和新密码，系统将直接替你更新密码（无需邮箱验证）。</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{message}</div>}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">邮箱地址</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="至少 8 位"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="再次输入新密码"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? '提交中...' : '重置密码'}
            </button>
            <a href="/" className="text-sm text-gray-600 hover:underline">返回登录</a>
          </div>
        </form>
      </div>
    </div>
  );
};
