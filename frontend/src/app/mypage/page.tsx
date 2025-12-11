'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { mypageApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import ContentCard from '@/components/Content/ContentCard';

type TabType = 'bookmarks' | 'uploads';

export default function MyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'bookmarks') {
        loadBookmarks();
      } else {
        loadUploads();
      }
    }
  }, [activeTab, page, isAuthenticated]);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const response = await mypageApi.getBookmarks({ page, pageSize: 20 });
      setBookmarks(response.data?.items || []);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error('북마크 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUploads = async () => {
    setLoading(true);
    try {
      const response = await mypageApi.getUploads({ page, pageSize: 20 });
      setUploads(response.data?.items || []);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error('업로드 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!confirm('북마크를 삭제하시겠습니까?')) return;

    try {
      await mypageApi.deleteBookmark(id);
      loadBookmarks();
    } catch (error: any) {
      alert(error.message || '북마크 삭제 실패');
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const items = activeTab === 'bookmarks' ? bookmarks : uploads;

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-8">
        {/* 사용자 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-shinhan-darkGray mb-4">마이페이지</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">이름</p>
              <p className="font-medium text-shinhan-darkGray">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">이메일</p>
              <p className="font-medium text-shinhan-darkGray">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">역할</p>
              <p className="font-medium text-shinhan-darkGray">
                {user?.role === 'ADMIN'
                  ? '최고관리자'
                  : user?.role === 'HOLDING'
                  ? '신한금융지주'
                  : user?.role === 'BANK'
                  ? '신한은행'
                  : '클라이언트'}
              </p>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-shinhan-border">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab('bookmarks');
                  setPage(1);
                }}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                    : 'text-gray-500 hover:text-shinhan-darkGray'
                }`}
              >
                북마크 ({bookmarks.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('uploads');
                  setPage(1);
                }}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'uploads'
                    ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                    : 'text-gray-500 hover:text-shinhan-darkGray'
                }`}
              >
                내 업로드 ({uploads.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-shinhan-darkGray">로딩 중...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {activeTab === 'bookmarks'
                    ? '북마크한 콘텐츠가 없습니다'
                    : '업로드한 콘텐츠가 없습니다'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((item) => (
                    <div key={item.id} className="relative">
                      <ContentCard
                        id={activeTab === 'bookmarks' ? item.content_id : item.id}
                        title={item.title}
                        thumbnailUrl={item.thumbnail_url}
                        tags={item.tags || []}
                        fileType={item.file_type}
                        createdAt={item.created_at}
                      />
                      {activeTab === 'bookmarks' && (
                        <button
                          onClick={() => handleDeleteBookmark(item.id)}
                          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 text-shinhan-error"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                      {activeTab === 'bookmarks' && item.memo && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-gray-700">
                          <p className="font-medium text-xs text-gray-500 mb-1">메모</p>
                          <p>{item.memo}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <span className="px-4 py-2 text-shinhan-darkGray">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
