'use client';

import React, { useState } from 'react';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ title, children, isOpen = true }) => {
  const [expanded, setExpanded] = useState(isOpen);

  return (
    <div className="border-b border-gray-200 py-4 last:border-0">
      <div 
        className="flex justify-between items-center mb-3 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <h4 className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">{title}</h4>
        <span className={`text-gray-400 text-xs transform transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </div>
      {expanded && <div className="space-y-2">{children}</div>}
    </div>
  );
};

