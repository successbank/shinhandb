'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardAPI } from '@/lib/api';

interface DashboardStats {
  basic: {
    total_users: string;
    total_contents: string;
    total_categories: string;
    total_tags: string;
    total_bookmarks: string;
  };
  recentUploads: Array<{ date: string; count: string }>;
  fileTypeDistribution: Array<{ file_type: string; count: string; total_size: string }>;
  contentsByRole: Array<{ role: string; count: string }>;
  recentActivities: Array<{
    id: string;
    action_type: string;
    created_at: string;
    ip_address: string;
    user_name: string;
    user_role: string;
  }>;
  popularContents: Array<{
    id: string;
    title: string;
    thumbnail_url: string;
    created_at: string;
    bookmark_count: number;
    uploader_name: string;
  }>;
  storage: {
    used: number;
    usedFormatted: string;
  };
  cache: {
    keys: number;
    memory: string;
    hits: number;
    misses: number;
    hitRate: string;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/contents');
      } else {
        loadDashboardStats();
      }
    }
  }, [user, authLoading, router]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (err: any) {
      console.error('[Dashboard] Error loading stats:', err);
      setError(err.response?.data?.message || '통계 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '데이터를 불러올 수 없습니다'}</p>
          <button
            onClick={loadDashboardStats}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
              <p className="mt-1 text-sm text-gray-600">신한금융 광고관리 플랫폼 통계 및 모니터링</p>
            </div>
            <button
              onClick={loadDashboardStats}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Basic Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="전체 사용자"
            value={stats.basic.total_users}
            icon="👤"
            color="blue"
          />
          <StatCard
            title="전체 콘텐츠"
            value={stats.basic.total_contents}
            icon="📁"
            color="green"
          />
          <StatCard
            title="카테고리"
            value={stats.basic.total_categories}
            icon="📂"
            color="purple"
          />
          <StatCard
            title="태그"
            value={stats.basic.total_tags}
            icon="🏷️"
            color="orange"
          />
          <StatCard
            title="북마크"
            value={stats.basic.total_bookmarks}
            icon="⭐"
            color="yellow"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Uploads */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 7일 업로드</h2>
            <div className="space-y-3">
              {stats.recentUploads.map((upload) => (
                <div key={upload.date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {new Date(upload.date).toLocaleDateString('ko-KR')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 bg-blue-500 rounded"
                      style={{ width: `${parseInt(upload.count) * 10}px` }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">
                      {upload.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* File Type Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">파일 유형별 분포</h2>
            <div className="space-y-3">
              {stats.fileTypeDistribution.map((type) => (
                <div key={type.file_type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{type.file_type}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {formatBytes(parseInt(type.total_size))}
                    </span>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {type.count}개
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Contents by Role */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">회원 유형별 콘텐츠</h2>
            <div className="space-y-3">
              {stats.contentsByRole.map((role) => (
                <div key={role.role} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getRoleLabel(role.role)}</span>
                  <span className="text-sm font-medium text-gray-900">{role.count}개</span>
                </div>
              ))}
            </div>
          </div>

          {/* Storage & Cache */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">시스템 리소스</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">저장 공간 사용량</span>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.storage.usedFormatted}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.storage.used / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Redis 캐시</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">키 개수:</span>
                    <span className="font-medium text-gray-900 ml-2">{stats.cache.keys}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">메모리:</span>
                    <span className="font-medium text-gray-900 ml-2">{stats.cache.memory}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">히트율:</span>
                    <span className="font-medium text-gray-900 ml-2">{stats.cache.hitRate}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">요청:</span>
                    <span className="font-medium text-gray-900 ml-2">
                      {stats.cache.hits + stats.cache.misses}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Contents */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">인기 콘텐츠 (북마크 순)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.popularContents.map((content) => (
              <div
                key={content.id}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/contents?id=${content.id}`)}
              >
                {content.thumbnail_url ? (
                  <img
                    src={`http://211.248.112.67:5648${content.thumbnail_url}`}
                    alt={content.title}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No Image</span>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                    {content.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{content.uploader_name}</span>
                    <span className="flex items-center gap-1">
                      ⭐ {content.bookmark_count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    사용자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    역할
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    활동
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(activity.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {activity.user_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(activity.user_role)}`}>
                        {getRoleLabel(activity.user_role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getActivityLabel(activity.action_type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {activity.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`text-3xl ${colorClasses[color as keyof typeof colorClasses]?.split(' ')[1] || ''}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Helper Functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: '관리자',
    HOLDING: '지주',
    BANK: '은행',
    CLIENT: '클라이언트',
  };
  return labels[role] || role;
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-800',
    HOLDING: 'bg-blue-100 text-blue-800',
    BANK: 'bg-green-100 text-green-800',
    CLIENT: 'bg-yellow-100 text-yellow-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

function getActivityLabel(actionType: string): string {
  const labels: Record<string, string> = {
    LOGIN: '로그인',
    LOGOUT: '로그아웃',
    UPLOAD_CONTENT: '콘텐츠 업로드',
    UPDATE_CONTENT: '콘텐츠 수정',
    DELETE_CONTENT: '콘텐츠 삭제',
    VIEW_CONTENTS: '콘텐츠 목록 조회',
    VIEW_CONTENT_DETAIL: '콘텐츠 상세 조회',
    CREATE_BOOKMARK: '북마크 추가',
    DELETE_BOOKMARK: '북마크 삭제',
    SEARCH_CONTENTS: '콘텐츠 검색',
    VIEW_CATEGORIES: '카테고리 조회',
    CREATE_CATEGORY: '카테고리 생성',
    UPDATE_CATEGORY: '카테고리 수정',
    DELETE_CATEGORY: '카테고리 삭제',
  };
  return labels[actionType] || actionType;
}
