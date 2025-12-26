'use client';

import React, { useState, useEffect } from 'react';
import { externalShareAPI, projectsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface Project {
  id: string;
  title: string;
  description: string;
  categoryNames: string[];
}

interface ProjectSelection {
  projectId: string;
  projectTitle: string;
  category: 'holding' | 'bank';
  year: number;
  quarter: '1Q' | '2Q' | '3Q' | '4Q';
}

interface ShareProject {
  id: string;
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  category: 'holding' | 'bank';
  year: number;
  quarter: '1Q' | '2Q' | '3Q' | '4Q';
  displayOrder: number;
}

interface ShareDetail {
  id: string;
  shareId: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  viewCount: number;
  lastAccessedAt: string | null;
  shareUrl: string;
  projects: ShareProject[];
}

export default function EditExternalSharePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const shareId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<ProjectSelection[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [showProjectList, setShowProjectList] = useState(false);
  const [shareData, setShareData] = useState<ShareDetail | null>(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters: Array<'1Q' | '2Q' | '3Q' | '4Q'> = ['1Q', '2Q', '3Q', '4Q'];

  // 기존 데이터 조회
  const fetchShareData = async () => {
    setLoadingData(true);
    try {
      const response = await externalShareAPI.get(shareId);
      if (response.success && response.data) {
        const data = response.data;
        setShareData(data);

        // 만료일 설정
        if (data.expiresAt) {
          const date = new Date(data.expiresAt);
          const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setExpiresAt(localISOTime);
        }

        // 선택된 프로젝트 설정
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          const selections = data.projects.map((project: ShareProject) => ({
            projectId: project.projectId,
            projectTitle: project.projectTitle,
            category: project.category,
            year: project.year,
            quarter: project.quarter,
          }));
          setSelectedProjects(selections);
        }
      }
    } catch (err: any) {
      alert(err.message || '데이터 조회에 실패했습니다');
      router.push('/admin/external-shares');
    } finally {
      setLoadingData(false);
    }
  };

  // 프로젝트 목록 조회
  const fetchProjects = async () => {
    try {
      const response = await projectsApi.getList({ pageSize: 100 });
      if (response.success) {
        const projectData = Array.isArray(response.data)
          ? response.data
          : response.data?.projects || [];
        setProjects(projectData);
      }
    } catch (err) {
      console.error('프로젝트 목록 조회 실패:', err);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchShareData();
      fetchProjects();
    } else if (user && user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, shareId]);

  // 프로젝트 추가
  const handleAddProject = (project: Project) => {
    setSelectedProjects([
      ...selectedProjects,
      {
        projectId: project.id,
        projectTitle: project.title,
        category: 'holding',
        year: currentYear,
        quarter: '1Q',
      },
    ]);
    setShowProjectList(false);
  };

  // 프로젝트 제거
  const handleRemoveProject = (index: number) => {
    setSelectedProjects(selectedProjects.filter((_, i) => i !== index));
  };

  // 선택 항목 업데이트
  const handleUpdateSelection = (index: number, field: string, value: any) => {
    const updated = [...selectedProjects];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedProjects(updated);
  };

  // 수정
  const handleUpdate = async () => {
    // 검증
    if (selectedProjects.length === 0) {
      alert('최소 1개 이상의 프로젝트를 선택해주세요');
      return;
    }

    setLoading(true);

    try {
      const data: any = {
        projectSelections: selectedProjects.map((s) => ({
          projectId: s.projectId,
          category: s.category,
          year: s.year,
          quarter: s.quarter,
        })),
      };

      if (expiresAt) {
        data.expiresAt = new Date(expiresAt).toISOString();
      } else {
        data.expiresAt = null;
      }

      const response = await externalShareAPI.update(shareId, data);

      if (response.success) {
        alert('수정되었습니다');
        router.push('/admin/external-shares');
      }
    } catch (err: any) {
      alert(err.message || '수정에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
        <Header />
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#0046FF] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/external-shares')}
            className="mb-4 text-[#0046FF] hover:underline flex items-center gap-1"
          >
            ← 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-shinhan-darkGray mb-2">외부공유 수정</h1>
          <p className="text-gray-600">
            프로젝트 선택 및 분기를 수정하세요
          </p>
          {shareData && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-medium">공유 ID:</span> {shareData.shareId}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium">조회수:</span> {shareData.viewCount}회
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium">비밀번호:</span> 비밀번호는 보안상 수정할 수 없습니다
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* 프로젝트 선택 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              1. 프로젝트 선택 ({selectedProjects.length}개)
            </h2>

            {selectedProjects.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">선택된 프로젝트가 없습니다</p>
                <button
                  onClick={() => setShowProjectList(true)}
                  className="px-6 py-2 bg-[#0046FF] text-white rounded-lg font-medium hover:bg-[#003ACC] transition-colors"
                >
                  프로젝트 추가
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-4">
                  {selectedProjects.map((selection, index) => (
                    <div
                      key={index}
                      className="border border-[#E0E0E0] rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-[#333333]">
                          {selection.projectTitle}
                        </h3>
                        <button
                          onClick={() => handleRemoveProject(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          제거
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* 카테고리 */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            카테고리
                          </label>
                          <select
                            value={selection.category}
                            onChange={(e) =>
                              handleUpdateSelection(
                                index,
                                'category',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                          >
                            <option value="holding">신한금융지주</option>
                            <option value="bank">신한은행</option>
                          </select>
                        </div>

                        {/* 연도 */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            연도
                          </label>
                          <select
                            value={selection.year}
                            onChange={(e) =>
                              handleUpdateSelection(
                                index,
                                'year',
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                          >
                            {years.map((year) => (
                              <option key={year} value={year}>
                                {year}년
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 분기 */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            분기
                          </label>
                          <select
                            value={selection.quarter}
                            onChange={(e) =>
                              handleUpdateSelection(index, 'quarter', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                          >
                            {quarters.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowProjectList(true)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  + 프로젝트 추가
                </button>
              </>
            )}
          </div>

          {/* 만료일 설정 (선택) */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              2. 만료일 설정 (선택)
            </h2>
            <div className="max-w-xs">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
              />
              <p className="mt-2 text-sm text-gray-500">
                설정하지 않으면 무제한으로 공유됩니다
              </p>
            </div>
          </div>

          {/* 수정 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpdate}
              disabled={loading || selectedProjects.length === 0}
              className="px-8 py-3 bg-[#0046FF] text-white rounded-lg font-bold hover:bg-[#003ACC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '수정 중...' : '수정 완료'}
            </button>
            <button
              onClick={() => router.push('/admin/external-shares')}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </div>

        {/* 프로젝트 선택 모달 */}
        {showProjectList && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#E0E0E0]">
                <h2 className="text-xl font-bold text-[#333333]">프로젝트 선택</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {projects.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    프로젝트가 없습니다
                  </p>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => {
                      const isSelected = selectedProjects.some(
                        (s) => s.projectId === project.id
                      );

                      return (
                        <div
                          key={project.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-[#0046FF] bg-blue-50'
                              : 'border-[#E0E0E0] hover:border-gray-400'
                          }`}
                          onClick={() => !isSelected && handleAddProject(project)}
                        >
                          <h3 className="font-medium text-[#333333] mb-1">
                            {project.title}
                          </h3>
                          {project.description && (
                            <p className="text-sm text-gray-500 mb-2">
                              {project.description}
                            </p>
                          )}
                          {project.categoryNames && project.categoryNames.length > 0 && (
                            <div className="flex gap-2">
                              {project.categoryNames.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                          {isSelected && (
                            <div className="mt-2">
                              <span className="text-xs text-[#0046FF] font-medium">
                                ✓ 선택됨
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-[#E0E0E0]">
                <button
                  onClick={() => setShowProjectList(false)}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
