'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 루트 페이지
 * 인증 상태에 따라 적절한 페이지로 리다이렉트
 * - 토큰 있음: /projects (로그인 유지)
 * - 토큰 없음: /login
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/projects');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
