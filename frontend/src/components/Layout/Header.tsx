'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user, logout: authLogout } = useAuth();
  const router = useRouter();
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await authLogout();
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
      // 실패해도 로컬 스토리지는 정리되므로 로그인 페이지로 이동
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] shadow-sm">
      <div className="max-w-content mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-[#0046FF]">신한금융</div>
            <span className="text-sm text-gray-600">광고관리 플랫폼</span>
          </Link>

          {/* 네비게이션 */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/projects"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              프로젝트 목록
            </Link>
            <Link
              href="/projects/upload"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              프로젝트 업로드
            </Link>
            <Link
              href="/mypage"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              마이페이지
            </Link>
            {user?.role === 'ADMIN' && (
              <div className="relative">
                <button
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors flex items-center gap-1"
                >
                  관리자
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdminMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAdminMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#E0E0E0] rounded-lg shadow-lg py-2">
                    <Link
                      href="/admin/users"
                      className="block px-4 py-2 text-sm text-[#333333] hover:bg-gray-50 hover:text-[#0046FF] transition-colors"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      회원 관리
                    </Link>
                    <Link
                      href="/admin/categories"
                      className="block px-4 py-2 text-sm text-[#333333] hover:bg-gray-50 hover:text-[#0046FF] transition-colors"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      카테고리 관리
                    </Link>
                    <Link
                      href="/admin/logs"
                      className="block px-4 py-2 text-sm text-[#333333] hover:bg-gray-50 hover:text-[#0046FF] transition-colors"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      활동 로그
                    </Link>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* 사용자 영역 */}
          <div className="flex items-center space-x-4">
            {user && (
              <span className="text-sm text-gray-600">
                {user.name}님
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button className="md:hidden p-2 text-gray-600 hover:text-[#0046FF]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
