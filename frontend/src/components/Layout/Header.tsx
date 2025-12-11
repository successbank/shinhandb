'use client';

import React from 'react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-[#0046FF]">신한금융</div>
            <span className="text-sm text-gray-600">광고관리 플랫폼</span>
          </Link>

          {/* 네비게이션 */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/contents"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              콘텐츠 목록
            </Link>
            <Link
              href="/upload"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              업로드
            </Link>
            <Link
              href="/mypage"
              className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors"
            >
              마이페이지
            </Link>
          </nav>

          {/* 사용자 영역 */}
          <div className="flex items-center space-x-4">
            <button className="text-sm font-medium text-[#333333] hover:text-[#0046FF] transition-colors">
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
