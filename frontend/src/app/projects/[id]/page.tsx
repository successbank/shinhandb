'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import { projectsApi } from '@/lib/api';
import { formatFileSize } from '@/lib/fileUtils';

interface FileItem {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  tags?: string[];
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  title: string;
  description?: string;
  uploaderName: string;
  createdAt: string;
  files: {
    proposalDrafts: FileItem[];
    finalManuscripts: FileItem[];
  };
  categories: Array<{ id: string; name: string }>;
  tags: string[];
  fileCount: {
    total: number;
    proposal: number;
    final: number;
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && params.id) {
      loadProject();
    }
  }, [isAuthenticated, params.id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await projectsApi.getDetail(params.id as string);

      if (response.success && response.data) {
        setProject(response.data);
      }
    } catch (error: any) {
      setError(error.message || '프로젝트를 불러오는 데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;

    const confirmed = confirm(
      `프로젝트 "${project.title}"를 삭제하시겠습니까?\n연결된 모든 파일도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      await projectsApi.delete(project.id);
      alert('프로젝트가 삭제되었습니다');
      router.push('/projects');
    } catch (error: any) {
      alert(error.message || '프로젝트 삭제 실패');
    }
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/projects')}
            className="px-4 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600"
          >
            프로젝트 목록으로
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-12">
          {/* 프로젝트 헤더 */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-shinhan-darkGray mb-2">
                  {project.title}
                </h1>
                {project.description && (
                  <p className="text-gray-600 mb-4">{project.description}</p>
                )}

                {/* 메타 정보 */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>업로더: {project.uploaderName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>전체 {project.fileCount.total}개 파일</span>
                  </div>
                </div>

                {/* 카테고리 */}
                {project.categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="px-3 py-1 bg-blue-100 text-[#0046FF] text-sm rounded-full"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/projects')}
                  className="px-4 py-2 border border-[#E0E0E0] text-[#333333] rounded-lg hover:bg-gray-50"
                >
                  목록
                </button>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>

            {/* 태그 클라우드 */}
            {project.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">프로젝트 태그</h3>
                  <button
                    onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                    className="flex items-center gap-1 px-3 py-1 text-xs text-[#0046FF] hover:bg-blue-50 rounded transition-colors"
                  >
                    {isTagsExpanded ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        접기
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        태그 펼쳐보기
                      </>
                    )}
                  </button>
                </div>
                <div className={`flex flex-wrap gap-2 overflow-hidden transition-all duration-300 ${
                  isTagsExpanded ? 'max-h-[1000px]' : 'max-h-[60px]'
                }`}>
                  {project.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {!isTagsExpanded && project.tags.length > 10 && (
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {project.tags.length}개의 태그가 있습니다
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 최종 원고 섹션 */}
          {project.fileCount.final > 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-shinhan-darkGray">
                  최종 원고 ({project.fileCount.final}개)
                </h2>
              </div>

              <div className="space-y-6">
                {project.files.finalManuscripts.map((file) => (
                  <div
                    key={file.id}
                    className="border border-[#E0E0E0] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* 이미지와 플래그 */}
                    <div className="relative">
                      {/* 플래그 */}
                      <div className="absolute top-4 left-4 z-10">
                        <span className="px-3 py-1 bg-[#0046FF] text-white text-sm font-medium rounded shadow-md">
                          최종 원고
                        </span>
                      </div>

                      {/* 큰 이미지 */}
                      {file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt="최종 원고"
                          className="w-full h-auto object-contain bg-gray-50"
                        />
                      ) : (
                        <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
                          <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* 버튼 영역 */}
                    <div className="p-4 bg-white flex justify-end gap-2">
                      <a
                        href={file.fileUrl}
                        download
                        className="inline-flex items-center px-6 py-2 bg-[#0046FF] text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </a>
                      <button
                        className="inline-flex items-center px-6 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        공유
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 제안 시안 섹션 */}
          {project.fileCount.proposal > 0 && (
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-shinhan-darkGray">
                  제안 시안 ({project.fileCount.proposal}개)
                </h2>
              </div>

              <div className="space-y-6">
                {project.files.proposalDrafts.map((file) => (
                  <div
                    key={file.id}
                    className="border border-[#E0E0E0] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* 이미지와 플래그 */}
                    <div className="relative">
                      {/* 플래그 */}
                      <div className="absolute top-4 left-4 z-10">
                        <span className="px-3 py-1 bg-gray-600 text-white text-sm font-medium rounded shadow-md">
                          제안 시안
                        </span>
                      </div>

                      {/* 큰 이미지 */}
                      {file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt="제안 시안"
                          className="w-full h-auto object-contain bg-gray-50"
                        />
                      ) : (
                        <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
                          <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* 버튼 영역 */}
                    <div className="p-4 bg-white flex justify-end gap-2">
                      <a
                        href={file.fileUrl}
                        download
                        className="inline-flex items-center px-6 py-2 bg-[#0046FF] text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </a>
                      <button
                        className="inline-flex items-center px-6 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        공유
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 파일이 없는 경우 */}
          {project.fileCount.total === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">아직 업로드된 파일이 없습니다.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
