'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getContents } from '@/lib/api';
import { tagsApi, categoriesApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import ContentCard from '@/components/Content/ContentCard';
import ContentList from '@/components/Content/ContentList';

type ViewMode = 'gallery' | 'list';

export default function ContentsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fileType, setFileType] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [popularTags, setPopularTags] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    loadCategories();
    loadPopularTags();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadContents();
    }
  }, [page, search, categoryId, fileType, isAuthenticated]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getCategories();
      setCategories(response.data || []);
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

  const loadContents = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      if (fileType) params.fileType = fileType;

      const response = await getContents(params);
      setContents(response.data?.items || []);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error('콘텐츠 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadContents();
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

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-8">
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
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
              >
                <option value="">전체 카테고리</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

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

        {/* 뷰 모드 전환 */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-shinhan-darkGray">
            총 <span className="font-bold text-shinhan-blue">{contents.length}</span>개의 콘텐츠
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
        {loading ? (
          <div className="text-center py-12">
            <p className="text-shinhan-darkGray">로딩 중...</p>
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-shinhan-darkGray">검색 결과가 없습니다.</p>
          </div>
        ) : viewMode === 'gallery' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {contents.map((content) => (
              <ContentCard key={content.id} {...content} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {contents.map((content) => (
              <ContentList key={content.id} {...content} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <span className="px-4 py-2 text-shinhan-darkGray">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
