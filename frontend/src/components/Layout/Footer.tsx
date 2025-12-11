'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-[#333333] text-white">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 회사 정보 */}
          <div>
            <h3 className="text-lg font-bold mb-4">신한금융그룹</h3>
            <p className="text-sm text-gray-400">
              신한금융지주 광고관리 플랫폼
              <br />
              © 2024 Shinhan Financial Group. All rights reserved.
            </p>
          </div>

          {/* 링크 */}
          <div>
            <h3 className="text-lg font-bold mb-4">바로가기</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.shinhangroup.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  신한금융그룹 홈페이지
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  이용약관
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  개인정보처리방침
                </a>
              </li>
            </ul>
          </div>

          {/* 문의 */}
          <div>
            <h3 className="text-lg font-bold mb-4">문의하기</h3>
            <p className="text-sm text-gray-400">
              이메일: support@shinhan.com
              <br />
              전화: 02-1234-5678
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-400">
          <p>본 시스템은 신한금융지주 및 신한은행의 광고 자료 관리를 위한 플랫폼입니다.</p>
        </div>
      </div>
    </footer>
  );
}
