'use client';

import React, { useState, useEffect } from 'react';
import { externalShareAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface ExternalShare {
  id: string;
  shareId: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  viewCount: number;
  lastAccessedAt: string | null;
  projectCount: number;
}

export default function ExternalSharesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [shares, setShares] = useState<ExternalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // ADMIN 권한 체크
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, router]);

  // 목록 조회
  const fetchShares = async () => {
    setLoading(true);
    setError(null);

    try {
      let params: any = { page, limit: 20 };

      if (filter === 'active') {
        params.isActive = true;
        params.isExpired = false;
      } else if (filter === 'inactive') {
        params.isActive = false;
      } else if (filter === 'expired') {
        params.isExpired = true;
      }

      const response = await externalShareAPI.list(params);

      if (response.success) {
        setShares(response.data);
        setTotalPages(response.meta?.totalPages || 1);
      }
    } catch (err: any) {
      setError(err.message || '목록 조회에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [page, filter]);

  // 활성화/비활성화 토글
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await externalShareAPI.update(id, { isActive: !currentStatus });
      fetchShares(); // 새로고침
    } catch (err: any) {
      alert(err.message || '상태 변경에 실패했습니다');
    }
  };

  // 삭제
  const handleDelete = async (id: string, shareId: string) => {
    if (!confirm(`공유 URL (${shareId})을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await externalShareAPI.delete(id);
      alert('삭제되었습니다');
      fetchShares(); // 새로고침
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다');
    }
  };

  // URL 복사 (HTTP 환경 fallback 포함)
  const handleCopyUrl = (shareId: string) => {
    const url = `${window.location.origin}/share/${shareId}`;

    // Clipboard API 사용 가능 여부 확인
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          alert('URL이 복사되었습니다');
        })
        .catch((err) => {
          console.error('Clipboard API 실패:', err);
          fallbackCopyTextToClipboard(url);
        });
    } else {
      // Fallback 방식 사용
      fallbackCopyTextToClipboard(url);
    }
  };

  // Fallback: textarea를 이용한 복사
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('URL이 복사되었습니다');
      } else {
        alert('복사에 실패했습니다. 수동으로 복사해주세요:\n' + text);
      }
    } catch (err) {
      console.error('Fallback 복사 실패:', err);
      alert('복사에 실패했습니다. 수동으로 복사해주세요:\n' + text);
    }

    document.body.removeChild(textArea);
  };

  // 날짜 포맷
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 만료 여부 체크
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-shinhan-darkGray">외부공유 관리</h1>
          <p className="text-gray-600">
            외부 사용자와 공유할 프로젝트 URL을 생성하고 관리합니다
          </p>
        </div>

        {/* 필터 및 생성 버튼 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* 필터 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-[#0046FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-[#0046FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                활성화
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'inactive'
                    ? 'bg-[#0046FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                비활성화
              </button>
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'expired'
                    ? 'bg-[#0046FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                만료됨
              </button>
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={() => router.push('/admin/external-shares/create')}
              className="px-6 py-2 bg-[#0046FF] text-white rounded-lg font-medium hover:bg-[#003ACC] transition-colors"
            >
              + 새 공유 생성
            </button>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#0046FF] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 목록 */}
        {!loading && !error && (
          <>
            {shares.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500">생성된 공유가 없습니다</p>
                <button
                  onClick={() => router.push('/admin/external-shares/create')}
                  className="mt-4 px-6 py-2 bg-[#0046FF] text-white rounded-lg font-medium hover:bg-[#003ACC] transition-colors"
                >
                  첫 공유 생성하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* 왼쪽: 정보 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-[#333333]">
                            /share/{share.shareId}
                          </h3>
                          {share.isActive && !isExpired(share.expiresAt) ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              활성화
                            </span>
                          ) : isExpired(share.expiresAt) ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              만료됨
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                              비활성화
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">프로젝트 수</p>
                            <p className="font-medium text-[#333333]">{share.projectCount}개</p>
                          </div>
                          <div>
                            <p className="text-gray-500">조회수</p>
                            <p className="font-medium text-[#333333]">{share.viewCount}회</p>
                          </div>
                          <div>
                            <p className="text-gray-500">생성일</p>
                            <p className="font-medium text-[#333333]">
                              {formatDate(share.createdAt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">만료일</p>
                            <p className="font-medium text-[#333333]">
                              {formatDate(share.expiresAt)}
                            </p>
                          </div>
                        </div>

                        {share.lastAccessedAt && (
                          <p className="mt-3 text-sm text-gray-500">
                            마지막 접근: {formatDate(share.lastAccessedAt)}
                          </p>
                        )}
                      </div>

                      {/* 오른쪽: 액션 버튼 */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleCopyUrl(share.shareId)}
                          className="px-4 py-2 bg-[#0046FF] text-white text-sm rounded-lg hover:bg-[#003ACC] transition-colors"
                        >
                          URL 복사
                        </button>
                        <button
                          onClick={() => router.push(`/admin/external-shares/${share.id}`)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          상세보기
                        </button>
                        <button
                          onClick={() => router.push(`/admin/external-shares/${share.id}/edit`)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleToggleActive(share.id, share.isActive)}
                          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                            share.isActive
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {share.isActive ? '비활성화' : '활성화'}
                        </button>
                        <button
                          onClick={() => handleDelete(share.id, share.shareId)}
                          className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-[#E0E0E0] rounded-lg text-sm font-medium text-[#333333] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-white border border-[#E0E0E0] rounded-lg text-sm font-medium text-[#333333] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
