'use client';

import { useEffect } from 'react';

interface ImageFile {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
  typeLabel: string;
}

interface ImageSliderModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageFile[];
  initialIndex: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export default function ImageSliderModal({
  isOpen,
  onClose,
  images,
  initialIndex,
  currentIndex,
  onIndexChange,
}: ImageSliderModalProps) {
  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        title="닫기 (ESC)"
      >
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 이미지 정보 (상단) */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-3">
          {/* 타입 배지 */}
          <span className={`px-3 py-1.5 text-sm font-medium rounded-lg shadow-lg ${
            currentImage.fileTypeFlag === 'FINAL_MANUSCRIPT'
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white'
          }`}>
            {currentImage.typeLabel}
          </span>

          {/* 파일명 */}
          {/* <span className="text-white text-sm font-medium bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            {currentImage.fileName}
          </span> */}

          {/* 카운터 */}
          {/* <span className="text-white text-sm bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </span> */}
        </div>
      </div>

      {/* 이전 버튼 */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="이전 (←)"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 다음 버튼 */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="다음 (→)"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 메인 이미지 */}
      <div
        className="relative max-w-7xl max-h-[90vh] mx-auto px-20"
        onClick={(e) => e.stopPropagation()}
      >
        {currentImage.thumbnailUrl || currentImage.fileUrl ? (
          <img
            src={currentImage.fileUrl}
            alt={currentImage.fileName}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="w-96 h-96 bg-gray-800 rounded-lg flex items-center justify-center">
            <svg className="w-24 h-24 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* 하단 액션 버튼 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {/* 다운로드 버튼 */}
        <a
          href={currentImage.fileUrl}
          download
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-colors backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="text-sm font-medium">다운로드</span>
        </a>

        {/* 원본 보기 버튼 */}
        <a
          href={currentImage.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-colors backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="text-sm font-medium">새 탭에서 보기</span>
        </a>
      </div>

      {/* 썸네일 네비게이션 (5개 이상일 때만 표시) */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/30 px-4 py-3 rounded-lg backdrop-blur-sm">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(idx);
              }}
              className={`relative w-16 h-16 rounded overflow-hidden transition-all ${
                idx === currentIndex
                  ? 'ring-2 ring-white scale-110'
                  : 'opacity-60 hover:opacity-100'
              }`}
              title={img.fileName}
            >
              {img.thumbnailUrl ? (
                <img
                  src={img.thumbnailUrl}
                  alt={img.fileName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* 타입 표시 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                <span className={`text-[10px] font-medium ${
                  img.fileTypeFlag === 'FINAL_MANUSCRIPT' ? 'text-green-400' : 'text-blue-400'
                }`}>
                  {img.typeLabel}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
