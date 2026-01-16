import React from 'react';

interface TagProps {
  text: string;
  type?: 'default' | 'tech' | 'school' | 'company' | 'danger' | 'success';
  size?: 'sm' | 'xs';
}

export const Tag: React.FC<TagProps> = ({ text, type = 'default', size = 'sm' }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-600 border-gray-200',
    tech: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    school: 'bg-orange-50 text-orange-700 border-orange-100',
    company: 'bg-blue-50 text-blue-700 border-blue-100',
    danger: 'bg-red-50 text-red-600 border-red-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded border ${styles[type]} ${sizeClass} font-medium mr-2 mb-1`}>
      {text}
    </span>
  );
};

