'use client';

import React from 'react';

interface UploadProgressProps {
  percentage: number;
  fileName?: string;
  status?: 'uploading' | 'success' | 'error';
  error?: string;
}

export default function UploadProgress({
  percentage,
  fileName,
  status = 'uploading',
  error,
}: UploadProgressProps) {
  return (
    <div className="w-full p-4 bg-white border border-[#E0E0E0] rounded-lg shadow-sm">
      {/* 파일명 */}
      {fileName && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-[#333333] truncate">{fileName}</p>
          <span
            className={`text-sm font-medium ${
              status === 'success'
                ? 'text-[#43A047]'
                : status === 'error'
                ? 'text-[#E53935]'
                : 'text-[#0046FF]'
            }`}
          >
            {status === 'success'
              ? '완료'
              : status === 'error'
              ? '실패'
              : `${percentage}%`}
          </span>
        </div>
      )}

      {/* 프로그레스 바 */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-300 ease-out ${
            status === 'success'
              ? 'bg-[#43A047]'
              : status === 'error'
              ? 'bg-[#E53935]'
              : 'bg-[#0046FF]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 에러 메시지 */}
      {status === 'error' && error && (
        <p className="mt-2 text-xs text-[#E53935]">{error}</p>
      )}

      {/* 성공 메시지 */}
      {status === 'success' && (
        <p className="mt-2 text-xs text-[#43A047]">업로드가 완료되었습니다</p>
      )}
    </div>
  );
}
