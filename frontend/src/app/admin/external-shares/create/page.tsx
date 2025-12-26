'use client';

import React, { useState, useEffect } from 'react';
import { externalShareAPI, projectsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
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

export default function CreateExternalSharePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<ProjectSelection[]>([]);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showProjectList, setShowProjectList] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters: Array<'1Q' | '2Q' | '3Q' | '4Q'> = ['1Q', '2Q', '3Q', '4Q'];

  // 프로젝트 목록 조회
  const fetchProjects = async () => {
    try {
      const response = await projectsApi.getList({ pageSize: 100 });
      if (response.success) {
        // API 응답 구조 확인 후 배열 추출
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
      fetchProjects();
    } else if (user && user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user]);

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

  // 비밀번호 검증
  const validatePassword = (pwd: string): boolean => {
    return /^\d{4}$/.test(pwd);
  };

  // 생성
  const handleCreate = async () => {
    // 검증
    if (selectedProjects.length === 0) {
      alert('최소 1개 이상의 프로젝트를 선택해주세요');
      return;
    }

    if (!password) {
      alert('비밀번호를 입력해주세요');
      return;
    }

    if (!validatePassword(password)) {
      alert('비밀번호는 4자리 숫자여야 합니다');
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
        password,
      };

      if (expiresAt) {
        data.expiresAt = new Date(expiresAt).toISOString();
      }

      const response = await externalShareAPI.create(data);

      if (response.success) {
        const shareUrl = `${window.location.origin}/share/${response.data.shareId}`;
        alert(`공유가 생성되었습니다!\n\nURL: ${shareUrl}\n비밀번호: ${password}`);
        router.push('/admin/external-shares');
      }
    } catch (err: any) {
      alert(err.message || '생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'ADMIN') {
    return null;
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
          <h1 className="text-3xl font-bold text-shinhan-darkGray">외부공유 생성</h1>
          <p className="text-gray-600">
            프로젝트를 선택하고 분기를 지정한 후 비밀번호를 설정하세요
          </p>
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

          {/* 비밀번호 설정 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              2. 비밀번호 설정 (필수)
            </h2>
            <div className="max-w-xs">
              <input
                type="text"
                value={password}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPassword(value);
                }}
                placeholder="4자리 숫자"
                maxLength={4}
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
              />
              <p className="mt-2 text-sm text-gray-500">
                외부 사용자가 입력할 4자리 숫자 비밀번호
              </p>
            </div>
          </div>

          {/* 만료일 설정 (선택) */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              3. 만료일 설정 (선택)
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

          {/* 생성 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={loading || selectedProjects.length === 0 || !password}
              className="px-8 py-3 bg-[#0046FF] text-white rounded-lg font-bold hover:bg-[#003ACC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '생성 중...' : '공유 생성'}
            </button>
            <button
              onClick={() => router.push('/admin/external-shares')}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </main>

      <Footer />

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
    </div>
  );
}
