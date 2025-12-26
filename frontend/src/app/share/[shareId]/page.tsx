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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const swiperRef = useRef<any>(null);
  const thumbSwiperRef = useRef<any>(null);

  // sessionStorage에서 토큰 복원
  useEffect(() => {
    const savedToken = sessionStorage.getItem(`share_token_${shareId}`);
    if (savedToken) {
      setToken(savedToken);
      setStep('timeline');
      // 토큰 만료 가능성 있으므로 오류 처리
      fetchTimeline(savedToken).catch(() => {
        // 토큰 만료 시 sessionStorage 삭제하고 비밀번호 입력으로 이동
        sessionStorage.removeItem(`share_token_${shareId}`);
        setStep('password');
        setToken(null);
        setError(null);
      });
    }
  }, [shareId]);

  // 화면 크기 감지 (768px 기준: PC/태블릿 vs 모바일)
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    // 초기 체크
    checkScreenSize();

    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
      if (response.success && response.data) {
        // 백엔드 응답: proposalDrafts (제안 시안), finalManuscripts (최종 원고)
        const allFiles = [
          ...(response.data.finalManuscripts || []),
          ...(response.data.proposalDrafts || []),
        ];
        // fileUrl 또는 thumbnailUrl 사용
        const imageUrls = allFiles.map((file: any) => file.fileUrl || file.thumbnailUrl).filter(Boolean);
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
    // currentSlideIndex는 유지 - 캐러셀 위치 기억
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

  // Swiper 초기화 (갤러리 닫힐 때 재초기화 포함)
  useEffect(() => {
    if (!selectedQuarter || !swiperLoaded) return;
    // 이미지 갤러리가 열려있으면 Swiper 초기화 건너뛰기
    if (imageGalleryOpen) return;

    const initSwiper = () => {
      if (typeof window !== 'undefined' && (window as any).Swiper) {
        const Swiper = (window as any).Swiper;

        // 기존 Swiper 인스턴스 정리
        if (thumbSwiperRef.current) {
          thumbSwiperRef.current.destroy(true, true);
          thumbSwiperRef.current = null;
        }
        if (swiperRef.current) {
          swiperRef.current.destroy(true, true);
          swiperRef.current = null;
        }

        // 썸네일 Swiper 먼저 초기화
        thumbSwiperRef.current = new Swiper('.thumb-swiper', {
          spaceBetween: 8,
          slidesPerView: 'auto',
          freeMode: true,
          watchSlidesProgress: true,
          centeredSlides: true,
          slideToClickedSlide: true,
          initialSlide: currentSlideIndex,
          navigation: {
            nextEl: '#thumb-next-btn',
            prevEl: '#thumb-prev-btn',
          },
        });

        // 메인 Swiper 초기화 (thumbs 연결)
        swiperRef.current = new Swiper('.quarter-swiper', {
          effect: 'coverflow',
          grabCursor: true,
          centeredSlides: true,
          slidesPerView: 'auto',
          loop: false,
          rewind: selectedQuarter.projects.length > 1,
          speed: 800,
          initialSlide: currentSlideIndex,
          coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 200,
            modifier: 1.5,
            slideShadows: true,
          },
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          },
          keyboard: {
            enabled: true,
          },
          mousewheel: {
            forceToAxis: true,
            sensitivity: 1,
          },
          thumbs: {
            swiper: thumbSwiperRef.current,
          },
          on: {
            slideChange: function(swiper: any) {
              setCurrentSlideIndex(swiper.activeIndex);
            },
          },
        });
      }
    };

    const timer = setTimeout(initSwiper, 100);
    return () => {
      clearTimeout(timer);
    };
  }, [selectedQuarter, swiperLoaded, imageGalleryOpen]);

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
          <>
            {/* ===== PC/태블릿 갤러리 뷰 (768px 이상) ===== */}
            {isDesktop ? (
              <div className="space-y-16">
                {/* 신한금융지주 - PC 갤러리 */}
                {timeline.holding && Object.keys(timeline.holding).length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-1 h-8 bg-white rounded-full"></div>
                      <h2 className="text-3xl font-bold text-white">신한금융지주</h2>
                    </div>

                    <div className="space-y-12">
                      {Object.entries(timeline.holding)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => (
                          <div key={year}>
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
                              {year}년
                            </h3>

                            {Object.entries(quarters).map(([quarter, projects]) => (
                              <div key={quarter} className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                                    {quarter}
                                  </span>
                                  <span className="text-blue-200 text-sm">
                                    {projects.length}개 프로젝트
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                  {projects.map((project) => (
                                    <div
                                      key={project.projectId}
                                      onClick={() => openImageGallery(project)}
                                      className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                                    >
                                      <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                                        {project.thumbnailUrl ? (
                                          <img
                                            src={project.thumbnailUrl}
                                            alt={project.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <span className="text-gray-400 text-sm">No Image</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-4">
                                        <h4 className="font-bold text-gray-800 text-sm mb-2 line-clamp-2">
                                          {project.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span>{project.fileCount}개 파일</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 신한은행 - PC 갤러리 */}
                {timeline.bank && Object.keys(timeline.bank).length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-1 h-8 bg-white rounded-full"></div>
                      <h2 className="text-3xl font-bold text-white">신한은행</h2>
                    </div>

                    <div className="space-y-12">
                      {Object.entries(timeline.bank)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => (
                          <div key={year}>
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
                              {year}년
                            </h3>

                            {Object.entries(quarters).map(([quarter, projects]) => (
                              <div key={quarter} className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                                    {quarter}
                                  </span>
                                  <span className="text-blue-200 text-sm">
                                    {projects.length}개 프로젝트
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                  {projects.map((project) => (
                                    <div
                                      key={project.projectId}
                                      onClick={() => openImageGallery(project)}
                                      className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                                    >
                                      <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                                        {project.thumbnailUrl ? (
                                          <img
                                            src={project.thumbnailUrl}
                                            alt={project.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <span className="text-gray-400 text-sm">No Image</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-4">
                                        <h4 className="font-bold text-gray-800 text-sm mb-2 line-clamp-2">
                                          {project.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span>{project.fileCount}개 파일</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 빈 메시지 - PC */}
                {(!timeline.holding || Object.keys(timeline.holding).length === 0) &&
                  (!timeline.bank || Object.keys(timeline.bank).length === 0) && (
                    <div className="bg-white rounded-lg p-12 text-center">
                      <p className="text-gray-500">공유된 프로젝트가 없습니다</p>
                    </div>
                  )}
              </div>
            ) : (
              /* ===== 모바일 뷰 (768px 미만) - 기존 유지 ===== */
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
                                      onClick={() => {
                                        setCurrentSlideIndex(0);
                                        setSelectedQuarter({
                                          year,
                                          quarter,
                                          category: 'holding',
                                          categoryName: '신한금융지주',
                                          projects
                                        });
                                      }}
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
                                      onClick={() => {
                                        setCurrentSlideIndex(0);
                                        setSelectedQuarter({
                                          year,
                                          quarter,
                                          category: 'bank',
                                          categoryName: '신한은행',
                                          projects
                                        });
                                      }}
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
          </>
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
        <div className="fixed inset-0 bg-gradient-to-br from-[#0046FF] to-[#003399] z-50 flex flex-col items-center justify-center p-4 overflow-hidden">
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

            /* 썸네일 외부 컨테이너 - overflow 강제 제어 */
            .thumb-outer-container {
              width: 100%;
              max-width: 500px;
              margin: 0 auto;
              position: relative;
              overflow: hidden !important;
              overflow: clip !important;
              contain: content;
            }

            /* 썸네일 배경 박스 */
            .thumb-bg-box {
              background: rgba(0, 0, 0, 0.4);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 12px 40px;
              position: relative;
              overflow: hidden !important;
              overflow: clip !important;
            }

            /* 썸네일 Swiper 컨테이너 */
            .thumb-swiper {
              width: calc(100% - 0px) !important;
              overflow: hidden !important;
              overflow: clip !important;
              margin: 0 auto;
              position: relative;
            }

            .thumb-swiper .swiper-wrapper {
              display: flex;
              align-items: center;
              width: 100%;
            }

            .thumb-swiper .swiper-slide {
              width: 60px !important;
              height: 60px !important;
              min-width: 60px !important;
              max-width: 60px !important;
              border-radius: 12px;
              overflow: hidden;
              opacity: 0.5;
              cursor: pointer;
              transition: all 0.3s ease;
              border: 2px solid transparent;
              flex-shrink: 0;
              background: #333;
            }

            .thumb-swiper .swiper-slide-thumb-active {
              opacity: 1;
              border-color: white;
              box-shadow: 0 0 15px rgba(255,255,255,0.5);
            }

            .thumb-swiper .swiper-slide img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            /* 썸네일 네비게이션 버튼 - 배경 박스 양 끝에 위치 */
            .thumb-nav-btn {
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              width: 32px;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              cursor: pointer;
              z-index: 20;
              opacity: 0.8;
              transition: all 0.3s ease;
              background: linear-gradient(to right, rgba(0,0,0,0.3), transparent);
            }

            .thumb-nav-btn:hover {
              opacity: 1;
            }

            .thumb-nav-btn.prev {
              left: 0;
              border-radius: 16px 0 0 16px;
              background: linear-gradient(to right, rgba(0,0,0,0.5), transparent);
            }

            .thumb-nav-btn.next {
              right: 0;
              border-radius: 0 16px 16px 0;
              background: linear-gradient(to left, rgba(0,0,0,0.5), transparent);
            }

            .thumb-nav-btn svg {
              width: 20px;
              height: 20px;
            }

            /* 썸네일 Swiper 기본 네비게이션 숨기기 */
            .thumb-swiper .swiper-button-prev,
            .thumb-swiper .swiper-button-next {
              display: none !important;
            }

            @media (max-width: 768px) {
              .thumb-bg-box {
                padding: 10px 35px;
              }
              .thumb-swiper .swiper-slide {
                width: 50px !important;
                height: 50px !important;
                min-width: 50px !important;
                max-width: 50px !important;
                border-radius: 10px;
              }
              .thumb-nav-btn {
                width: 28px;
              }
              .thumb-nav-btn svg {
                width: 16px;
                height: 16px;
              }
            }

            @media (max-width: 480px) {
              .thumb-bg-box {
                padding: 8px 30px;
              }
              .thumb-swiper .swiper-slide {
                width: 45px !important;
                height: 45px !important;
                min-width: 45px !important;
                max-width: 45px !important;
                border-radius: 8px;
              }
              .thumb-nav-btn {
                width: 24px;
              }
              .thumb-nav-btn svg {
                width: 14px;
                height: 14px;
              }
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

          {/* 닫기 버튼 */}
          <button
            onClick={() => setSelectedQuarter(null)}
            className="fixed top-4 left-4 text-white text-base font-medium hover:bg-white/30 z-50 px-5 py-2.5 bg-white/20 rounded-lg backdrop-blur-sm shadow-lg"
            style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
          >
            닫기
          </button>

          {/* 헤더 */}
          <div className="text-center mb-8 relative w-full max-w-1200px">
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
              <div className="swiper-button-prev"></div>
              <div className="swiper-button-next"></div>
            </div>

            {/* 썸네일 네비게이션 */}
            <div className="flex justify-center mt-6">
              <div className="thumb-outer-container">
                <div className="thumb-bg-box">
                  {/* 왼쪽 화살표 버튼 */}
                  <button className="thumb-nav-btn prev" id="thumb-prev-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>

                  {/* 썸네일 Swiper */}
                  <div className="thumb-swiper">
                    <div className="swiper-wrapper">
                      {selectedQuarter.projects.map((project) => (
                        <div key={`thumb-${project.projectId}`} className="swiper-slide">
                          {project.thumbnailUrl ? (
                            <img
                              src={project.thumbnailUrl}
                              alt={`${project.title} 썸네일`}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                              <span className="text-white text-xs">No Image</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 오른쪽 화살표 버튼 */}
                  <button className="thumb-nav-btn next" id="thumb-next-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 터치 힌트 (모바일) */}
          
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
