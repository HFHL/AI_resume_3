import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();
  
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-gray-500 border-4 border-white shadow-md">
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">当前用户</h2>
        <p className="text-gray-500 mb-6">{user?.email}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-8 text-left">
           <div className="bg-gray-50 p-3 rounded border border-gray-100">
             <div className="text-xs text-gray-400 mb-1">用户 ID</div>
             <div className="font-medium text-xs truncate" title={user?.id}>{user?.id}</div>
           </div>
           <div className="bg-gray-50 p-3 rounded border border-gray-100">
             <div className="text-xs text-gray-400 mb-1">登录状态</div>
             <div className="font-medium text-green-600">已登录</div>
           </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
        >
          <LogOut size={16} /> 退出登录
        </button>
      </div>
    </div>
  );
};

