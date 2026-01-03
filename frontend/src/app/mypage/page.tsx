'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { mypageApi, usersApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import ContentCard from '@/components/Content/ContentCard';

type TabType = 'bookmarks' | 'uploads' | 'activities';
type ActivitySubTab = 'login' | 'view' | 'share' | 'upload';

export default function MyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 활동 내역 상태
  const [activityData, setActivityData] = useState<any | null>(null);
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>('login');
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'bookmarks') {
        loadBookmarks();
      } else if (activeTab === 'uploads') {
        loadUploads();
      } else if (activeTab === 'activities') {
        loadActivities();
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

  const loadActivities = async () => {
    if (!user?.id) return;

    setLoadingActivity(true);
    try {
      const response = await usersApi.getUserActivities(user.id);
      setActivityData(response.data);
    } catch (error: any) {
      console.error('활동 내역 로드 실패:', error);
      alert(error.message || '활동 내역을 불러올 수 없습니다');
    } finally {
      setLoadingActivity(false);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
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
              {(user?.role === 'ADMIN' || user?.role === 'CLIENT') && (
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
              )}
              <button
                onClick={() => {
                  setActiveTab('activities');
                  setPage(1);
                }}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'activities'
                    ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                    : 'text-gray-500 hover:text-shinhan-darkGray'
                }`}
              >
                내 활동 내역
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* 북마크 탭 */}
            {activeTab === 'bookmarks' && (
              <>
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-shinhan-darkGray">로딩 중...</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">북마크한 콘텐츠가 없습니다</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {items.map((item) => (
                        <div key={item.id} className="relative">
                          <ContentCard
                            id={item.content_id}
                            title={item.title}
                            thumbnailUrl={item.thumbnail_url}
                            tags={item.tags || []}
                            fileType={item.file_type}
                            createdAt={item.created_at}
                          />
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
                          {item.memo && (
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
              </>
            )}

            {/* 업로드 탭 */}
            {activeTab === 'uploads' && (
              <>
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-shinhan-darkGray">로딩 중...</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">업로드한 콘텐츠가 없습니다</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {items.map((item) => (
                        <div key={item.id} className="relative">
                          <ContentCard
                            id={item.id}
                            title={item.title}
                            thumbnailUrl={item.thumbnail_url}
                            tags={item.tags || []}
                            fileType={item.file_type}
                            createdAt={item.created_at}
                          />
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
              </>
            )}

            {/* 활동 내역 탭 */}
            {activeTab === 'activities' && (
              <>
                {loadingActivity ? (
                  <div className="text-center py-12">
                    <p className="text-shinhan-darkGray">로딩 중...</p>
                  </div>
                ) : activityData ? (
                  <>
                    {/* 요약 통계 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">총 접속</p>
                        <p className="text-2xl font-bold text-shinhan-blue">
                          {activityData.summary?.totalLogins || 0}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">콘텐츠 확인</p>
                        <p className="text-2xl font-bold text-green-600">
                          {activityData.summary?.totalViews || 0}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">공유</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {activityData.summary?.totalShares || 0}
                        </p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">업로드</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {activityData.summary?.totalUploads || 0}
                        </p>
                      </div>
                    </div>

                    {/* 서브 탭 */}
                    <div className="border-b border-shinhan-border mb-6">
                      <div className="flex gap-4">
                        <button
                          onClick={() => setActivitySubTab('login')}
                          className={`px-4 py-3 font-medium transition-colors ${
                            activitySubTab === 'login'
                              ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                              : 'text-gray-500 hover:text-shinhan-darkGray'
                          }`}
                        >
                          접속 기록 ({activityData.loginHistory?.length || 0})
                        </button>
                        <button
                          onClick={() => setActivitySubTab('view')}
                          className={`px-4 py-3 font-medium transition-colors ${
                            activitySubTab === 'view'
                              ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                              : 'text-gray-500 hover:text-shinhan-darkGray'
                          }`}
                        >
                          콘텐츠 확인 ({activityData.viewHistory?.length || 0})
                        </button>
                        <button
                          onClick={() => setActivitySubTab('share')}
                          className={`px-4 py-3 font-medium transition-colors ${
                            activitySubTab === 'share'
                              ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                              : 'text-gray-500 hover:text-shinhan-darkGray'
                          }`}
                        >
                          공유한 콘텐츠 ({activityData.sharedContent?.length || 0})
                        </button>
                        {user?.role === 'CLIENT' && (
                          <button
                            onClick={() => setActivitySubTab('upload')}
                            className={`px-4 py-3 font-medium transition-colors ${
                              activitySubTab === 'upload'
                                ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                                : 'text-gray-500 hover:text-shinhan-darkGray'
                            }`}
                          >
                            업로드 ({activityData.uploadedContent?.length || 0})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 서브 탭 컨텐츠 */}
                    <div className="max-h-96 overflow-y-auto">
                      {/* 접속 기록 */}
                      {activitySubTab === 'login' && (
                        <div className="space-y-3">
                          {!activityData.loginHistory || activityData.loginHistory.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">접속 기록이 없습니다</p>
                          ) : (
                            activityData.loginHistory.map((log: any) => (
                              <div key={log.id} className="border border-shinhan-border rounded-lg p-4">
                                <p className="text-sm font-medium text-shinhan-darkGray">
                                  {new Date(log.timestamp).toLocaleString('ko-KR')}
                                </p>
                                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                                  <span>IP: {log.ipAddress}</span>
                                  <span>기기: {log.device}</span>
                                  <span>OS: {log.os}</span>
                                  <span>브라우저: {log.browser}</span>
                                  <span>위치: {log.location}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 콘텐츠 확인 기록 */}
                      {activitySubTab === 'view' && (
                        <div className="space-y-3">
                          {!activityData.viewHistory || activityData.viewHistory.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">확인한 콘텐츠가 없습니다</p>
                          ) : (
                            activityData.viewHistory.map((log: any) => (
                              <div key={log.id} className="border border-shinhan-border rounded-lg p-4 flex gap-4">
                                {log.contentThumbnail && (
                                  <img
                                    src={log.contentThumbnail}
                                    alt={log.contentTitle}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-shinhan-darkGray">{log.contentTitle}</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {new Date(log.timestamp).toLocaleString('ko-KR')}
                                  </p>
                                  <span className="text-xs text-gray-500">유형: {log.contentType}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 공유한 콘텐츠 */}
                      {activitySubTab === 'share' && (
                        <div className="space-y-3">
                          {!activityData.sharedContent || activityData.sharedContent.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">공유한 콘텐츠가 없습니다</p>
                          ) : (
                            activityData.sharedContent.map((share: any) => (
                              <div key={share.id} className="border border-shinhan-border rounded-lg p-4 flex gap-4">
                                {share.contentThumbnail && (
                                  <img
                                    src={share.contentThumbnail}
                                    alt={share.contentTitle}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-shinhan-darkGray">{share.contentTitle}</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    생성: {new Date(share.createdAt).toLocaleString('ko-KR')}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    만료: {new Date(share.expiresAt).toLocaleString('ko-KR')}
                                  </p>
                                  <a
                                    href={share.shareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-shinhan-blue hover:underline mt-1 inline-block"
                                  >
                                    공유 링크 열기 →
                                  </a>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 업로드한 콘텐츠 */}
                      {activitySubTab === 'upload' && user?.role === 'CLIENT' && (
                        <div className="space-y-3">
                          {!activityData.uploadedContent || activityData.uploadedContent.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">업로드한 콘텐츠가 없습니다</p>
                          ) : (
                            activityData.uploadedContent.map((content: any) => (
                              <div key={content.id} className="border border-shinhan-border rounded-lg p-4 flex gap-4">
                                {content.thumbnailUrl && (
                                  <img
                                    src={content.thumbnailUrl}
                                    alt={content.title}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-shinhan-darkGray">{content.title}</p>
                                  {content.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{content.description}</p>
                                  )}
                                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                                    <span>유형: {content.fileType}</span>
                                    <span>크기: {formatFileSize(content.fileSize)}</span>
                                    <span>업로드: {new Date(content.createdAt).toLocaleString('ko-KR')}</span>
                                  </div>
                                  {content.tags && content.tags.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                      {content.tags.map((tag: string, idx: number) => (
                                        <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <a
                                    href={content.contentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-shinhan-blue hover:underline mt-2 inline-block"
                                  >
                                    콘텐츠 보기 →
                                  </a>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">활동 내역을 불러오지 못했습니다</p>
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
