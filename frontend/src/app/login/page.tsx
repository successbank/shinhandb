'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// 파티클 데이터 타입
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

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [koreanWarning, setKoreanWarning] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 클라이언트 사이드에서만 파티클 생성 (SSR 불일치 방지)
    setIsMounted(true);
    const particleCount = 50;
    const result: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      result.push({
        id: i,
        size: Math.random() * 8 + 4, // 4-12px
        startX: Math.random() * 100, // 0-100vw
        startY: Math.random() * 100, // 0-100vh (화면 전체에 분포)
        endX: Math.random() * 100, // 0-100vw
        endY: -(Math.random() * 30 + 10), // -10 to -40vh (화면 위)
        duration: Math.random() * 15000 + 30000, // 30-45초
        delay: Math.random() * 2000, // 0-2초 (페이지 로드 시 즉시 나타남)
        fadeDelay: Math.random() * 1000, // 0-1초
      });
    }

    setParticles(result);

    // 페이드인 애니메이션 트리거
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 한글 검증 함수
  const handleUsernameChange = (value: string) => {
    setUsername(value);

    // 한글 포함 여부 체크 (ㄱ-ㅎ, ㅏ-ㅣ, 가-힣)
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (koreanRegex.test(value)) {
      setKoreanWarning(true);
    } else {
      setKoreanWarning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 한글 체크
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (koreanRegex.test(username)) {
      setError('아이디는 영문과 숫자만 입력 가능합니다');
      setLoading(false);
      return;
    }

    try {
      await login(username, password);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 신한 블루 그라디언트 배경 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0046FF] via-[#0041E8] to-[#002D9C]"></div>

      {/* 빛 파티클 효과 (아래에서 위로 올라옴) - 클라이언트 사이드에서만 렌더링 */}
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
        {/* 큰 원형 그라데이션 1 */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float"></div>

        {/* 큰 원형 그라데이션 2 */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-float-delayed"></div>

        {/* 중간 원형 그라데이션 3 */}
        <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-blue-300 opacity-10 rounded-full blur-3xl animate-pulse-slow"></div>

        {/* 작은 원형 그라데이션 4 */}
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

      {/* 로그인 카드 */}
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
          {/* 타이틀 */}
          <div style={{ fontFamily: 'OneShinhan, sans-serif' }}>
            <div className="text-lg md:text-xl font-medium text-blue-100 mb-2 tracking-wide opacity-90">
              신한금융그룹
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
              인쇄광고 아카이브
            </h1>
          </div>
          <p className="text-blue-100 text-sm md:text-base opacity-80">
            Shinhan Financial Group Print AD Archive
          </p>
        </div>

        {/* 로그인 폼 카드 */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 환영 메시지 */}
            <div
              className={`text-center mb-6 transition-all duration-700 delay-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } ${focusedField ? 'opacity-70' : 'opacity-100'}`}
            >
              <h2 className="text-2xl font-semibold text-shinhan-darkGray mb-2">
                로그인
              </h2>
              <p className="text-sm text-gray-500">
                광고 자료를 관리하려면 로그인하세요
              </p>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className={`bg-red-50 border-l-4 border-shinhan-error text-shinhan-error px-4 py-3 rounded-r animate-shake transition-opacity duration-300 ${focusedField ? 'opacity-70' : 'opacity-100'}`}>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* 아이디 입력 */}
            <div
              className={`transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
            >
              <div
                className={`group relative transition-all duration-300 ease-out ${
                  focusedField === 'username'
                    ? 'scale-105 md:scale-103 z-20 -mx-2 -my-1 px-2 py-1'
                    : focusedField
                    ? 'opacity-60 scale-98'
                    : 'opacity-100 scale-100'
                }`}
              >
                <label
                  htmlFor="username"
                  className={`block text-sm font-semibold mb-2 transition-all duration-300 ${
                    focusedField === 'username'
                      ? 'text-shinhan-blue scale-105'
                      : 'text-shinhan-darkGray'
                  }`}
                >
                  아이디
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className={`h-5 w-5 transition-colors duration-300 ${
                        focusedField === 'username' ? 'text-shinhan-blue' : 'text-gray-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-all duration-300 bg-gray-50 hover:bg-white text-gray-900 ${
                      koreanWarning
                        ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50'
                        : focusedField === 'username'
                        ? 'border-shinhan-blue ring-2 ring-shinhan-blue/30 shadow-lg bg-white'
                        : 'border-gray-300 focus:border-shinhan-blue'
                    }`}
                    placeholder="아이디를 입력하세요"
                    disabled={loading}
                  />
                </div>
                {/* 한글 입력 경고 메시지 */}
                {koreanWarning && (
                  <div className="mt-2 text-red-600 text-sm font-medium flex items-center animate-shake">
                    <svg
                      className="h-4 w-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    아이디는 영문과 숫자만 입력 가능합니다
                  </div>
                )}
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div
              className={`transition-all duration-700 delay-400 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
            >
              <div
                className={`group relative transition-all duration-300 ease-out ${
                  focusedField === 'password'
                    ? 'scale-105 md:scale-103 z-20 -mx-2 -my-1 px-2 py-1'
                    : focusedField
                    ? 'opacity-60 scale-98'
                    : 'opacity-100 scale-100'
                }`}
              >
                <label
                  htmlFor="password"
                  className={`block text-sm font-semibold mb-2 transition-all duration-300 ${
                    focusedField === 'password'
                      ? 'text-shinhan-blue scale-105'
                      : 'text-shinhan-darkGray'
                  }`}
                >
                  비밀번호
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className={`h-5 w-5 transition-colors duration-300 ${
                        focusedField === 'password' ? 'text-shinhan-blue' : 'text-gray-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-all duration-300 bg-gray-50 hover:bg-white text-gray-900 ${
                      focusedField === 'password'
                        ? 'border-shinhan-blue ring-2 ring-shinhan-blue/30 shadow-lg bg-white'
                        : 'border-gray-300 focus:border-shinhan-blue'
                    }`}
                    placeholder="비밀번호를 입력하세요"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* 로그인 버튼 */}
            <div
              className={`transition-all duration-700 delay-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } ${focusedField ? 'opacity-70' : 'opacity-100'}`}
            >
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-shinhan-blue to-blue-600 text-white py-3.5 px-4 rounded-lg font-semibold text-base hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-shinhan-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    로그인 중...
                  </span>
                ) : (
                  '로그인'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 하단 안내 문구 */}
        <div
          className={`transition-all duration-700 delay-600 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          } ${focusedField ? 'opacity-50' : 'opacity-100'}`}
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

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
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

        .animate-float {
          animation: float 25s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 30s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 20s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 1s ease-out;
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
