'use client';

import { useState, useEffect } from 'react';
import { contentApi, getContentById, categoriesApi } from '@/lib/api';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';

interface MoveCategoryModalProps {
  contentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveCategoryModal({
  contentId,
  isOpen,
  onClose,
  onSuccess,
}: MoveCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && contentId) {
      loadData();
    }
  }, [isOpen, contentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 콘텐츠 정보 및 카테고리 목록 병렬 로드
      const [contentResponse, categoriesResponse] = await Promise.all([
        getContentById(contentId),
        categoriesApi.getCategories(),
      ]);

      const contentData = contentResponse.data;
      setContent(contentData);

      // 현재 선택된 카테고리 ID 설정
      if (contentData.categoryIds && contentData.categoryIds.length > 0) {
        setSelectedCategoryIds(contentData.categoryIds);
      } else if (contentData.categoryId) {
        // 하위 호환성
        setSelectedCategoryIds([contentData.categoryId]);
      }

      setCategories(categoriesResponse.data || []);
    } catch (error: any) {
      alert(error.message || '데이터를 불러오는데 실패했습니다');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        // 이미 선택된 경우 제거
        return prev.filter((id) => id !== categoryId);
      } else if (prev.length < 3) {
        // 3개 미만인 경우 추가
        return [...prev, categoryId];
      } else {
        alert('카테고리는 최대 3개까지 선택 가능합니다');
        return prev;
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCategoryIds.length === 0) {
      alert('최소 1개의 카테고리를 선택해주세요');
      return;
    }

    try {
      setLoading(true);
      await contentApi.moveCategories(contentId, selectedCategoryIds);

      alert('카테고리가 변경되었습니다');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || '카테고리 변경에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 선택된 카테고리 이름 가져오기
  const getSelectedCategoryNames = () => {
    return categories
      .filter((cat) => selectedCategoryIds.includes(cat.id))
      .map((cat) => cat.name);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-shinhan-darkGray">카테고리 이동</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 콘텐츠 정보 */}
          {content && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-shinhan-darkGray mb-2">콘텐츠 정보</h3>
              <div className="flex items-start gap-4">
                {content.thumbnailUrl && (
                  <img
                    src={content.thumbnailUrl}
                    alt={content.title}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{content.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{content.fileName}</p>
                  {content.description && (
                    <p className="text-sm text-gray-500 mt-2">{content.description}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 현재 카테고리 */}
          <div>
            <h3 className="text-sm font-medium text-shinhan-darkGray mb-2">
              현재 카테고리
            </h3>
            <div className="flex flex-wrap gap-2">
              {content?.categoryNames?.map((name: string, index: number) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-shinhan-blue rounded-full text-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div>
            <h3 className="text-sm font-medium text-shinhan-darkGray mb-2">
              새로운 카테고리 선택 (최대 3개)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              선택된 카테고리: {selectedCategoryIds.length}/3
            </p>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <CategoryTreeSidebar
                categories={categories}
                selectedCategoryIds={selectedCategoryIds}
                onCategorySelect={(categoryIds: string[]) => {
                  setSelectedCategoryIds(categoryIds.slice(0, 3));
                }}
                maxSelection={3}
                totalContentCount={0}
              />
            </div>

            {/* 선택된 카테고리 목록 */}
            {selectedCategoryIds.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-shinhan-darkGray mb-2">
                  선택된 카테고리
                </p>
                <div className="flex flex-wrap gap-2">
                  {getSelectedCategoryNames().map((name, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-shinhan-blue text-white rounded-full text-sm"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => handleCategorySelect(selectedCategoryIds[index])}
                        disabled={loading}
                        className="ml-1 text-white hover:text-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selectedCategoryIds.length === 0}
              className="flex-1 px-6 py-3 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:text-gray-500"
            >
              {loading ? '변경 중...' : '카테고리 변경'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
