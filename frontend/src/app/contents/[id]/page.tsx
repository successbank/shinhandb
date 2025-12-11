'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getContentById, contentApi, mypageApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import Image from 'next/image';

export default function ContentDetailPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadContent();
    }
  }, [id, isAuthenticated]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const response = await getContentById(id);
      setContent(response.data);
    } catch (error) {
      console.error('콘텐츠 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        // 북마크 삭제 로직 (북마크 ID 필요)
        alert('북마크 삭제 기능은 마이페이지에서 가능합니다');
      } else {
        await mypageApi.addBookmark(id);
        setBookmarked(true);
        alert('북마크에 추가되었습니다');
      }
    } catch (error: any) {
      alert(error.message || '북마크 처리 실패');
    }
  };

  const handleShare = async () => {
    try {
      const response = await contentApi.shareContent(id, 7); // 7일 만료
      const shareUrl = `${window.location.origin}/share/${response.data.shareId}`;
      setShareLink(shareUrl);
      setShowShareModal(true);
    } catch (error: any) {
      alert(error.message || '공유 링크 생성 실패');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('링크가 복사되었습니다');
  };

  const handleDownload = () => {
    if (content?.file_url) {
      window.open(content.file_url, '_blank');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-shinhan-darkGray">로딩 중...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-shinhan-darkGray">콘텐츠를 찾을 수 없습니다</p>
        </main>
        <Footer />
      </div>
    );
  }

  const canEdit =
    user?.role === 'ADMIN' ||
    (user?.id === content.uploader_id &&
      content.editable_until &&
      new Date(content.editable_until) > new Date());

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 미리보기 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {content.thumbnail_url ? (
                <div className="relative aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={content.thumbnail_url}
                    alt={content.title}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">미리보기 없음</p>
                </div>
              )}

              <div className="mt-6">
                <h1 className="text-2xl font-bold text-shinhan-darkGray mb-2">
                  {content.title}
                </h1>
                {content.description && (
                  <p className="text-shinhan-darkGray mb-4">{content.description}</p>
                )}

                {/* 태그 */}
                {content.tags && content.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {content.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 text-shinhan-blue rounded-full text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* OCR 텍스트 */}
                {content.ocr_text && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-shinhan-darkGray mb-2">
                      인식된 텍스트 (OCR)
                    </h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {content.ocr_text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 정보 및 액션 */}
          <div className="space-y-6">
            {/* 파일 정보 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="font-bold text-shinhan-darkGray mb-4">파일 정보</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">파일 형식</dt>
                  <dd className="font-medium">{content.file_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">파일 크기</dt>
                  <dd className="font-medium">
                    {(content.file_size / 1024 / 1024).toFixed(2)} MB
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">업로더</dt>
                  <dd className="font-medium">{content.uploader_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">업로드 일시</dt>
                  <dd className="font-medium">
                    {new Date(content.created_at).toLocaleDateString('ko-KR')}
                  </dd>
                </div>
                {content.editable_until && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">수정 가능 기한</dt>
                    <dd className="font-medium text-shinhan-error">
                      {new Date(content.editable_until).toLocaleString('ko-KR')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 액션 버튼 */}
            <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
              <button
                onClick={handleDownload}
                className="w-full px-4 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                다운로드
              </button>
              <button
                onClick={handleBookmark}
                className="w-full px-4 py-2 border border-shinhan-border text-shinhan-darkGray rounded-md hover:bg-gray-50 transition-colors"
              >
                {bookmarked ? '북마크 제거' : '북마크 추가'}
              </button>
              <button
                onClick={handleShare}
                className="w-full px-4 py-2 border border-shinhan-border text-shinhan-darkGray rounded-md hover:bg-gray-50 transition-colors"
              >
                공유 링크 생성
              </button>
              {canEdit && (
                <button
                  onClick={() => router.push(`/contents/${id}/edit`)}
                  className="w-full px-4 py-2 border border-shinhan-blue text-shinhan-blue rounded-md hover:bg-blue-50 transition-colors"
                >
                  수정
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 공유 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-shinhan-darkGray mb-4">공유 링크</h3>
            <p className="text-sm text-gray-600 mb-4">
              이 링크는 7일 후 만료됩니다.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 border border-shinhan-border rounded-md bg-gray-50"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600"
              >
                복사
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
