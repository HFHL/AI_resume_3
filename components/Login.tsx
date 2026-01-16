'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const { signInWithPassword, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('请填写显示名称');
        }
        const { error, data } = await signUp(email, password, displayName);
        if (error) throw error;
        // Registration becomes an "application": admin must approve before login.
        if (data?.user) {
          setMessage('申请已提交，等待管理员审批。审批通过后才能登录。');
          setIsSignUp(false);
          setPassword('');
        } else {
          setMessage('注册成功！');
        }
      } else {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || (isSignUp ? '注册失败' : '登录失败，请检查邮箱和密码'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">
            AI
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSignUp ? '创建账号' : 'TalentScout 登录'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isSignUp ? '填写以下信息注册新账号' : '欢迎回来，请登录您的账号'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-6 text-sm border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                显示名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="例如：张三 / Alice"
              />
              <p className="text-xs text-gray-500 mt-1">用于系统内展示，不会影响登录账号</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {isSignUp && <p className="text-xs text-gray-500 mt-1">密码长度至少为 6 位</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin mr-2" />
                {isSignUp ? '注册中...' : '登录中...'}
              </>
            ) : (
              isSignUp ? '注册账号' : '登 录'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isSignUp ? '已有账号？' : '还没有账号？'}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
                if (!isSignUp) setDisplayName('');
              }}
              className="ml-1 text-indigo-600 hover:text-indigo-700 font-medium hover:underline focus:outline-none"
            >
              {isSignUp ? '直接登录' : '立即注册'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

