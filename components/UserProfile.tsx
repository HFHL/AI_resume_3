'use client';

import React, { useEffect, useState } from 'react';
import { LogOut, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ChangePassword } from './ChangePassword';

export const UserProfile: React.FC = () => {
  const { user, displayName, updateDisplayName, signOut } = useAuth();
  const [name, setName] = useState(displayName || '');
  const [saving, setSaving] = useState(false);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (e) {
      console.error('signOut failed:', e);
      window.location.href = '/';
    }
  };

  useEffect(() => {
    setName(displayName || '');
  }, [displayName]);

  const handleSave = async () => {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert('显示名称不能为空');
      return;
    }
    setSaving(true);
    try {
      const { error } = await updateDisplayName(trimmed);
      if (error) throw error;
      alert('显示名称已更新');
    } catch (e: any) {
      console.error('updateDisplayName failed:', e);
      alert(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-gray-500 border-4 border-white shadow-md">
          {(displayName || 'U').charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName || '未设置显示名称'}</h2>
        <p className="text-gray-500 mb-6">个人资料</p>
        
        <div className="text-left mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">显示名称（用于系统内展示）</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="例如：张三 / Alice"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
            >
              <Save size={16} /> 保存
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">登录账号（邮箱/手机号）仅用于登录，不在其他页面展示。</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 text-left">
          <div className="bg-gray-50 p-3 rounded border border-gray-100">
            <div className="text-xs text-gray-400 mb-1">登录账号</div>
            <div className="font-medium text-xs truncate" title={user?.email || ''}>{user?.email || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-100">
            <div className="text-xs text-gray-400 mb-1">用户 ID</div>
            <div className="font-medium text-xs truncate" title={user?.id}>{user?.id}</div>
          </div>
        </div>
        <ChangePassword />

        <button 
          onClick={handleSignOut}
          className="w-full mt-4 flex items-center justify-center gap-2 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
        >
          <LogOut size={16} /> 退出登录
        </button>
      </div>
    </div>
  );
};

