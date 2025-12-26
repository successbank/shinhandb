'use client';

import React, { useState, useEffect, useRef } from 'react';
import { publicShareAPI } from '@/lib/api';
import { useParams } from 'next/navigation';
import Script from 'next/script';

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

interface SelectedQuarter {
  year: string;
  quarter: string;
  category: 'holding' | 'bank';
  categoryName: string;
  projects: QuarterData[];
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
  const [selectedQuarter, setSelectedQuarter] = useState<SelectedQuarter | null>(null);
  const [selectedProject, setSelectedProject] = useState<QuarterData | null>(null);
  const [imageGalleryOpen, setImageGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [swiperLoaded, setSwiperLoaded] = useState(false);
  const swiperRef = useRef<any>(null);

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

  // 프로젝트 이미지 가져오기
  const fetchProjectImages = async (projectId: string) => {
    if (!token) return;

    try {
      const response = await publicShareAPI.getProject(shareId, projectId, token);
      if (response.success && response.data.files) {
        const imageUrls = response.data.files.map((file: any) => file.url);
        setProjectImages(imageUrls);
      }
    } catch (err) {
      console.error('이미지 로딩 실패:', err);
      setProjectImages([]);
    }
  };

  // 이미지 갤러리 열기
  const openImageGallery = async (project: QuarterData, initialIndex: number = 0) => {
    setSelectedProject(project);
    setCurrentImageIndex(initialIndex);
    await fetchProjectImages(project.projectId);
    setImageGalleryOpen(true);
  };

  // 이미지 갤러리 닫기
  const closeImageGallery = () => {
    setImageGalleryOpen(false);
    setCurrentImageIndex(0);
    setProjectImages([]);
  };

  // 이전/다음 이미지
  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : projectImages.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev < projectImages.length - 1 ? prev + 1 : 0));
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

  // 이미지 갤러리 키보드 네비게이션
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (!imageGalleryOpen) return;

      if (e.key === 'Escape') {
        closeImageGallery();
      } else if (e.key === 'ArrowLeft') {
        goToPrevImage();
      } else if (e.key === 'ArrowRight') {
        goToNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [imageGalleryOpen, projectImages]);

  // Swiper 초기화
  useEffect(() => {
    if (!selectedQuarter || !swiperLoaded) return;

    const initSwiper = () => {
      if (typeof window !== 'undefined' && (window as any).Swiper && !swiperRef.current) {
        const Swiper = (window as any).Swiper;
        swiperRef.current = new Swiper('.quarter-swiper', {
          effect: 'coverflow',
          grabCursor: true,
          centeredSlides: true,
          slidesPerView: 'auto',
          loop: selectedQuarter.projects.length > 1,
          speed: 800,
          coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 200,
            modifier: 1.5,
            slideShadows: true,
          },
          pagination: {
            el: '.swiper-pagination',
            clickable: true,
            dynamicBullets: true,
          },
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          },
          keyboard: {
            enabled: true,
          },
        });
      }
    };

    const timer = setTimeout(initSwiper, 100);
    return () => {
      clearTimeout(timer);
      if (swiperRef.current) {
        swiperRef.current.destroy();
        swiperRef.current = null;
      }
    };
  }, [selectedQuarter, swiperLoaded]);

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
                              {Object.entries(quarters).map(([quarter, projects]) => (
                                <button
                                  key={quarter}
                                  onClick={() => setSelectedQuarter({
                                    year,
                                    quarter,
                                    category: 'holding',
                                    categoryName: '신한금융지주',
                                    projects
                                  })}
                                  className="bg-white rounded-lg p-4 hover:shadow-lg transition-shadow text-left"
                                >
                                  <div className="font-bold text-[#0046FF] text-lg mb-2">
                                    {quarter}
                                  </div>
                                  <div className="text-sm text-gray-600 mb-1">
                                    프로젝트 {projects.length}개
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    총 {projects.reduce((sum, p) => sum + p.fileCount, 0)}개 파일
                                  </div>
                                </button>
                              ))}
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
                              {Object.entries(quarters).map(([quarter, projects]) => (
                                <button
                                  key={quarter}
                                  onClick={() => setSelectedQuarter({
                                    year,
                                    quarter,
                                    category: 'bank',
                                    categoryName: '신한은행',
                                    projects
                                  })}
                                  className="bg-white rounded-lg p-4 hover:shadow-lg transition-shadow text-left"
                                >
                                  <div className="font-bold text-[#0046FF] text-lg mb-2">
                                    {quarter}
                                  </div>
                                  <div className="text-sm text-gray-600 mb-1">
                                    프로젝트 {projects.length}개
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    총 {projects.reduce((sum, p) => sum + p.fileCount, 0)}개 파일
                                  </div>
                                </button>
                              ))}
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

      {/* Swiper CSS */}
      {selectedQuarter && !imageGalleryOpen && (
        <>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"
            onLoad={() => setSwiperLoaded(true)}
          />
        </>
      )}

      {/* 분기별 프로젝트 Swiper Coverflow 모달 */}
      {selectedQuarter && !imageGalleryOpen && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0046FF] to-[#003399] z-50 flex flex-col items-center justify-center p-4">
          <style jsx>{`
            .quarter-swiper {
              width: 100%;
              max-width: 1200px;
              padding: 50px 0 80px;
            }

            .quarter-swiper .swiper-slide {
              width: 94%;
              max-width: 500px;
              border-radius: 24px;
              overflow: hidden;
              box-shadow: 0 25px 50px rgba(0,0,0,0.3);
              transition: all 0.4s ease;
              background: transparent;
              cursor: pointer;
            }

            .quarter-swiper .swiper-slide img {
              width: 100%;
              height: auto;
              object-fit: contain;
              transition: transform 0.5s ease;
              border-radius: 24px;
            }

            .quarter-swiper .swiper-slide-active {
              box-shadow: 0 35px 70px rgba(0,0,0,0.4);
            }

            .quarter-swiper .swiper-slide-active img {
              transform: scale(1.02);
            }

            .quarter-swiper .swiper-pagination {
              bottom: 20px !important;
            }

            .quarter-swiper .swiper-pagination-bullet {
              width: 10px;
              height: 10px;
              background: rgba(255,255,255,0.5);
              opacity: 1;
              transition: all 0.3s ease;
            }

            .quarter-swiper .swiper-pagination-bullet-active {
              background: white;
              width: 30px;
              border-radius: 5px;
            }

            .quarter-swiper .swiper-button-next,
            .quarter-swiper .swiper-button-prev {
              color: white;
              background: rgba(255,255,255,0.2);
              width: 50px;
              height: 50px;
              border-radius: 50%;
              backdrop-filter: blur(10px);
              transition: all 0.3s ease;
            }

            .quarter-swiper .swiper-button-next:hover,
            .quarter-swiper .swiper-button-prev:hover {
              background: rgba(255,255,255,0.4);
              transform: scale(1.1);
            }

            .quarter-swiper .swiper-button-next::after,
            .quarter-swiper .swiper-button-prev::after {
              font-size: 18px;
              font-weight: bold;
            }

            @media (max-width: 768px) {
              .quarter-swiper .swiper-slide {
                width: 94%;
                max-width: 400px;
              }

              .quarter-swiper .swiper-button-next,
              .quarter-swiper .swiper-button-prev {
                display: none;
              }

              .quarter-swiper {
                padding: 30px 0 60px;
              }
            }

            @media (max-width: 480px) {
              .quarter-swiper .swiper-slide {
                width: 94%;
                max-width: 320px;
              }
            }
          `}</style>

          {/* 헤더 */}
          <div className="text-center mb-8 relative w-full max-w-1200px">
            <button
              onClick={() => setSelectedQuarter(null)}
              className="absolute top-0 left-4 text-white text-lg font-medium hover:text-gray-300 z-10 px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm"
            >
              닫기
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">
              {selectedQuarter.categoryName}
            </h1>
            <p className="text-blue-100 text-lg">
              {selectedQuarter.year}년 {selectedQuarter.quarter} · 프로젝트 {selectedQuarter.projects.length}개
            </p>
          </div>

          {/* Swiper Container */}
          <div className="w-full" style={{ padding: '0 1%' }}>
            <div className="quarter-swiper">
              <div className="swiper-wrapper">
                {selectedQuarter.projects.map((project, idx) => (
                  <div
                    key={project.projectId}
                    className="swiper-slide"
                    onClick={() => openImageGallery(project)}
                  >
                    {project.thumbnailUrl && (
                      <img
                        src={project.thumbnailUrl}
                        alt={project.title}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="swiper-pagination"></div>
              <div className="swiper-button-prev"></div>
              <div className="swiper-button-next"></div>
            </div>
          </div>

          {/* 터치 힌트 (모바일) */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white text-sm flex items-center gap-2 opacity-60 md:hidden">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
            스와이프하여 탐색
          </div>
        </div>
      )}

      {/* 이미지 캐러셀 모달 */}
      {imageGalleryOpen && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
          <button
            onClick={closeImageGallery}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
          >
            ×
          </button>

          {/* 프로젝트 정보 */}
          <div className="absolute top-4 left-4 text-white z-10">
            <h3 className="text-xl font-bold mb-1">{selectedProject.title}</h3>
            <p className="text-sm text-gray-300">
              {currentImageIndex + 1} / {projectImages.length}
            </p>
          </div>

          {/* 이미지 */}
          <div className="relative w-full h-full flex items-center justify-center p-16">
            {projectImages.length > 0 ? (
              <img
                src={projectImages[currentImageIndex]}
                alt={`${selectedProject.title} - ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-white text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                <p>이미지 로딩 중...</p>
              </div>
            )}
          </div>

          {/* 좌우 네비게이션 버튼 */}
          {projectImages.length > 1 && (
            <>
              <button
                onClick={goToPrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-4 rounded-full hover:bg-opacity-75 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={goToNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-4 rounded-full hover:bg-opacity-75 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* 하단 썸네일 네비게이션 */}
          {projectImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black bg-opacity-50 p-3 rounded-lg max-w-full overflow-x-auto">
              {projectImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                    idx === currentImageIndex
                      ? 'border-[#0046FF] opacity-100'
                      : 'border-white border-opacity-30 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`썸네일 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
