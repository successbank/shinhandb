'use client';

import { useState } from 'react';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  user_role: string;
  order: number;
  content_count?: number;
  project_count?: number;
  children?: Category[];
}

interface CategoryTreeSidebarProps {
  categories: Category[];
  selectedCategoryIds?: string[];
  onCategorySelect?: (categoryIds: string[]) => void;
  // 하위 호환성을 위한 단일 선택 prop
  selectedCategoryId?: string;
  onCategorySingleSelect?: (categoryId: string) => void;
  userRole?: string;
  maxSelection?: number; // 최대 선택 개수 (기본값: 무제한, 업로드 페이지에서는 3)
  totalContentCount?: number; // 전체 콘텐츠 수 (중복 제거된 값)
  totalProjectCount?: number; // 전체 프로젝트 수 (중복 제거된 값)
  showProjectCount?: boolean; // 프로젝트 수 표시 여부 (기본값: false, 프로젝트 페이지에서는 true)
  selectedGroup?: string; // 선택된 그룹 ('HOLDING' | 'BANK' | '')
  onGroupSelect?: (group: string) => void; // 그룹 선택 콜백
  holdingProjectCount?: number; // 그룹별 유니크 프로젝트 수 (중복 제거)
  bankProjectCount?: number; // 그룹별 유니크 프로젝트 수 (중복 제거)
}

