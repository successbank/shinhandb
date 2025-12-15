'use client';

import React from 'react';

interface FileTypeSelectorProps {
  value: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
  onChange: (value: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') => void;
  disabled?: boolean;
  name?: string; // 각 파일마다 고유한 name을 위한 prop
}

export default function FileTypeSelector({
  value,
  onChange,
  disabled = false,
  name = 'fileType',
}: FileTypeSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center cursor-pointer">
        <input
          type="radio"
          name={name}
          value="PROPOSAL_DRAFT"
          checked={value === 'PROPOSAL_DRAFT'}
          onChange={(e) => onChange(e.target.value as 'PROPOSAL_DRAFT')}
          disabled={disabled}
          className="w-4 h-4 text-[#0046FF] border-gray-300 focus:ring-[#0046FF] cursor-pointer"
        />
        <span className="ml-2 text-sm text-[#333333]">제안 시안</span>
      </label>

      <label className="flex items-center cursor-pointer">
        <input
          type="radio"
          name={name}
          value="FINAL_MANUSCRIPT"
          checked={value === 'FINAL_MANUSCRIPT'}
          onChange={(e) => onChange(e.target.value as 'FINAL_MANUSCRIPT')}
          disabled={disabled}
          className="w-4 h-4 text-[#0046FF] border-gray-300 focus:ring-[#0046FF] cursor-pointer"
        />
        <span className="ml-2 text-sm text-[#333333]">최종 원고</span>
      </label>
    </div>
  );
}
