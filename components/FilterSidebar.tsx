'use client';

import React from 'react';
import { Filter } from 'lucide-react';
import { FilterSection } from './FilterSection';
import { AVAILABLE_TAGS } from '@/data/mockData';
import { FilterState } from '@/types';

interface FilterSidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onReset: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ filters, setFilters, onReset }) => {
  const handleCheckboxChange = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      // @ts-ignore - dynamic key access handling
      const list = prev[category] as string[];
      if (Array.isArray(list)) {
        return list.includes(value) 
          ? { ...prev, [category]: list.filter(i => i !== value) } 
          : { ...prev, [category]: [...list, value] };
      }
      return prev;
    });
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto hidden lg:block p-5 custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Filter size={16} /> 筛选条件</h3>
        <button onClick={onReset} className="text-xs text-indigo-600 hover:underline">重置</button>
      </div>

      <FilterSection title="最高学历">
        {['本科', '硕士', '博士', '专科'].map(d => (
          <label key={d} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={filters.degrees.includes(d)} 
              onChange={() => handleCheckboxChange('degrees', d)} 
              className="rounded border-gray-300 text-indigo-600 w-4 h-4"
            />
            <span className="text-sm text-gray-600">{d}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="院校层次">
        {['985', '211', '双一流', '海外留学'].map(tag => (
          <label key={tag} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={filters.schoolTags.includes(tag)} 
              onChange={() => handleCheckboxChange('schoolTags', tag)} 
              className="rounded border-gray-300 text-indigo-600 w-4 h-4"
            />
            <span className="text-sm text-gray-600">{tag}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="工作年限">
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            placeholder="最低" 
            value={filters.minYears} 
            onChange={(e) => setFilters({...filters, minYears: e.target.value})} 
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
          />
          <span className="text-gray-400 text-sm">年以上</span>
        </div>
      </FilterSection>

      <FilterSection title="标签/技能筛选">
        <div className="mb-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">技术栈</span>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.tech.map(t => (
              <button 
                key={t} 
                onClick={() => handleCheckboxChange('tags', t)} 
                className={`text-xs px-2 py-1 rounded border ${filters.tags.includes(t) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </FilterSection>

      <FilterSection title="特殊筛选">
        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
          <input 
            type="checkbox" 
            checked={filters.special.includes('outsourcing')} 
            onChange={() => handleCheckboxChange('special', 'outsourcing')} 
            className="rounded border-gray-300 text-pink-600 w-4 h-4"
          />
          <span className="text-sm text-gray-600">仅外包经历</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
          <input 
            type="checkbox" 
            checked={filters.special.includes('noPhone')} 
            onChange={() => handleCheckboxChange('special', 'noPhone')} 
            className="rounded border-gray-300 text-orange-500 w-4 h-4"
          />
          <span className="text-sm text-gray-600">仅电话为空</span>
        </label>
      </FilterSection>
    </aside>
  );
};

