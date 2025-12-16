'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';
import ProjectDetailModal from '@/components/Project/ProjectDetailModal';
import { projectsApi, categoriesApi } from '@/lib/api';
import { formatFileSize } from '@/lib/fileUtils';

interface ProjectListItem {
  id: string;
  title: string;
  description?: string;
  uploaderName: string;
  createdAt: string;
  categories: Array<{ id: string; name: string }>;
  fileCount: {
    total: number;
    proposal: number;
    final: number;
  };
  thumbnailUrl?: string;
}

interface ProjectListResponse {
  projects: ProjectListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}


export default function ProjectsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [totalProjectCount, setTotalProjectCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
      loadProjects();
    }
  }, [isAuthenticated, selectedCategoryId, searchQuery, page]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getList();
      if (response.success && response.data) {
        setCategories(response.data);
        // meta에서 전체 프로젝트 수 추출
        if (response.meta && response.meta.totalProjectCount !== undefined) {
          setTotalProjectCount(response.meta.totalProjectCount);
        }
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        page,
        pageSize: 12,
      };

      if (selectedCategoryId) {
        params.categoryId = selectedCategoryId;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await projectsApi.getList(params);

      if (response.success && response.data) {
        setProjects(response.data.projects || []);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages || 1);
        }
      }
    } catch (error: any) {
      setError(error.message || '프로젝트 목록을 불러오는 데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProjects();
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
  };

  const handleProjectClick = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProjectId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0046FF] mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          {/* 페이지 헤더 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-shinhan-darkGray">프로젝트 목록</h1>

              {(user?.role === 'ADMIN' || user?.role === 'CLIENT') && (
                <button
                  onClick={() => router.push('/projects/upload')}
                  className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  새 프로젝트
                </button>
              )}
            </div>

            {/* 검색 바 */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="프로젝트 검색..."
                className="flex-1 px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600"
              >
                검색
              </button>
            </form>
          </div>

          <div className="flex gap-6">
            {/* 카테고리 사이드바 */}
            <div className="w-64 flex-shrink-0">
              <CategoryTreeSidebar
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onCategorySingleSelect={handleCategorySelect}
                userRole={user?.role === 'HOLDING' ? 'HOLDING' : user?.role === 'BANK' ? 'BANK' : undefined}
                totalProjectCount={totalProjectCount}
                showProjectCount={true}
              />
            </div>

            {/* 프로젝트 목록 */}
            <div className="flex-1">
              {/* 뷰 컨트롤 */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      전체 {projects.length}개 프로젝트
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* 그리드 열 수 조정 */}
                    {viewMode === 'grid' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGridCols(2)}
                          className={`px-3 py-1 text-sm rounded ${
                            gridCols === 2
                              ? 'bg-[#0046FF] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          2열
                        </button>
                        <button
                          onClick={() => setGridCols(3)}
                          className={`px-3 py-1 text-sm rounded ${
                            gridCols === 3
                              ? 'bg-[#0046FF] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          3열
                        </button>
                        <button
                          onClick={() => setGridCols(4)}
                          className={`px-3 py-1 text-sm rounded ${
                            gridCols === 4
                              ? 'bg-[#0046FF] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          4열
                        </button>
                      </div>
                    )}

                    {/* 뷰 모드 토글 */}
                    <div className="flex border border-[#E0E0E0] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1 ${
                          viewMode === 'grid'
                            ? 'bg-[#0046FF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 ${
                          viewMode === 'list'
                            ? 'bg-[#0046FF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {/* 갤러리 뷰 */}
              {viewMode === 'grid' && (
                <div
                  className={`grid gap-4 ${
                    gridCols === 2
                      ? 'grid-cols-2'
                      : gridCols === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4'
                  }`}
                >
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                    >
                      {/* 썸네일 */}
                      {project.thumbnailUrl ? (
                        <img
                          src={project.thumbnailUrl}
                          alt={project.title}
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                      )}

                      <div className="p-4">
                        {/* 제목 */}
                        <h3 className="text-lg font-semibold text-shinhan-darkGray mb-2 truncate">
                          {project.title}
                        </h3>

                        {/* 설명 */}
                        {project.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {project.description}
                          </p>
                        )}

                        {/* 파일 카운트 */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-1 bg-blue-50 text-[#0046FF] text-xs rounded">
                            시안 {project.fileCount.proposal}
                          </span>
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                            원고 {project.fileCount.final}
                          </span>
                        </div>

                        {/* 카테고리 */}
                        {project.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {project.categories.slice(0, 2).map((cat) => (
                              <span
                                key={cat.id}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                              >
                                {cat.name}
                              </span>
                            ))}
                            {project.categories.length > 2 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                +{project.categories.length - 2}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 메타 정보 */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{project.uploaderName}</span>
                          <span>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 리스트 뷰 */}
              {viewMode === 'list' && (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
                    >
                      <div className="flex items-center gap-4">
                        {/* 썸네일 */}
                        {project.thumbnailUrl ? (
                          <img
                            src={project.thumbnailUrl}
                            alt={project.title}
                            className="w-24 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                        )}

                        {/* 프로젝트 정보 */}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-shinhan-darkGray mb-1">
                            {project.title}
                          </h3>

                          {project.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                              {project.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-blue-50 text-[#0046FF] text-xs rounded">
                                시안 {project.fileCount.proposal}
                              </span>
                              <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                                원고 {project.fileCount.final}
                              </span>
                            </div>

                            {project.categories.length > 0 && (
                              <div className="flex gap-1">
                                {project.categories.slice(0, 3).map((cat) => (
                                  <span
                                    key={cat.id}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                                  >
                                    {cat.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 메타 정보 */}
                        <div className="text-right text-sm text-gray-500">
                          <div>{project.uploaderName}</div>
                          <div>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 빈 상태 */}
              {!loading && projects.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-gray-600 mb-4">
                    {searchQuery || selectedCategoryId
                      ? '검색 결과가 없습니다'
                      : '아직 생성된 프로젝트가 없습니다'}
                  </p>
                  {(user?.role === 'ADMIN' || user?.role === 'CLIENT') && (
                    <button
                      onClick={() => router.push('/projects/upload')}
                      className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600"
                    >
                      첫 프로젝트 만들기
                    </button>
                  )}
                </div>
              )}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-[#E0E0E0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    이전
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-4 py-2 rounded-lg ${
                          page === pageNum
                            ? 'bg-[#0046FF] text-white'
                            : 'border border-[#E0E0E0] hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-[#E0E0E0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* 프로젝트 상세 모달 */}
      {selectedProjectId && (
        <ProjectDetailModal
          projectId={selectedProjectId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdate={loadProjects}
          userRole={user?.role}
        />
      )}
    </div>
  );
}
