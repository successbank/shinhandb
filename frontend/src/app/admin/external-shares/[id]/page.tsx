'use client';

import React, { useState, useEffect } from 'react';
import { externalShareAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface ShareProject {
  id: string;
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  category: 'holding' | 'bank';
  year: number;
  quarter: '1Q' | '2Q' | '3Q' | '4Q';
  displayOrder: number;
}

interface ShareDetail {
  id: string;
  shareId: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  viewCount: number;
  lastAccessedAt: string | null;
  shareUrl: string;
  projects: ShareProject[];
}

export default function ExternalShareDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const shareId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchShareData();
    } else if (user && user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, shareId]);

  const fetchShareData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await externalShareAPI.get(shareId);
      if (response.success) {
        setShareData(response.data);
      }
    } catch (err: any) {
      setError(err.message || '데이터 조회에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!shareData) return;

    const url = `${window.location.origin}/share/${shareData.shareId}`;

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
      fallbackCopyTextToClipboard(url);
    }
  };

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

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getCategoryName = (category: 'holding' | 'bank') => {
    return category === 'holding' ? '신한금융지주' : '신한은행';
  };

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
        <Header />
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#0046FF] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
        <Header />
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-red-600 mb-4">{error || '데이터를 찾을 수 없습니다'}</p>
            <button
              onClick={() => router.push('/admin/external-shares')}
              className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-[#003ACC]"
            >
              목록으로 돌아가기
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/external-shares')}
            className="mb-4 text-[#0046FF] hover:underline flex items-center gap-1"
          >
            ← 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-shinhan-darkGray mb-2">외부공유 상세</h1>
          <p className="text-gray-600">외부공유 정보 및 포함된 프로젝트 목록</p>
        </div>

        {/* 공유 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#333333] mb-2">
                /share/{shareData.shareId}
              </h2>
              <div className="flex items-center gap-2">
                {shareData.isActive && !isExpired(shareData.expiresAt) ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    활성화
                  </span>
                ) : isExpired(shareData.expiresAt) ? (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    만료됨
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                    비활성화
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-[#0046FF] text-white text-sm rounded-lg hover:bg-[#003ACC] transition-colors"
              >
                URL 복사
              </button>
              <button
                onClick={() => router.push(`/admin/external-shares/${shareData.id}/edit`)}
                className="px-4 py-2 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition-colors"
              >
                수정
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">프로젝트 수</p>
              <p className="text-lg font-bold text-[#333333]">
                {shareData.projects?.length || 0}개
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">조회수</p>
              <p className="text-lg font-bold text-[#333333]">{shareData.viewCount}회</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">생성일</p>
              <p className="text-lg font-bold text-[#333333]">
                {formatDate(shareData.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">만료일</p>
              <p className="text-lg font-bold text-[#333333]">
                {formatDate(shareData.expiresAt)}
              </p>
            </div>
          </div>

          {shareData.lastAccessedAt && (
            <div className="pt-4 border-t border-[#E0E0E0]">
              <p className="text-sm text-gray-500">
                마지막 접근: {formatDate(shareData.lastAccessedAt)}
              </p>
            </div>
          )}
        </div>

        {/* 포함된 프로젝트 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#333333] mb-4">
            포함된 프로젝트 ({shareData.projects?.length || 0}개)
          </h2>

          {!shareData.projects || shareData.projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">포함된 프로젝트가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shareData.projects.map((project, index) => (
                <div
                  key={project.id}
                  className="border border-[#E0E0E0] rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#333333] mb-1">
                        {project.projectTitle}
                      </h3>
                      {project.projectDescription && (
                        <p className="text-sm text-gray-600">
                          {project.projectDescription}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">카테고리:</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                        {getCategoryName(project.category)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">기간:</span>
                      <span className="font-medium text-[#333333]">
                        {project.year}년 {project.quarter}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/external-shares')}
            className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
          >
            목록으로 돌아가기
          </button>
          <button
            onClick={() => router.push(`/admin/external-shares/${shareData.id}/edit`)}
            className="px-8 py-3 bg-[#0046FF] text-white rounded-lg font-bold hover:bg-[#003ACC] transition-colors"
          >
            수정
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
