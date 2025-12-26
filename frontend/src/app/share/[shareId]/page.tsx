'use client';

import React, { useState, useEffect } from 'react';
import { publicShareAPI } from '@/lib/api';
import { useParams } from 'next/navigation';

interface QuarterData {
  projectId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  fileCount: number;
  createdAt: string;
}

interface Timeline {
  holding?: Record<string, Record<string, QuarterData[]>>;
  bank?: Record<string, Record<string, QuarterData[]>>;
}

export default function PublicSharePage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [step, setStep] = useState<'password' | 'timeline'>('password');
  const [password, setPassword] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [selectedProject, setSelectedProject] = useState<QuarterData | null>(null);

  // sessionStorage에서 토큰 복원
  useEffect(() => {
    const savedToken = sessionStorage.getItem(`share_token_${shareId}`);
    if (savedToken) {
      setToken(savedToken);
      setStep('timeline');
      fetchTimeline(savedToken);
    }
  }, [shareId]);

  // 비밀번호 입력 처리
  const handlePasswordChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // 숫자만 허용

    const newPassword = [...password];
    newPassword[index] = value;
    setPassword(newPassword);

    // 자동 포커스 이동
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Backspace 처리
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !password[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  // 비밀번호 검증
  const handleVerify = async () => {
    const pwd = password.join('');
    if (pwd.length !== 4) {
      setError('4자리 비밀번호를 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await publicShareAPI.verify(shareId, pwd);

      if (response.success && response.data.token) {
        setToken(response.data.token);
        sessionStorage.setItem(`share_token_${shareId}`, response.data.token);
        setStep('timeline');
        await fetchTimeline(response.data.token);
      }
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다');
      setPassword(['', '', '', '']);
      document.getElementById('pin-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  // 타임라인 조회
  const fetchTimeline = async (authToken: string) => {
    setLoading(true);

    try {
      const response = await publicShareAPI.getContents(shareId, authToken);

      if (response.success && response.data.timeline) {
        setTimeline(response.data.timeline);
      }
    } catch (err: any) {
      setError(err.message || '데이터 조회에 실패했습니다');
      // 토큰 만료 시 비밀번호 입력으로 돌아가기
      if (err.message.includes('만료') || err.message.includes('토큰')) {
        sessionStorage.removeItem(`share_token_${shareId}`);
        setStep('password');
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // 엔터 키 처리
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && step === 'password' && password.every((p) => p)) {
        handleVerify();
      }
    };

    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [password, step]);

  // 비밀번호 입력 화면
  if (step === 'password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0046FF] to-[#0056DD] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 w-full max-w-md">
          {/* 로고/타이틀 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#333333] mb-2">
              신한금융그룹
            </h1>
            <p className="text-gray-600">광고자료 열람 시스템</p>
          </div>

          {/* 안내 */}
          <p className="text-center text-[#333333] font-medium mb-8">
            비밀번호를 입력해주세요
          </p>

          {/* PIN 입력 */}
          <div className="flex justify-center gap-3 mb-6">
            {password.map((digit, index) => (
              <input
                key={index}
                id={`pin-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePasswordChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-16 h-16 md:w-20 md:h-20 text-center text-3xl font-bold border-2 border-[#E0E0E0] rounded-lg focus:border-[#0046FF] focus:outline-none transition-colors"
                autoFocus={index === 0}
              />
            ))}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          {/* 확인 버튼 */}
          <button
            onClick={handleVerify}
            disabled={loading || password.some((p) => !p)}
            className="w-full py-4 bg-[#0046FF] text-white font-bold rounded-lg hover:bg-[#003ACC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    );
  }

  // 타임라인 화면
  return (
    <div className="min-h-screen bg-[#0046FF] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            신한금융그룹
          </h1>
          <p className="text-blue-100">광고자료 열람 시스템</p>
        </div>

        {loading && (
          <div className="text-center text-white py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
            <p>로딩 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => {
                sessionStorage.removeItem(`share_token_${shareId}`);
                setStep('password');
                setToken(null);
                setError(null);
              }}
              className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-[#003ACC]"
            >
              다시 시도
            </button>
          </div>
        )}

        {timeline && !loading && (
          <div className="space-y-12">
            {/* 신한금융지주 */}
            {timeline.holding && Object.keys(timeline.holding).length > 0 && (
              <div className="relative">
                <div className="flex items-start gap-6">
                  {/* 타임라인 선 */}
                  <div className="hidden md:flex flex-col items-center">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                    <div className="w-0.5 flex-1 bg-white bg-opacity-30 my-2"></div>
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-6 md:mb-0 md:absolute md:left-20 md:top-0">
                      신한금융지주
                    </h2>

                    <div className="space-y-8 md:ml-8">
                      {Object.entries(timeline.holding)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => (
                          <div key={year}>
                            <h3 className="text-xl font-bold text-white mb-4">
                              {year}년
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {Object.entries(quarters).map(([quarter, projects]) =>
                                projects.map((project, idx) => (
                                  <button
                                    key={`${quarter}-${idx}`}
                                    onClick={() => setSelectedProject(project)}
                                    className="bg-white rounded-lg p-4 hover:shadow-lg transition-shadow text-left"
                                  >
                                    <div className="font-bold text-[#0046FF] text-lg mb-2">
                                      {quarter}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-1 truncate">
                                      {project.title}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      파일 {project.fileCount}개
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 신한은행 */}
            {timeline.bank && Object.keys(timeline.bank).length > 0 && (
              <div className="relative">
                <div className="flex items-start gap-6">
                  {/* 타임라인 선 */}
                  <div className="hidden md:flex flex-col items-center">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                    <div className="w-0.5 flex-1 bg-white bg-opacity-30 my-2"></div>
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-6 md:mb-0 md:absolute md:left-20 md:top-0">
                      신한은행
                    </h2>

                    <div className="space-y-8 md:ml-8">
                      {Object.entries(timeline.bank)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => (
                          <div key={year}>
                            <h3 className="text-xl font-bold text-white mb-4">
                              {year}년
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {Object.entries(quarters).map(([quarter, projects]) =>
                                projects.map((project, idx) => (
                                  <button
                                    key={`${quarter}-${idx}`}
                                    onClick={() => setSelectedProject(project)}
                                    className="bg-white rounded-lg p-4 hover:shadow-lg transition-shadow text-left"
                                  >
                                    <div className="font-bold text-[#0046FF] text-lg mb-2">
                                      {quarter}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-1 truncate">
                                      {project.title}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      파일 {project.fileCount}개
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 빈 메시지 */}
            {(!timeline.holding || Object.keys(timeline.holding).length === 0) &&
              (!timeline.bank || Object.keys(timeline.bank).length === 0) && (
                <div className="bg-white rounded-lg p-12 text-center">
                  <p className="text-gray-500">공유된 프로젝트가 없습니다</p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* 프로젝트 상세 모달 */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E0E0E0] sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#333333] mb-2">
                    {selectedProject.title}
                  </h2>
                  {selectedProject.description && (
                    <p className="text-gray-600">{selectedProject.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500">
                  총 {selectedProject.fileCount}개 파일
                </p>
              </div>

              {selectedProject.thumbnailUrl && (
                <img
                  src={selectedProject.thumbnailUrl}
                  alt={selectedProject.title}
                  className="w-full rounded-lg mb-4"
                />
              )}

              <p className="text-sm text-gray-500">
                생성일: {new Date(selectedProject.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>

            <div className="p-6 border-t border-[#E0E0E0]">
              <button
                onClick={() => setSelectedProject(null)}
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
