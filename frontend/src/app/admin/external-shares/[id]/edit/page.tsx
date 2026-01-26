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
  displayOrder: number;
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
  const [newShareId, setNewShareId] = useState('');
  const [shareIdError, setShareIdError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters: Array<'1Q' | '2Q' | '3Q' | '4Q'> = ['1Q', '2Q', '3Q', '4Q'];

  // shareId 검증 함수 (영문+숫자만)
  const validateShareId = (value: string): string => {
    if (value.length === 0) return ''; // 빈 값은 허용 (변경하지 않음)
    if (value.length < 4) {
      return '최소 4자 이상 입력하세요';
    }
    if (value.length > 20) {
      return '최대 20자까지 입력 가능합니다';
    }
    if (!/^[A-Za-z0-9]*$/.test(value)) {
      return '영문과 숫자만 입력 가능합니다';
    }
    return '';
  };

  // 비밀번호 검증 함수 (4자리 숫자)
  const validatePassword = (password: string, confirm: string): string => {
    if (password.length === 0) return ''; // 빈 값은 허용 (변경하지 않음)
    if (!/^\d{4}$/.test(password)) {
      return '비밀번호는 4자리 숫자만 가능합니다';
    }
    if (password !== confirm) {
      return '비밀번호가 일치하지 않습니다';
    }
    return '';
  };

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
            displayOrder: project.displayOrder,
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
    // 기본 분기(holding, currentYear, 1Q)의 최대 displayOrder 찾기
    const sameQuarterMax = selectedProjects
      .filter(p => p.category === 'holding' && p.year === currentYear && p.quarter === '1Q')
      .reduce((max, p) => Math.max(max, p.displayOrder), -1);

    setSelectedProjects([
      ...selectedProjects,
      {
        projectId: project.id,
        projectTitle: project.title,
        category: 'holding',
        year: currentYear,
        quarter: '1Q',
        displayOrder: sameQuarterMax + 1,
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
    const current = updated[index];

    // 분기 관련 필드 변경 시 displayOrder 재계산
    if (field === 'category' || field === 'year' || field === 'quarter') {
      const newCategory = field === 'category' ? value : current.category;
      const newYear = field === 'year' ? value : current.year;
      const newQuarter = field === 'quarter' ? value : current.quarter;

      // 새로운 분기의 최대 displayOrder
      const newQuarterMax = selectedProjects
        .filter(p =>
          p.projectId !== current.projectId &&
          p.category === newCategory &&
          p.year === newYear &&
          p.quarter === newQuarter
        )
        .reduce((max, p) => Math.max(max, p.displayOrder), -1);

      updated[index] = {
        ...current,
        [field]: value,
        displayOrder: newQuarterMax + 1
      };
    } else {
      updated[index] = { ...current, [field]: value };
    }

    setSelectedProjects(updated);
  };

  // 위로 이동
  const handleMoveUp = (index: number) => {
    const current = selectedProjects[index];
    const sameQuarter = selectedProjects.filter(
      p => p.category === current.category &&
           p.year === current.year &&
           p.quarter === current.quarter
    );

    // 같은 분기에서 현재보다 작은 displayOrder 중 가장 큰 값 찾기
    const prevProject = sameQuarter
      .filter(p => p.displayOrder < current.displayOrder)
      .sort((a, b) => b.displayOrder - a.displayOrder)[0];

    if (prevProject) {
      // 순서 교환
      const updated = selectedProjects.map(p => {
        if (p.projectId === current.projectId) {
          return { ...p, displayOrder: prevProject.displayOrder };
        }
        if (p.projectId === prevProject.projectId) {
          return { ...p, displayOrder: current.displayOrder };
        }
        return p;
      });
      setSelectedProjects(updated);
    }
  };

  // 아래로 이동
  const handleMoveDown = (index: number) => {
    const current = selectedProjects[index];
    const sameQuarter = selectedProjects.filter(
      p => p.category === current.category &&
           p.year === current.year &&
           p.quarter === current.quarter
    );

    // 같은 분기에서 현재보다 큰 displayOrder 중 가장 작은 값 찾기
    const nextProject = sameQuarter
      .filter(p => p.displayOrder > current.displayOrder)
      .sort((a, b) => a.displayOrder - b.displayOrder)[0];

    if (nextProject) {
      // 순서 교환
      const updated = selectedProjects.map(p => {
        if (p.projectId === current.projectId) {
          return { ...p, displayOrder: nextProject.displayOrder };
        }
        if (p.projectId === nextProject.projectId) {
          return { ...p, displayOrder: current.displayOrder };
        }
        return p;
      });
      setSelectedProjects(updated);
    }
  };

  // 수정
  const handleUpdate = async () => {
    // 검증
    if (selectedProjects.length === 0) {
      alert('최소 1개 이상의 프로젝트를 선택해주세요');
      return;
    }

    // shareId 검증
    if (newShareId && shareIdError) {
      alert(shareIdError);
      return;
    }

    // 비밀번호 검증
    if (newPassword) {
      const pwError = validatePassword(newPassword, confirmPassword);
      if (pwError) {
        alert(pwError);
        return;
      }
    }

    setLoading(true);

    try {
      const data: any = {
        projectSelections: selectedProjects.map((s) => ({
          projectId: s.projectId,
          category: s.category,
          year: s.year,
          quarter: s.quarter,
          displayOrder: s.displayOrder,
        })),
      };

      if (expiresAt) {
        data.expiresAt = new Date(expiresAt).toISOString();
      } else {
        data.expiresAt = null;
      }

      // shareId가 입력되었고 기존과 다른 경우에만 전송
      if (newShareId && newShareId !== shareData?.shareId) {
        data.shareId = newShareId;
      }

      // 비밀번호가 입력된 경우에만 전송
      if (newPassword) {
        data.password = newPassword;
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
                <span className="font-medium">조회수:</span> {shareData.viewCount}회
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* URL 변경 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              1. 공유 URL 설정
            </h2>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                공유 링크 URL
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm whitespace-nowrap">/share/</span>
                <input
                  type="text"
                  value={newShareId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewShareId(value);
                    setShareIdError(validateShareId(value));
                  }}
                  placeholder={shareData?.shareId || ''}
                  className={`flex-1 px-4 py-2 border rounded-lg text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] ${
                    shareIdError ? 'border-red-500' : 'border-[#E0E0E0]'
                  }`}
                />
              </div>
              {shareIdError && (
                <p className="text-red-500 text-sm mt-1">{shareIdError}</p>
              )}
              <p className="text-amber-600 text-sm mt-2">
                ⚠️ URL 변경 시 기존 공유 링크가 작동하지 않습니다
              </p>
              <p className="text-gray-400 text-sm mt-1">
                변경하지 않으려면 비워두세요 (현재: {shareData?.shareId})
              </p>
              <p className="text-gray-400 text-sm">
                영문, 숫자만 사용 가능 (4-20자)
              </p>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              2. 비밀번호 변경 (선택)
            </h2>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewPassword(value);
                    setPasswordError(validatePassword(value, confirmPassword));
                  }}
                  placeholder="4자리 숫자"
                  maxLength={4}
                  className={`w-full px-4 py-2 border rounded-lg text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] ${
                    passwordError ? 'border-red-500' : 'border-[#E0E0E0]'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPassword(value);
                    setPasswordError(validatePassword(newPassword, value));
                  }}
                  placeholder="비밀번호 재입력"
                  maxLength={4}
                  className={`w-full px-4 py-2 border rounded-lg text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] ${
                    passwordError ? 'border-red-500' : 'border-[#E0E0E0]'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-red-500 text-sm">{passwordError}</p>
              )}
              <p className="text-amber-600 text-sm">
                ⚠️ 비밀번호 변경 시 기존 비밀번호는 더 이상 사용할 수 없습니다
              </p>
              <p className="text-gray-400 text-sm">
                변경하지 않으려면 비워두세요
              </p>
            </div>
          </div>

          {/* 프로젝트 선택 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
              3. 프로젝트 선택 ({selectedProjects.length}개)
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
                  {selectedProjects.map((selection, index) => {
                    // 같은 분기 프로젝트 필터링
                    const sameQuarterProjects = selectedProjects.filter(
                      p => p.category === selection.category &&
                           p.year === selection.year &&
                           p.quarter === selection.quarter
                    );
                    const sortedSameQuarter = [...sameQuarterProjects].sort((a, b) => a.displayOrder - b.displayOrder);
                    const positionInQuarter = sortedSameQuarter.findIndex(p => p.projectId === selection.projectId);

                    return (
                    <div
                      key={index}
                      className="border border-[#E0E0E0] rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        {/* 순서 번호 배지 + 제목 */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#0046FF] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {positionInQuarter + 1}
                          </div>
                          <h3 className="font-medium text-[#333333]">
                            {selection.projectTitle}
                          </h3>
                        </div>

                        {/* 순서 변경 버튼 + 제거 버튼 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={positionInQuarter === 0}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#0046FF] hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                            title="위로 이동"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={positionInQuarter === sameQuarterProjects.length - 1}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#0046FF] hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                            title="아래로 이동"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => handleRemoveProject(index)}
                            className="text-red-600 hover:text-red-700 text-sm ml-2"
                          >
                            제거
                          </button>
                        </div>
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
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
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
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
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
                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF] appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
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
                    );
                  })}
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
              4. 만료일 설정 (선택)
            </h2>
            <div className="max-w-xs">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg text-[#333333] bg-white focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
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
