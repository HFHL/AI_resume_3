'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Star, ChevronDown, User, UploadCloud, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Login } from '@/components/Login';

interface MainLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, hideHeader = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, displayName, isAdmin, loading: authLoading, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
      router.push('/');
    } catch (e) {
      console.error('signOut failed:', e);
      router.push('/');
    }
  };

  const navItems = [
    { id: 'resumes', label: '简历管理', path: '/resumes' },
    { id: 'jobs', label: '职位匹配', path: '/jobs' },
    { id: 'upload', label: '上传中心', path: '/upload' },
    ...(isAdmin ? [{ id: 'stats', label: '处理统计', path: '/admin/stats' }] : []),
    ...(isAdmin ? [{ id: 'users', label: '用户管理', path: '/admin/users' }] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/resumes') {
      return pathname === '/resumes' || pathname?.startsWith('/resumes/');
    }
    return pathname === path;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={48} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col h-screen">
      {!hideHeader && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm flex-shrink-0">
          <div className="w-full px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8 h-full">
              <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => router.push('/resumes')}
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">AI</div>
                <span className="text-lg font-bold text-gray-900 tracking-tight">TalentScout</span>
              </div>
              <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-500 h-full">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    className={`h-full border-b-2 pt-1 transition-colors ${
                      isActive(item.path)
                        ? 'text-indigo-600 border-indigo-600'
                        : 'border-transparent hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 relative">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Star size={20} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-full pr-3 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {(displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                      <div className="px-4 py-3 border-b border-gray-100 mb-1">
                        <div className="font-medium text-sm text-gray-900 truncate">{displayName || '用户'}</div>
                        <div className="text-xs text-gray-500 truncate">已登录</div>
                      </div>
                      <button
                        onClick={() => { router.push('/profile'); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <User size={14} /> 用户(HR)信息
                      </button>
                      <button
                        onClick={() => { router.push('/upload'); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <UploadCloud size={14} /> 我的上传
                      </button>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut size={14} /> 退出登录
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 w-full flex overflow-hidden">
        {children}
      </main>
    </div>
  );
};
