'use client';

import React from 'react';
import Image from 'next/image';

interface ContentCardProps {
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

export default function ContentCard({
  id,
  title,
  description,
  thumbnailUrl,
  fileType,
  uploaderName,
  tags = [],
  createdAt,
  onClick,
}: ContentCardProps) {
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
      className="group bg-white rounded-lg border border-[#E0E0E0] overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
    >
      {/* 썸네일 */}
      <div className="relative aspect-[4/3] bg-[#F5F5F5] overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl text-gray-300">
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
      <div className="p-4">
        <h3 className="text-lg font-semibold text-[#333333] line-clamp-2 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{description}</p>
        )}

        {/* 태그 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-blue-50 text-[#0046FF] rounded"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 메타 정보 */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{uploaderName}</span>
          <span>{formatDate(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
