'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/contents');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-shinhan-lightGray px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-shinhan-blue">신한금융 광고관리 플랫폼</h1>
          <p className="mt-2 text-sm text-shinhan-darkGray">
            로그인하여 광고 자료를 관리하세요
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-shinhan-error text-shinhan-error px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-shinhan-darkGray mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue focus:border-transparent"
                placeholder="이메일을 입력하세요"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-shinhan-darkGray mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue focus:border-transparent"
                placeholder="비밀번호를 입력하세요"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-shinhan-blue text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-shinhan-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="#" className="text-sm text-shinhan-blue hover:underline">
              비밀번호를 잊으셨나요?
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          신한금융지주 및 신한은행 광고 자료 통합 검색 및 관리 시스템
        </p>
      </div>
    </div>
  );
}