export default function CategoryTreeSidebar({
  categories,
  selectedCategoryIds,
  onCategorySelect,
  selectedCategoryId,
  onCategorySingleSelect,
  userRole,
  maxSelection,
  totalContentCount,
  totalProjectCount,
  showProjectCount = false,
  selectedGroup = '',
  onGroupSelect,
  holdingProjectCount,
  bankProjectCount,
}: CategoryTreeSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 다중 선택 모드 여부
  const isMultiSelect = selectedCategoryIds !== undefined && onCategorySelect !== undefined;

  // 현재 선택된 카테고리 목록 (다중 또는 단일)
  const currentSelectedIds = isMultiSelect
    ? selectedCategoryIds
    : (selectedCategoryId ? [selectedCategoryId] : []);

  // 카테고리를 트리 구조로 변환
  const buildCategoryTree = (cats: Category[]): Category[] => {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // 먼저 모든 카테고리를 맵에 저장
    cats.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // 부모-자식 관계 설정
    cats.forEach((cat) => {
      const category = categoryMap.get(cat.id)!;
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children!.push(category);
        } else {
          rootCategories.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 카테고리 선택 핸들러
  const handleCategoryClick = (categoryId: string) => {
    if (isMultiSelect) {
      // 다중 선택 모드
      const isSelected = currentSelectedIds.includes(categoryId);

      if (isSelected) {
        // 선택 해제
        const newSelection = currentSelectedIds.filter((id) => id !== categoryId);
        onCategorySelect!(newSelection);
      } else {
        // 선택 추가 (최대 개수 체크)
        if (maxSelection && currentSelectedIds.length >= maxSelection) {
          alert(`최대 ${maxSelection}개까지 선택 가능합니다.`);
          return;
        }
        const newSelection = [...currentSelectedIds, categoryId];
        onCategorySelect!(newSelection);
      }
    } else {
      // 단일 선택 모드 (하위 호환성)
      if (onCategorySingleSelect) {
        onCategorySingleSelect(categoryId);
      }
    }
  };

  const renderCategoryItem = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = currentSelectedIds.includes(category.id);

    return (
      <div key={category.id}>
        <div
          className={`flex items-center px-3 py-2 cursor-pointer transition-colors rounded-md group ${
            isSelected
              ? 'bg-shinhan-blue text-white'
              : 'hover:bg-gray-100 text-shinhan-darkGray'
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
        >
          {/* 다중 선택 모드: 체크박스 */}
          {isMultiSelect && (
            <div
              className="w-5 h-5 mr-2 flex items-center justify-center flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleCategoryClick(category.id);
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleCategoryClick(category.id)}
                className="w-4 h-4 text-shinhan-blue border-gray-300 rounded focus:ring-2 focus:ring-shinhan-blue cursor-pointer"
              />
            </div>
          )}

          {/* 폴더 아이콘 또는 확장/축소 아이콘 */}
          <div
            className="w-5 h-5 mr-2 flex items-center justify-center flex-shrink-0"
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                toggleCategory(category.id);
              }
            }}
          >
            {hasChildren ? (
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            )}
          </div>

          {/* 카테고리 이름 */}
          <span
            className="text-sm font-medium truncate flex-1"
            onClick={() => {
              if (!isMultiSelect) {
                handleCategoryClick(category.id);
              }
            }}
          >
            {category.name}
          </span>

          {/* 콘텐츠 수 또는 프로젝트 수 */}
          {showProjectCount ? (
            // 프로젝트 페이지: 프로젝트 수 표시
            category.project_count !== undefined && category.project_count > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {category.project_count}
              </span>
            )
          ) : (
            // 콘텐츠 페이지: 콘텐츠 수 표시
            category.content_count !== undefined && category.content_count > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {category.content_count}
              </span>
            )
          )}
        </div>

        {/* 자식 카테고리 렌더링 */}
        {hasChildren && isExpanded && (
          <div>
            {category.children!
              .sort((a, b) => a.order - b.order)
              .map((child) => renderCategoryItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const categoryTree = buildCategoryTree(categories);

  // 전체 콘텐츠 수 또는 프로젝트 수 - prop으로 받은 값 사용 (중복 제거된 값)
  // prop이 없으면 fallback으로 카테고리별 합산 사용
  const displayTotalCount = showProjectCount
    ? (totalProjectCount !== undefined
        ? totalProjectCount
        : categories.reduce((sum, cat) => sum + (cat.project_count || 0), 0))
    : (totalContentCount !== undefined
        ? totalContentCount
        : categories.reduce((sum, cat) => sum + (cat.content_count || 0), 0));

  return (
    <div className="w-64 bg-white border-r border-shinhan-border overflow-y-auto flex-shrink-0">
      <div className="p-4 sticky top-0">
        <h2 className="text-lg font-bold text-shinhan-darkGray mb-4">카테고리</h2>

        {/* 전체 보기 버튼 (단일 선택 모드에서만 표시) */}
        {!isMultiSelect && (
          <div
            className={`flex items-center px-3 py-2 mb-2 cursor-pointer transition-colors rounded-md ${
              currentSelectedIds.length === 0 && !selectedGroup
                ? 'bg-shinhan-blue text-white'
                : 'hover:bg-gray-100 text-shinhan-darkGray'
            }`}
            onClick={() => {
              onCategorySingleSelect!('');
              if (onGroupSelect) onGroupSelect('');
            }}
          >
            <div className="w-5 h-5 mr-2 flex items-center justify-center">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">전체 보기</span>
            {displayTotalCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                currentSelectedIds.length === 0 && !selectedGroup
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {displayTotalCount}
              </span>
            )}
          </div>
        )}

        <div className="border-t border-shinhan-border pt-2 mt-2">
          {/* 사용자 역할별 카테고리 그룹 */}
          {userRole && (
            <>
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 px-3">
                  {userRole === 'HOLDING' ? '신한금융지주' : '신한은행'}
                </div>
                {categoryTree
                  .filter((cat) => cat.user_role === userRole)
                  .sort((a, b) => a.order - b.order)
                  .map((category) => renderCategoryItem(category))}
              </div>
            </>
          )}

          {/* ADMIN은 모든 카테고리 보기 */}
          {!userRole && (
            <>
              <div className="mb-4">
                {/* 신한금융지주 그룹 버튼 */}
                <div
                  className={`flex items-center px-3 py-2 mb-2 cursor-pointer transition-colors rounded-md ${
                    selectedGroup === 'HOLDING'
                      ? 'bg-shinhan-blue text-white'
                      : 'hover:bg-gray-100 text-shinhan-darkGray'
                  }`}
                  onClick={() => {
                    if (onGroupSelect) {
                      onGroupSelect(selectedGroup === 'HOLDING' ? '' : 'HOLDING');
                    }
                  }}
                >
                  <div className="w-5 h-5 mr-2 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium flex-1">신한금융지주 전체보기</span>
                  {(() => {
                    const holdingCount = showProjectCount && holdingProjectCount !== undefined
                      ? holdingProjectCount
                      : categoryTree
                          .filter((cat) => cat.user_role === 'HOLDING')
                          .reduce((sum, cat) => sum + (showProjectCount ? (cat.project_count || 0) : (cat.content_count || 0)), 0);
                    return holdingCount > 0 ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                        selectedGroup === 'HOLDING'
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {holdingCount}
                      </span>
                    ) : null;
                  })()}
                </div>
                {categoryTree
                  .filter((cat) => cat.user_role === 'HOLDING')
                  .sort((a, b) => a.order - b.order)
                  .map((category) => renderCategoryItem(category))}
              </div>
              <div className="mb-4">
                {/* 신한은행 그룹 버튼 */}
                <div
                  className={`flex items-center px-3 py-2 mb-2 cursor-pointer transition-colors rounded-md ${
                    selectedGroup === 'BANK'
                      ? 'bg-shinhan-blue text-white'
                      : 'hover:bg-gray-100 text-shinhan-darkGray'
                  }`}
                  onClick={() => {
                    if (onGroupSelect) {
                      onGroupSelect(selectedGroup === 'BANK' ? '' : 'BANK');
                    }
                  }}
                >
                  <div className="w-5 h-5 mr-2 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium flex-1">신한은행 전체보기</span>
                  {(() => {
                    const bankCount = showProjectCount && bankProjectCount !== undefined
                      ? bankProjectCount
                      : categoryTree
                          .filter((cat) => cat.user_role === 'BANK')
                          .reduce((sum, cat) => sum + (showProjectCount ? (cat.project_count || 0) : (cat.content_count || 0)), 0);
                    return bankCount > 0 ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                        selectedGroup === 'BANK'
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {bankCount}
                      </span>
                    ) : null;
                  })()}
                </div>
                {categoryTree
                  .filter((cat) => cat.user_role === 'BANK')
                  .sort((a, b) => a.order - b.order)
                  .map((category) => renderCategoryItem(category))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
