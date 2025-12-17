'use client';

import { useEffect } from 'react';
import { initKakao, shareKakao, copyToClipboard } from '@/lib/kakao';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: {
    title: string;
    description: string;
    imageUrl: string;
    webUrl: string;
  };
}

export default function ShareModal({ isOpen, onClose, shareData }: ShareModalProps) {
  useEffect(() => {
    // 카카오 SDK 초기화
    initKakao();
  }, []);

  if (!isOpen) return null;

  const handleKakaoShare = () => {
    shareKakao(shareData);
    onClose();
  };

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(shareData.imageUrl);
    if (success) {
      alert('이미지 URL이 클립보드에 복사되었습니다.');
      onClose();
    } else {
      alert('URL 복사에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">공유하기</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 공유 옵션 */}
        <div className="p-6 space-y-3">
          {/* 카카오톡 공유 */}
          <button
            onClick={handleKakaoShare}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-[#FEE500] transition-all group"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[#FEE500] rounded-lg">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3C6.477 3 2 6.477 2 10.853c0 2.657 1.837 4.987 4.57 6.319-.196.71-.71 2.524-.817 2.927-.132.502.187.493.395.358.166-.107 2.627-1.798 3.05-2.085.54.075 1.093.113 1.652.113 5.523 0 10-3.477 10-7.632C22 6.477 17.523 3 12 3z"
                  fill="#3C1E1E"
                />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">카카오톡 공유</p>
              <p className="text-sm text-gray-500">카카오톡으로 공유하기</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* URL 복사 */}
          <button
            onClick={handleCopyUrl}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-[#0046FF] transition-all group"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[#0046FF] rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">URL 복사</p>
              <p className="text-sm text-gray-500">이미지 링크 복사하기</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 취소 버튼 */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </>
  );
}
