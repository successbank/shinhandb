'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logsApi, usersApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action_type: string;
  ip_address: string;
  details: any;
  created_at: string;
}

interface LogFilters {
  userId: string;
  actionType: string;
  startDate: string;
  endDate: string;
}

export default function LogsClient() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // 필터 상태
  const [filters, setFilters] = useState<LogFilters>({
    userId: '',
    actionType: '',
    startDate: '',
    endDate: '',
  });

  // 사용자 목록 (필터용)
  const [users, setUsers] = useState<any[]>([]);

  // 액션 타입 목록
  const actionTypes = [
    { value: '', label: '전체 액션' },
    { value: 'LOGIN', label: '로그인' },
    { value: 'LOGIN_ATTEMPT', label: '로그인 시도' },
    { value: 'LOGOUT', label: '로그아웃' },
    { value: 'VIEW_CONTENT', label: '콘텐츠 조회' },
    { value: 'VIEW_CONTENTS', label: '콘텐츠 목록 조회' },
    { value: 'UPLOAD_CONTENT', label: '콘텐츠 업로드' },
    { value: 'UPDATE_CONTENT', label: '콘텐츠 수정' },
    { value: 'DELETE_CONTENT', label: '콘텐츠 삭제' },
    { value: 'CREATE_USER', label: '사용자 생성' },
    { value: 'UPDATE_USER', label: '사용자 수정' },
    { value: 'DELETE_USER', label: '사용자 삭제' },
    { value: 'VIEW_USER_ACTIVITIES', label: '사용자 활동 조회' },
  ];

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadUsers();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadLogs();
    }
  }, [page, pageSize, isAuthenticated, user]);

  const loadUsers = async () => {
    try {
      const response = await usersApi.getUsers({ pageSize: 1000 });
      setUsers(response.data?.items || []);
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (filters.userId) params.userId = filters.userId;
      if (filters.actionType) params.actionType = filters.actionType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await logsApi.getLogs(params);
      setLogs(response.data?.items || []);
      setTotal(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error: any) {
      console.error('로그 로드 실패:', error);
      alert(error.message || '로그를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleResetFilters = () => {
    setFilters({
      userId: '',
      actionType: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionTypeLabel = (actionType: string) => {
    const action = actionTypes.find((at) => at.value === actionType);
    return action?.label || actionType;
  };

  const exportToExcel = () => {
    // CSV 형식으로 내보내기 (Excel에서 열 수 있음)
    const headers = ['시간', '사용자', '이메일', '액션', 'IP 주소', '상세 정보'];
    const rows = logs.map((log) => [
      formatDate(log.created_at),
      log.user_name || '알 수 없음',
      log.user_email || '-',
      getActionTypeLabel(log.action_type),
      log.ip_address || '-',
      log.details ? JSON.stringify(log.details) : '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('로그가 CSV 파일로 내보내졌습니다');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        로딩 중...
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* 헤더 */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-shinhan-darkGray">활동 로그</h1>
            <button
              onClick={exportToExcel}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSV 내보내기
            </button>
          </div>

          {/* 필터 */}
          <form onSubmit={handleFilterSubmit} className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  사용자
                </label>
                <select
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                >
                  <option value="">전체 사용자</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  액션 타입
                </label>
                <select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                >
                  {actionTypes.map((at) => (
                    <option key={at.value} value={at.value}>
                      {at.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  시작 날짜
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  종료 날짜
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                필터 적용
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-6 py-2 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors"
              >
                초기화
              </button>
            </div>
          </form>

          {/* 통계 */}
          <div className="mb-4 flex justify-between items-center">
            <p className="text-shinhan-darkGray">
              총 <span className="font-bold text-shinhan-blue">{total.toLocaleString()}</span>개의 로그
            </p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-shinhan-darkGray">페이지당 표시:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-1 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>

          {/* 로그 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-shinhan-darkGray uppercase tracking-wider">
                    시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-shinhan-darkGray uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-shinhan-darkGray uppercase tracking-wider">
                    액션
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-shinhan-darkGray uppercase tracking-wider">
                    IP 주소
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-shinhan-darkGray uppercase tracking-wider">
                    상세 정보
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-shinhan-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      로그가 없습니다
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-shinhan-darkGray whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-shinhan-darkGray">
                        <div>{log.user_name || '알 수 없음'}</div>
                        <div className="text-xs text-gray-500">{log.user_email || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.action_type.includes('LOGIN')
                              ? 'bg-blue-100 text-blue-800'
                              : log.action_type.includes('DELETE')
                              ? 'bg-red-100 text-red-800'
                              : log.action_type.includes('CREATE')
                              ? 'bg-green-100 text-green-800'
                              : log.action_type.includes('UPDATE')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getActionTypeLabel(log.action_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-shinhan-darkGray font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-shinhan-blue hover:underline">
                              상세 보기
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
