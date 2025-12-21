import React from 'react';
import { 
  Search, Trash2, Download, User, Briefcase, GraduationCap, MapPin, 
  Phone, Building2, MoreHorizontal 
} from 'lucide-react';
import { Tag } from './Tag';
import { Pagination } from './Pagination';
import { Candidate, FilterState } from '../types';

interface ResumeListProps {
  candidates: Candidate[];
  allCandidates: Candidate[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onUploadClick: () => void;
  onCandidateClick: (id: string) => void;
}

export const ResumeList: React.FC<ResumeListProps> = ({ 
  candidates,
  allCandidates,
  filters, 
  setFilters, 
  selectedIds, 
  setSelectedIds,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onUploadClick,
  onCandidateClick
}) => {
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    // 只选择当前页的候选人
    setSelectedIds(selectedIds.length === candidates.length ? [] : candidates.map(c => c.id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50">
      <div className="bg-white p-5 border-b border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm z-10 min-h-[80px]">
        <div className="relative w-full md:w-96 flex items-center gap-4">
          <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" 
              checked={candidates.length > 0 && selectedIds.length === candidates.length} 
              onChange={handleSelectAll} 
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">全选</span>
          </div>
          {selectedIds.length > 0 ? (
            <span className="text-sm font-medium text-gray-700 animate-in fade-in">已选 {selectedIds.length} 项</span>
          ) : (
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="搜索候选人..." 
                value={filters.search} 
                onChange={(e) => setFilters({...filters, search: e.target.value})} 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {selectedIds.length > 0 ? (
            <button 
              onClick={() => {alert(`删除 ${selectedIds.length} 项`); setSelectedIds([])}} 
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium hover:bg-red-100"
            >
              <Trash2 size={16} /> 批量删除
            </button>
          ) : (
            <>
              <span className="text-sm text-gray-500 whitespace-nowrap">共 <strong className="text-gray-900">{allCandidates.length}</strong> 份</span>
              <div className="h-4 w-px bg-gray-300 mx-2"></div>
            </>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 text-gray-700">
            <Download size={16} /> 导出
          </button>
          <button onClick={onUploadClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 shadow-sm">
            + 上传
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <User size={64} className="mb-4 text-gray-300" />
            <p>没有找到匹配的候选人</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {candidates.map(c => (
              <div key={c.id} className={`bg-white rounded-lg border p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 group relative ${selectedIds.includes(c.id) ? 'border-indigo-400 ring-1 ring-indigo-100 bg-indigo-50/10' : 'border-gray-200'}`}>
                <div className="flex items-start pt-4 md:pt-0">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 cursor-pointer mt-1" 
                    checked={selectedIds.includes(c.id)} 
                    onChange={() => toggleSelection(c.id)} 
                  />
                </div>
                <div className="flex-shrink-0 flex flex-col items-center md:items-start min-w-[120px]">
                  <img src={c.avatar} alt={c.name} className="w-16 h-16 rounded-full bg-gray-100 mb-3 object-cover border-2 border-white shadow-sm" />
                  <div className="text-xs text-gray-400 mb-1">{c.last_active}活跃</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 cursor-pointer" onClick={() => onCandidateClick(c.id)}>{c.name}</h3>
                    <span className="text-sm text-gray-500">|</span>
                    <span className="text-sm text-gray-700 font-medium">{c.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3 items-center">
                    <div className="flex items-center gap-1.5"><Briefcase size={14} className="text-gray-400" /><span>{c.work_years}年经验</span></div>
                    <div className="flex items-center gap-1.5"><GraduationCap size={14} className="text-gray-400" /><span>{c.school.name}</span><span className="text-xs text-gray-400">({c.degree})</span></div>
                    <div className="flex items-center gap-1.5"><MapPin size={14} className="text-gray-400" /><span>{c.location}</span></div>
                    {c.phone ? <div className="flex items-center gap-1.5 text-gray-400"><Phone size={14} /><span>{c.phone}</span></div> : <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">未解析电话</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded w-fit max-w-full">
                    <Building2 size={14} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-800">{c.company}</span>
                    {c.is_outsourcing && <span className="text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded border border-pink-200">外包</span>}
                    {c.company_tags.map(tag => <span key={tag} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200">{tag}</span>)}
                  </div>
                  <div className="flex flex-wrap items-center">
                    {c.school.tags.map(t => <Tag key={t} text={t} type="school" size="xs" />)}
                    {c.skills.map(s => <Tag key={s} text={s} type="tech" size="xs" />)}
                  </div>
                </div>
                <div className="flex flex-row md:flex-col justify-end md:justify-center gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 mt-2 md:mt-0">
                  <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="查看详情"><MoreHorizontal size={20} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {allCandidates.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={allCandidates.length}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
