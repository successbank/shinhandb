'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getContents, contentApi, getContentById } from '@/lib/api';
import { tagsApi, categoriesApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import ContentCard from '@/components/Content/ContentCard';
import ContentList from '@/components/Content/ContentList';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';
import ContentDetailModal from '@/components/Content/ContentDetailModal';

type ViewMode = 'gallery' | 'list';

export default function ContentsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fileType, setFileType] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [popularTags, setPopularTags] = useState<any[]>([]);
  const [totalContentCount, setTotalContentCount] = useState<number>(0);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // 무한 스크롤을 위한 ref
  const observerTarget = useRef<HTMLDivElement>(null);

  // 관리 기능 상태
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [showManageMenu, setShowManageMenu] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');

  // 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [currentContentIndex, setCurrentContentIndex] = useState<number>(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
      loadPopularTags();
      loadRecentlyViewed();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      // 검색 조건 변경 시 페이지 리셋
      setPage(1);
      setContents([]);
      setHasMore(true);
      loadContents(true);
    }
  }, [search, categoryId, fileType, isAuthenticated]);

  // 무한 스크롤 Intersection Observer
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading]);

  useEffect(() => {
    if (page > 1 && isAuthenticated) {
      loadContents(false);
    }
  }, [page]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getCategories();
      setCategories(response.data || []);
      // meta에서 전체 콘텐츠 수 가져오기
      if (response.meta && response.meta.totalContentCount !== undefined) {
        setTotalContentCount(response.meta.totalContentCount);
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const loadPopularTags = async () => {
    try {
      const response = await tagsApi.getPopularTags(10);
      setPopularTags(response.data || []);
    } catch (error) {
      console.error('인기 태그 로드 실패:', error);
    }
  };

  const loadContents = async (reset: boolean = false) => {
    setLoading(true);
    try {
      const params: any = { page: reset ? 1 : page, pageSize: 20 };
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      if (fileType) params.fileType = fileType;

      const response = await getContents(params);
      const newContents = response.data?.items || [];

      if (reset) {
        setContents(newContents);
      } else {
        setContents((prev) => [...prev, ...newContents]);
      }

      setTotalPages(response.data?.totalPages || 1);
      setHasMore(newContents.length === 20); // 20개 미만이면 더 이상 없음
    } catch (error) {
      console.error('콘텐츠 로드 실패:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentlyViewed = async () => {
    try {
      const recentIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      if (recentIds.length === 0) {
        setRecentlyViewed([]);
        return;
      }

      // 최대 10개만 로드
      const idsToLoad = recentIds.slice(0, 10);
      const recentContents = await Promise.all(
        idsToLoad.map(async (id: string) => {
          try {
            const response = await getContentById(id);
            return response.data;
          } catch (err) {
            return null;
          }
        })
      );

      setRecentlyViewed(recentContents.filter((c) => c !== null));
    } catch (err) {
      console.error('최근 본 콘텐츠 로드 실패:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setContents([]);
    setHasMore(true);
    loadContents(true);
  };

  // 관리 기능 함수들
  const handleDelete = async (content: any) => {
    // 다중 카테고리 확인
    const categoryCount = content.categoryIds?.length || 0;

    let confirmMessage = `"${content.title}" 콘텐츠를 삭제하시겠습니까?`;
    if (categoryId && categoryCount > 1) {
      confirmMessage = `이 콘텐츠는 ${categoryCount}개 카테고리에 속해있습니다.\n현재 카테고리에서만 제거하시겠습니까?\n\n(다른 카테고리에는 계속 표시됩니다)`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // 카테고리가 선택된 상태에서 삭제 시 categoryId 전달
      await contentApi.deleteContent(content.id, categoryId || undefined);

      // 성공 메시지
      const message = categoryId && categoryCount > 1
        ? `카테고리에서 제거되었습니다 (${categoryCount - 1}개 카테고리에 남아있음)`
        : '콘텐츠가 삭제되었습니다';

      alert(message);
      setPage(1);
      setContents([]);
      setHasMore(true);
      loadContents(true); // 목록 새로고침
      loadCategories(); // 카테고리 카운트 업데이트
      setShowManageMenu(null);
    } catch (error: any) {
      alert(error.message || '삭제에 실패했습니다');
    }
  };

  const handleCreateShareLink = async (content: any) => {
    try {
      const response = await contentApi.shareContent(content.id, 7 * 24 * 60 * 60); // 7일
      const fullUrl = `${window.location.origin}/shared/${response.data.token}`;
      setShareLink(fullUrl);
      setSelectedContent(content);
      setShowShareModal(true);
      setShowManageMenu(null);
    } catch (error: any) {
      alert(error.message || '공유 링크 생성에 실패했습니다');
    }
  };

  const handleExtendEdit = async (content: any) => {
    const hours = prompt('수정 권한을 몇 시간 연장하시겠습니까?', '24');
    if (!hours) return;

    try {
      await contentApi.extendEdit(content.id, parseInt(hours));
      alert(`수정 권한이 ${hours}시간 연장되었습니다`);
      loadContents();
      setShowManageMenu(null);
    } catch (error: any) {
      alert(error.message || '수정 권한 연장에 실패했습니다');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('링크가 클립보드에 복사되었습니다');
  };

  const handleContentClick = (contentId: string, index?: number) => {
    setSelectedContentId(contentId);
    setShowDetailModal(true);
    if (typeof index === 'number') {
      setCurrentContentIndex(index);
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedContentId(null);
  };

  const handleTagClickFromModal = (tag: string) => {
    setSearch(tag);
    setPage(1);
    setContents([]);
    setHasMore(true);
    setShowDetailModal(false);
    // 검색 실행
    setTimeout(() => {
      loadContents(true);
    }, 100);
  };

  const handleNavigateContent = (direction: 'prev' | 'next') => {
    let newIndex = currentContentIndex;

    if (direction === 'prev') {
      newIndex = currentContentIndex > 0 ? currentContentIndex - 1 : contents.length - 1;
    } else {
      newIndex = currentContentIndex < contents.length - 1 ? currentContentIndex + 1 : 0;
    }

    setCurrentContentIndex(newIndex);
    setSelectedContentId(contents[newIndex].id);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      {/* 1920px 컨테이너 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1920px] mx-auto flex">
          {/* 왼쪽 사이드바 - 카테고리 트리 */}
          <CategoryTreeSidebar
            categories={categories}
            selectedCategoryId={categoryId}
            onCategorySingleSelect={(id) => {
              setCategoryId(id);
              setPage(1);
            }}
            userRole={user?.role === 'ADMIN' ? undefined : user?.role}
            totalContentCount={totalContentCount}
          />

          {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-8">
            {/* 검색 및 필터 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="검색어를 입력하세요 (제목, 설명, OCR 텍스트)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    검색
                  </button>
                </div>

                <div className="flex gap-4">
                  <select
                    value={fileType}
                    onChange={(e) => {
                      setFileType(e.target.value);
                      setPage(1);
                    }}
                    className="px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  >
                    <option value="">전체 파일 형식</option>
                    <option value="IMAGE">이미지</option>
                    <option value="VIDEO">동영상</option>
                    <option value="DOCUMENT">문서</option>
                    <option value="DESIGN">디자인 파일</option>
                    <option value="ARCHIVE">압축 파일</option>
                  </select>
                </div>
              </form>

              {/* 인기 태그 */}
              {popularTags.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-shinhan-darkGray mb-2">인기 태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setSearch(tag.name);
                          setPage(1);
                          loadContents();
                        }}
                        className="px-3 py-1 bg-blue-50 text-shinhan-blue rounded-full text-sm hover:bg-blue-100 transition-colors"
                      >
                        #{tag.name} ({tag.usage_count})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 최근 본 콘텐츠 */}
            {recentlyViewed.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-shinhan-darkGray flex items-center gap-2">
                    🕐 최근 본 콘텐츠 ({recentlyViewed.length}개)
                  </h3>
                  <button
                    onClick={() => setShowRecent(!showRecent)}
                    className="text-sm text-shinhan-blue hover:underline"
                  >
                    {showRecent ? '숨기기' : '보기'}
                  </button>
                </div>
                {showRecent && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {recentlyViewed.map((content, index) => (
                      <div
                        key={content.id}
                        onClick={() => handleContentClick(content.id, index)}
                        className="cursor-pointer group"
                      >
                        <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mb-2">
                          {content.thumbnailUrl ? (
                            <img
                              src={content.thumbnailUrl}
                              alt={content.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-4xl">🖼️</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 font-medium truncate">{content.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 뷰 모드 전환 */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-shinhan-darkGray">
                {loading && page === 1 ? (
                  '로딩 중...'
                ) : (
                  <>
                    총 <span className="font-bold text-shinhan-blue">{contents.length}</span>개의 콘텐츠
                    {hasMore && ' (더 보기 가능)'}
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('gallery')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'gallery'
                      ? 'bg-shinhan-blue text-white'
                      : 'bg-white text-shinhan-darkGray hover:bg-gray-100'
                  }`}
                >
                  갤러리
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-shinhan-blue text-white'
                      : 'bg-white text-shinhan-darkGray hover:bg-gray-100'
                  }`}
                >
                  리스트
                </button>
              </div>
            </div>

            {/* 콘텐츠 목록 */}
            {loading && page === 1 ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-shinhan-blue mb-4"></div>
                <p className="text-shinhan-darkGray">로딩 중...</p>
              </div>
            ) : contents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-shinhan-darkGray">검색 결과가 없습니다.</p>
              </div>
            ) : viewMode === 'gallery' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {contents.map((content, index) => (
                  <div key={content.id} className="relative">
                    <ContentCard
                      {...content}
                      priority={index === 0}
                      onClick={() => handleContentClick(content.id, index)}
                    />
                    {user?.role === 'ADMIN' && (
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowManageMenu(showManageMenu === content.id ? null : content.id);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {showManageMenu === content.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                            <button
                              onClick={() => handleCreateShareLink(content)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              공유 링크 생성
                            </button>
                            <button
                              onClick={() => handleExtendEdit(content)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              수정 권한 연장
                            </button>
                            <hr className="my-2" />
                            <button
                              onClick={() => handleDelete(content)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {contents.map((content) => (
                  <div key={content.id} className="relative">
                    <ContentList
                      {...content}
                      onClick={() => handleContentClick(content.id, contents.findIndex(c => c.id === content.id))}
                    />
                    {user?.role === 'ADMIN' && (
                      <div className="absolute top-4 right-4 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowManageMenu(showManageMenu === content.id ? null : content.id);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {showManageMenu === content.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                            <button
                              onClick={() => handleCreateShareLink(content)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              공유 링크 생성
                            </button>
                            <button
                              onClick={() => handleExtendEdit(content)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              수정 권한 연장
                            </button>
                            <hr className="my-2" />
                            <button
                              onClick={() => handleDelete(content)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 무한 스크롤 로딩 인디케이터 */}
            {hasMore && contents.length > 0 && (
              <div ref={observerTarget} className="flex justify-center py-8">
                {loading ? (
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-shinhan-blue"></div>
                ) : (
                  <div className="text-sm text-gray-500">스크롤하여 더 보기</div>
                )}
              </div>
            )}

            {/* 더 이상 콘텐츠가 없을 때 */}
            {!hasMore && contents.length > 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">모든 콘텐츠를 불러왔습니다</p>
              </div>
            )}
          </div>
        </main>
        </div>
      </div>

      {/* 콘텐츠 상세 모달 */}
      {showDetailModal && selectedContentId && (
        <ContentDetailModal
          contentId={selectedContentId}
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          onTagClick={handleTagClickFromModal}
          onNavigate={handleNavigateContent}
          userRole={user?.role}
        />
      )}

      {/* 공유 링크 모달 */}
      {showShareModal && selectedContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-shinhan-darkGray mb-4">
              공유 링크 생성 완료
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              "{selectedContent.title}" 콘텐츠의 공유 링크가 생성되었습니다.
            </p>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-xs text-gray-500 mb-1">공유 링크 (7일간 유효)</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2"
                />
                <button
                  onClick={() => copyToClipboard(shareLink)}
                  className="px-4 py-2 bg-shinhan-blue text-white rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  복사
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowShareModal(false);
                setShareLink('');
                setSelectedContent(null);
              }}
              className="w-full px-6 py-2 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
