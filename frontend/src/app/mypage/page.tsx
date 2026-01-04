'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { mypageApi, usersApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import ContentCard from '@/components/Content/ContentCard';

type TabType = 'uploads' | 'activities';
type ActivitySubTab = 'login' | 'view' | 'share' | 'upload';

export default function MyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('activities');
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
      if (activeTab === 'uploads') {
        loadUploads();
      } else if (activeTab === 'activities') {
        loadActivities();
      }
    }
  }, [activeTab, page, isAuthenticated]);

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

  const items = uploads;

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        {/* 사용자 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-6">
            {/* 사용자 아바타 */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${
              user?.role === 'ADMIN'
                ? 'bg-red-100'
                : user?.role === 'HOLDING'
                ? 'bg-blue-100'
                : user?.role === 'BANK'
                ? 'bg-green-100'
                : 'bg-purple-100'
            }`}>
              <svg
                className={`w-10 h-10 ${
                  user?.role === 'ADMIN'
                    ? 'text-red-600'
                    : user?.role === 'HOLDING'
                    ? 'text-blue-600'
                    : user?.role === 'BANK'
                    ? 'text-green-600'
                    : 'text-purple-600'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            {/* 사용자 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-[#333333]">{user?.name}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  user?.role === 'ADMIN'
                    ? 'bg-red-100 text-red-700'
                    : user?.role === 'HOLDING'
                    ? 'bg-blue-100 text-blue-700'
                    : user?.role === 'BANK'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {user?.role === 'ADMIN'
                    ? '최고관리자'
                    : user?.role === 'HOLDING'
                    ? '신한금융지주'
                    : user?.role === 'BANK'
                    ? '신한은행'
                    : '클라이언트'}
                </span>
              </div>
              <p className="text-sm text-gray-500">@{user?.username || 'user'}</p>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-shinhan-border">
            <div className="flex">
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
                            uploaderName={item.uploader_name || user?.name || '알 수 없음'}
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
                    <div className={`grid grid-cols-2 gap-4 mb-6 ${
                      user?.role === 'ADMIN' || user?.role === 'CLIENT'
                        ? 'md:grid-cols-4'
                        : 'md:grid-cols-3'
                    }`}>
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
                      {(user?.role === 'ADMIN' || user?.role === 'CLIENT') && (
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">업로드</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {activityData.summary?.totalUploads || 0}
                          </p>
                        </div>
                      )}
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
                            activityData.loginHistory.map((log: any) => {
                              // 세션 시간 포맷팅 함수
                              const formatDuration = (seconds: number | null) => {
                                if (!seconds) return null;
                                const hours = Math.floor(seconds / 3600);
                                const minutes = Math.floor((seconds % 3600) / 60);
                                const secs = seconds % 60;

                                if (hours > 0) {
                                  return `${hours}시간 ${minutes}분`;
                                } else if (minutes > 0) {
                                  return `${minutes}분 ${secs}초`;
                                } else {
                                  return `${secs}초`;
                                }
                              };

                              return (
                                <div key={log.id} className="border border-shinhan-border rounded-lg p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="text-sm font-medium text-shinhan-darkGray">
                                        로그인: {new Date(log.loginTime).toLocaleString('ko-KR')}
                                      </p>
                                      {log.logoutTime && (
                                        <p className="text-sm text-gray-600 mt-1">
                                          로그아웃: {new Date(log.logoutTime).toLocaleString('ko-KR')}
                                        </p>
                                      )}
                                    </div>
                                    {log.durationSeconds !== null ? (
                                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                        머문 시간: {formatDuration(log.durationSeconds)}
                                      </span>
                                    ) : (
                                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                                        로그아웃 기록 없음
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                                    <span>IP: {log.ipAddress}</span>
                                    <span>기기: {log.device}</span>
                                    <span>OS: {log.os}</span>
                                    <span>브라우저: {log.browser}</span>
                                    <span>위치: {log.location}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* 콘텐츠 확인 기록 */}
                      {activitySubTab === 'view' && (
                        <div className="space-y-3">
                          {!activityData.viewHistory || activityData.viewHistory.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">아직 확인한 프로젝트가 없습니다</p>
                          ) : (
                            activityData.viewHistory.map((log: any) => (
                              <button
                                key={log.id}
                                onClick={() => router.push(`/projects/${log.projectId}`)}
                                className="w-full border border-shinhan-border rounded-lg p-4 flex gap-4 hover:bg-gray-50 transition-colors text-left"
                              >
                                {log.contentThumbnail ? (
                                  <img
                                    src={log.contentThumbnail}
                                    alt={log.contentTitle}
                                    className="w-20 h-20 object-cover rounded flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-shinhan-darkGray truncate">{log.contentTitle}</p>
                                  {log.contentDescription && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{log.contentDescription}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    <p className="text-xs text-gray-600">
                                      {new Date(log.timestamp).toLocaleString('ko-KR')}
                                    </p>
                                    {log.fileCount > 0 && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        {log.fileCount}개 파일
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 self-center">
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </button>
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
