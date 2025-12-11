'use client';

import React from 'react';

interface ContentListItemProps {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileType: string;
  uploaderName: string;
  tags?: string[];
  createdAt: string;
  onClick?: () => void;
}

export default function ContentListItem({
  id,
  title,
  description,
  thumbnailUrl,
  fileType,
  uploaderName,
  tags = [],
  createdAt,
  onClick,
}: ContentListItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div
      onClick={onClick}
      className="flex items-start space-x-4 p-4 bg-white border border-[#E0E0E0] rounded-lg hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* 썸네일 */}
      <div className="flex-shrink-0 w-32 h-24 bg-[#F5F5F5] rounded overflow-hidden">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-4xl text-gray-300">
              {fileType === 'image' && '🖼️'}
              {fileType === 'video' && '🎥'}
              {fileType === 'document' && '📄'}
              {fileType === 'design' && '🎨'}
              {fileType === 'archive' && '📦'}
            </div>
          </div>
        )}
      </div>

      {/* 콘텐츠 정보 */}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-[#333333] mb-1 truncate">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{description}</p>
        )}

        {/* 태그 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.slice(0, 5).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-blue-50 text-[#0046FF] rounded"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 5 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                +{tags.length - 5}
              </span>
            )}
          </div>
        )}

        {/* 메타 정보 */}
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>{uploaderName}</span>
          <span>•</span>
          <span>{formatDate(createdAt)}</span>
          <span>•</span>
          <span className="capitalize">{fileType}</span>
        </div>
      </div>
    </div>
  );
}
