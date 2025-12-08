import React from 'react';
import { Plus, Settings } from 'lucide-react';
import { MOCK_JOBS } from '../data/mockData';

export const JobList: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">职位管理与匹配</h2>
          <p className="text-gray-500 mt-1">定义职位 JD，系统自动计算候选人匹配度</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
          <Plus size={18} /> 新增职位
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_JOBS.map(job => (
          <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{job.title}</h3>
                <span className="text-xs text-gray-500">{job.department}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${job.status === 'Open' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {job.status}
              </span>
            </div>
            
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">核心关键词</div>
              <div className="flex flex-wrap gap-2">
                {job.keywords.map(k => (
                  <span key={k} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{k}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-900">{job.candidates_count}</span> 人匹配中
              </div>
              <span>更新于 {job.updated_at}</span>
            </div>
            
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 text-gray-400 hover:text-gray-600"><Settings size={16} /></button>
            </div>
          </div>
        ))}
        
        {/* Add New Placeholder */}
        <button className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
          <Plus size={32} className="mb-2" />
          <span className="font-medium">创建新职位</span>
        </button>
      </div>
    </div>
  );
};

