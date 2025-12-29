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

// 파티클 데이터 타입 (로그인 페이지와 동일)
interface Particle {
  id: number;
  size: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay: number;
  fadeDelay: number;
}

// 분기 날짜 계산 함수
const getQuarterDates = (year: number, quarter: string) => {
  const quarterNum = parseInt(quarter.replace('Q', ''));
  const startMonth = (quarterNum - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2; // 2, 5, 8, 11

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0); // 마지막 날

  return { start, end };
};

// 분기 상태 계산 함수
const getQuarterStatus = (year: number, quarter: string): {
  status: 'current' | 'past' | 'upcoming';
  days: number;
  label: string;
} => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { start, end } = getQuarterDates(year, quarter);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const msPerDay = 24 * 60 * 60 * 1000;

  if (today < start) {
    // 아직 시작 안함
    const daysUntil = Math.ceil((start.getTime() - today.getTime()) / msPerDay);
    return { status: 'upcoming', days: daysUntil, label: `${daysUntil}일 후 시작` };
  } else if (today > end) {
    // 이미 종료됨
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
    return { status: 'past', days: totalDays, label: `${totalDays}일간 진행` };
  } else {
    // 현재 진행 중
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / msPerDay) + 1;
    return { status: 'current', days: daysLeft, label: `D-${daysLeft}` };
  }
};

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
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMounted, setIsMounted] = useState(false);
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

  // 파티클 애니메이션 초기화 (로그인 페이지와 동일)
  useEffect(() => {
    setIsMounted(true);
    const particleCount = 50;
    const result: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      result.push({
        id: i,
        size: Math.random() * 8 + 4,
        startX: Math.random() * 100,
        startY: Math.random() * 100,
        endX: Math.random() * 100,
        endY: -(Math.random() * 30 + 10),
        duration: Math.random() * 15000 + 30000,
        delay: Math.random() * 2000,
        fadeDelay: Math.random() * 1000,
      });
    }

    setParticles(result);

    // 페이드인 애니메이션 트리거
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
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

  // 모바일 뒤로가기 버튼으로 분기 모달 닫기 (History API 활용)
  useEffect(() => {
    // 분기 모달이 열려 있고, 이미지 갤러리는 닫혀 있을 때만
    if (selectedQuarter && !imageGalleryOpen) {
      // 히스토리 엔트리 추가 (뒤로가기 감지용)
      window.history.pushState({ modalOpen: true, type: 'quarter' }, '');

      // popstate 이벤트 리스너 (뒤로가기 감지)
      const handlePopState = (event: PopStateEvent) => {
        // 뒤로가기 버튼 클릭 시 모달 닫기
        setSelectedQuarter(null);
      };

      window.addEventListener('popstate', handlePopState);

      // cleanup: 이벤트 리스너 제거
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [selectedQuarter, imageGalleryOpen]);

  // 모바일 뒤로가기 버튼으로 이미지 갤러리 모달 닫기 (History API 활용)
  useEffect(() => {
    // 이미지 갤러리가 열릴 때
    if (imageGalleryOpen) {
      // 히스토리 엔트리 추가 (뒤로가기 감지용)
      window.history.pushState({ modalOpen: true, type: 'imageGallery' }, '');

      // popstate 이벤트 리스너 (뒤로가기 감지)
      const handlePopState = (event: PopStateEvent) => {
        // 뒤로가기 버튼 클릭 시 이미지 갤러리 닫기
        closeImageGallery();
      };

      window.addEventListener('popstate', handlePopState);

      // cleanup: 이벤트 리스너 제거
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [imageGalleryOpen]);

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
      <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* 신한 블루 그라디언트 배경 */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0046FF] via-[#0041E8] to-[#002D9C]"></div>

        {/* 빛 파티클 효과 (아래에서 위로 올라옴) */}
        {isMounted && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="particle-container absolute"
                style={{
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  left: `${particle.startX}vw`,
                  top: `${particle.startY}vh`,
                  animationName: `particle-rise-${particle.id}`,
                  animationDuration: `${particle.duration}ms`,
                  animationDelay: `${particle.delay}ms`,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'linear',
                  willChange: 'transform',
                }}
              >
                <div
                  className="particle-circle"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(0, 70, 255, 0.6) 20%, rgba(0, 70, 255, 0) 70%)',
                    mixBlendMode: 'screen',
                    animationName: 'particle-fade-scale',
                    animationDuration: '2s',
                    animationDelay: `${particle.fadeDelay}ms`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 배경 애니메이션 요소들 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-blue-300 opacity-10 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl animate-float"></div>

          {/* 기하학적 패턴 */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        {/* 비밀번호 입력 카드 */}
        <div
          className={`relative z-10 w-full max-w-md transition-all duration-1000 ease-out ${
            isVisible
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-12 scale-95'
          }`}
        >
          {/* 로고 및 타이틀 섹션 */}
          <div
            className={`text-center mb-8 transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
          >
            <div style={{ fontFamily: 'OneShinhan, sans-serif' }}>
              <div className="text-lg md:text-xl font-medium text-blue-100 mb-2 tracking-wide opacity-90">
                신한금융그룹
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                광고자료 열람
              </h1>
            </div>
            <p className="text-blue-100 text-sm md:text-base opacity-80">
              Shinhan Financial Group AD Archive
            </p>
          </div>

          {/* 비밀번호 입력 폼 카드 */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
            {/* 안내 */}
            <div
              className={`text-center mb-8 transition-all duration-700 delay-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-semibold text-[#333333] mb-2">
                비밀번호 입력
              </h2>
              <p className="text-sm text-gray-500">
                공유받은 비밀번호 4자리를 입력하세요
              </p>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-600 px-4 py-3 rounded-r animate-shake">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* PIN 입력 */}
            <div
              className={`flex justify-center gap-3 mb-8 transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
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
                  className="w-14 h-14 md:w-16 md:h-16 text-center text-2xl md:text-3xl font-bold text-gray-900 border-2 border-gray-300 rounded-xl bg-gray-50 hover:bg-white focus:border-[#0046FF] focus:ring-2 focus:ring-[#0046FF]/30 focus:bg-white focus:outline-none transition-all duration-300"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* 확인 버튼 */}
            <div
              className={`transition-all duration-700 delay-400 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <button
                onClick={handleVerify}
                disabled={loading || password.some((p) => !p)}
                className="w-full bg-gradient-to-r from-[#0046FF] to-blue-600 text-white py-3.5 px-4 rounded-lg font-semibold text-base hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0046FF] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    확인 중...
                  </span>
                ) : (
                  '확인'
                )}
              </button>
            </div>
          </div>

          {/* 하단 안내 문구 */}
          <div
            className={`transition-all duration-700 delay-500 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <p className="text-center text-xs text-blue-100 mt-6 opacity-80">
              신한금융지주 및 신한은행 광고 자료 통합 검색 및 관리 시스템
            </p>
            <p className="text-center text-xs text-blue-200 mt-2 opacity-60">
              © 2025 Shinhan Financial Group. All rights reserved.
            </p>
          </div>
        </div>

        {/* 커스텀 애니메이션 스타일 */}
        <style jsx>{`
          @keyframes float {
            0%, 100% {
              transform: translateY(0) translateX(0);
            }
            50% {
              transform: translateY(-30px) translateX(15px);
            }
          }

          @keyframes float-delayed {
            0%, 100% {
              transform: translateY(0) translateX(0);
            }
            50% {
              transform: translateY(-40px) translateX(-20px);
            }
          }

          @keyframes pulse-slow {
            0%, 100% {
              opacity: 0.1;
              transform: scale(1);
            }
            50% {
              opacity: 0.15;
              transform: scale(1.05);
            }
          }

          @keyframes particle-fade-scale {
            0%, 100% {
              opacity: 1;
              transform: scale(0.4);
            }
            50% {
              opacity: 0.7;
              transform: scale(2.2);
            }
          }

          @keyframes shake {
            0%, 100% {
              transform: translateX(0);
            }
            10%, 30%, 50%, 70%, 90% {
              transform: translateX(-5px);
            }
            20%, 40%, 60%, 80% {
              transform: translateX(5px);
            }
          }

          .animate-float {
            animation: float 25s ease-in-out infinite;
          }

          .animate-float-delayed {
            animation: float-delayed 30s ease-in-out infinite;
          }

          .animate-pulse-slow {
            animation: pulse-slow 20s ease-in-out infinite;
          }

          .animate-shake {
            animation: shake 0.5s ease-in-out;
          }

          ${isMounted && particles.length > 0 ? particles.map(
            (p) => `
            @keyframes particle-rise-${p.id} {
              from {
                transform: translate3d(${p.startX}vw, ${p.startY}vh, 0);
              }
              to {
                transform: translate3d(${p.endX}vw, ${p.endY}vh, 0);
              }
            }
          `
          ).join('\n') : ''}
        `}</style>
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
                        .map(([year, quarters]) => {
                          // 모든 분기의 프로젝트를 평탄화하여 하나의 배열로 만들기
                          const allProjects = Object.entries(quarters)
                            .sort(([a], [b]) => a.localeCompare(b)) // 1Q, 2Q, 3Q, 4Q 순서
                            .flatMap(([quarter, projects]) =>
                              projects.map(project => ({ ...project, quarter }))
                            );

                          return (
                            <div key={year}>
                              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
                                {year}년
                                <span className="text-blue-200 text-sm font-normal ml-2">
                                  ({allProjects.length}개 프로젝트)
                                </span>
                              </h3>

                              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {allProjects.map((project) => (
                                  <div
                                    key={project.projectId}
                                    onClick={() => openImageGallery(project)}
                                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                                  >
                                    <div className="aspect-[3/4] overflow-hidden bg-gray-100 relative">
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
                                      {/* 분기 뱃지 */}
                                      <span className="absolute top-2 left-2 px-2 py-1 bg-[#0046FF] text-white text-xs font-bold rounded">
                                        {project.quarter}
                                      </span>
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
                          );
                        })}
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
                        .map(([year, quarters]) => {
                          // 모든 분기의 프로젝트를 평탄화하여 하나의 배열로 만들기
                          const allProjects = Object.entries(quarters)
                            .sort(([a], [b]) => a.localeCompare(b)) // 1Q, 2Q, 3Q, 4Q 순서
                            .flatMap(([quarter, projects]) =>
                              projects.map(project => ({ ...project, quarter }))
                            );

                          return (
                            <div key={year}>
                              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
                                {year}년
                                <span className="text-blue-200 text-sm font-normal ml-2">
                                  ({allProjects.length}개 프로젝트)
                                </span>
                              </h3>

                              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {allProjects.map((project) => (
                                  <div
                                    key={project.projectId}
                                    onClick={() => openImageGallery(project)}
                                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                                  >
                                    <div className="aspect-[3/4] overflow-hidden bg-gray-100 relative">
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
                                      {/* 분기 뱃지 */}
                                      <span className="absolute top-2 left-2 px-2 py-1 bg-[#0046FF] text-white text-xs font-bold rounded">
                                        {project.quarter}
                                      </span>
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
                          );
                        })}
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
              /* ===== 모바일 뷰 (768px 미만) - 디자인 리뉴얼 ===== */
              <div className="space-y-10">
                {/* 신한금융지주 */}
                {timeline.holding && Object.keys(timeline.holding).length > 0 && (
                  <div className="relative">
                    {/* 섹션 헤더 */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">신한금융지주</h2>
                        <p className="text-blue-200 text-xs">Shinhan Financial Group</p>
                      </div>
                    </div>

                    {/* 연도별 콘텐츠 */}
                    <div className="space-y-6">
                      {Object.entries(timeline.holding)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => {
                          const totalProjects = Object.values(quarters).reduce((sum, projects) => sum + projects.length, 0);

                          return (
                            <div key={year} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                              {/* 연도 헤더 */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-bold text-white">{year}</span>
                                  <span className="text-blue-200 text-sm">년</span>
                                </div>
                                <div className="flex items-center text-xs text-blue-200">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    {totalProjects}개 프로젝트
                                  </span>
                                </div>
                              </div>

                              {/* 분기 카드 그리드 */}
                              <div className="grid grid-cols-2 gap-3">
                                {Object.entries(quarters)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([quarter, projects]) => {
                                    const quarterStatus = getQuarterStatus(parseInt(year), quarter);
                                    const isCurrent = quarterStatus.status === 'current';
                                    const isPast = quarterStatus.status === 'past';

                                    return (
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
                                    className="group relative backdrop-blur-sm rounded-xl p-4 text-left overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] shadow-md bg-gradient-to-br from-[#EBF0FF] to-[#E0E8FF] ring-2 ring-[#0046FF]/30"
                                  >
                                    {/* 좌측 액센트 바 */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-[#0046FF] to-[#003399]"></div>

                                    {/* 분기 표시 */}
                                    <div className="flex items-baseline gap-0 mb-2 pl-2">
                                      <span className="text-2xl font-black text-[#0046FF]">{quarter.replace('Q', '')}</span>
                                      <span className="text-2xl font-black text-[#0046FF]">Q</span>
                                    </div>

                                    {/* 프로젝트 정보 */}
                                    <div className="pl-2 space-y-1">
                                      <div className="flex items-center gap-1.5 text-gray-700">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <span className="text-sm font-medium">{projects.length}개</span>
                                      </div>
                                    </div>

                                    {/* 화살표 아이콘 */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <svg className="w-5 h-5 text-[#0046FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </button>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 신한은행 */}
                {timeline.bank && Object.keys(timeline.bank).length > 0 && (
                  <div className="relative">
                    {/* 섹션 헤더 */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">신한은행</h2>
                        <p className="text-blue-200 text-xs">Shinhan Bank</p>
                      </div>
                    </div>

                    {/* 연도별 콘텐츠 */}
                    <div className="space-y-6">
                      {Object.entries(timeline.bank)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, quarters]) => {
                          const totalProjects = Object.values(quarters).reduce((sum, projects) => sum + projects.length, 0);

                          return (
                            <div key={year} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                              {/* 연도 헤더 */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-bold text-white">{year}</span>
                                  <span className="text-blue-200 text-sm">년</span>
                                </div>
                                <div className="flex items-center text-xs text-blue-200">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    {totalProjects}개 프로젝트
                                  </span>
                                </div>
                              </div>

                              {/* 분기 카드 그리드 */}
                              <div className="grid grid-cols-2 gap-3">
                                {Object.entries(quarters)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([quarter, projects]) => {
                                    const quarterStatus = getQuarterStatus(parseInt(year), quarter);

                                    return (
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
                                    className="group relative backdrop-blur-sm rounded-xl p-4 text-left overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] shadow-md bg-gradient-to-br from-[#EBF0FF] to-[#E0E8FF] ring-2 ring-[#0046FF]/30"
                                  >
                                    {/* 좌측 액센트 바 */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-[#0046FF] to-[#003399]"></div>

                                    {/* 분기 표시 */}
                                    <div className="flex items-baseline gap-0 mb-2 pl-2">
                                      <span className="text-2xl font-black text-[#0046FF]">{quarter.replace('Q', '')}</span>
                                      <span className="text-2xl font-black text-[#0046FF]">Q</span>
                                    </div>

                                    {/* 프로젝트 정보 */}
                                    <div className="pl-2 space-y-1">
                                      <div className="flex items-center gap-1.5 text-gray-700">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <span className="text-sm font-medium">{projects.length}개</span>
                                      </div>
                                    </div>

                                    {/* 화살표 아이콘 */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <svg className="w-5 h-5 text-[#0046FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </button>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 빈 메시지 */}
                {(!timeline.holding || Object.keys(timeline.holding).length === 0) &&
                  (!timeline.bank || Object.keys(timeline.bank).length === 0) && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
                      <svg className="w-16 h-16 text-white/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="text-white/60">공유된 프로젝트가 없습니다</p>
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
                max-width: 460px;
                border-radius: 0;
              }

              .quarter-swiper .swiper-slide img {
                border-radius: 0;
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
                max-width: 368px;
                border-radius: 0;
              }

              .quarter-swiper .swiper-slide img {
                border-radius: 0;
              }
            }
          `}</style>

          {/* 닫기 버튼 - 모바일: 오른쪽, 20% 축소 / PC: 왼쪽 */}
          <button
            onClick={() => {
              // 히스토리 엔트리가 있으면 뒤로가기로 처리 (popstate에서 모달 닫힘)
              if (window.history.state?.modalOpen) {
                window.history.back();
              } else {
                // 히스토리 엔트리가 없으면 직접 닫기
                setSelectedQuarter(null);
              }
            }}
            className="fixed top-4 right-4 md:right-auto md:left-4 text-white text-sm md:text-base font-medium hover:bg-white/30 z-50 px-4 py-2 md:px-5 md:py-2.5 bg-white/20 rounded-lg backdrop-blur-sm shadow-lg"
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
          {/* X 닫기 버튼 - 모바일: 30% 축소 */}
          <button
            onClick={() => {
              // 히스토리 엔트리가 있으면 뒤로가기로 처리 (popstate에서 모달 닫힘)
              if (window.history.state?.modalOpen) {
                window.history.back();
              } else {
                // 히스토리 엔트리가 없으면 직접 닫기
                closeImageGallery();
              }
            }}
            className="absolute top-4 right-4 text-white text-2xl md:text-4xl hover:text-gray-300 z-10"
          >
            ×
          </button>

          {/* 프로젝트 정보 */}
          <div className="absolute top-16 left-4 text-white z-10">
            <h3 className="text-xl font-bold mb-1">{selectedProject.title}</h3>
            <p className="text-sm text-gray-300">
              {currentImageIndex + 1} / {projectImages.length}
            </p>
          </div>

          {/* 이미지 */}
          <div className="relative w-full h-full flex items-center justify-center p-0">
            {projectImages.length > 0 ? (
              <img
                src={projectImages[currentImageIndex]}
                alt={`${selectedProject.title} - ${currentImageIndex + 1}`}
                className="max-w-full md:max-w-5xl md:max-h-[85vh] h-auto object-contain mx-auto"
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
