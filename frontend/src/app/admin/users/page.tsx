'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type CreateUserForm = {
  email: string;
  name: string;
  password: string;
  role: 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';
  sendEmail: boolean;
};

type EditUserForm = {
  name: string;
  email: string;
  role: 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';
};

type ActivityData = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  loginHistory: Array<{
    id: string;
    timestamp: string;
    ipAddress: string;
    device: string;
    os: string;
    browser: string;
    location: string;
  }>;
  viewHistory: Array<{
    id: string;
    timestamp: string;
    contentId: string;
    contentTitle: string;
    contentThumbnail: string;
    contentType: string;
  }>;
  sharedContent: Array<{
    id: string;
    contentId: string;
    contentTitle: string;
    contentThumbnail: string;
    contentType: string;
    shareToken: string;
    expiresAt: string;
    createdAt: string;
    shareUrl: string;
  }>;
  uploadedContent: Array<{
    id: string;
    title: string;
    description: string;
    fileType: string;
    fileSize: number;
    thumbnailUrl: string;
    categoryId: string;
    tags: string[];
    ocrText: string;
    editableUntil: string;
    createdAt: string;
    updatedAt: string;
    contentUrl: string;
  }>;
  summary: {
    totalLogins: number;
    totalViews: number;
    totalShares: number;
    totalUploads: number;
  };
};

type ActivityTab = 'login' | 'view' | 'share' | 'upload';

export default function UsersPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [activityTab, setActivityTab] = useState<ActivityTab>('login');
  const [loadingActivity, setLoadingActivity] = useState(false);

  // 폼 상태
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    name: '',
    password: '',
    role: 'CLIENT',
    sendEmail: true,
  });

  const [editForm, setEditForm] = useState<EditUserForm>({
    name: '',
    email: '',
    role: 'CLIENT',
  });

  // 권한 체크
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  // 사용자 목록 로드
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadUsers();
    }
  }, [page, search, roleFilter, isAuthenticated, user]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;

      const response = await usersApi.getUsers(params);
      setUsers(response.data?.items || []);
      setTotal(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error: any) {
      alert(error.message || '사용자 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.name) {
      alert('이메일과 이름을 입력해주세요');
      return;
    }

    try {
      await usersApi.createUser(createForm);
      alert('사용자가 생성되었습니다');
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        name: '',
        password: '',
        role: 'CLIENT',
        sendEmail: true,
      });
      loadUsers();
    } catch (error: any) {
      alert(error.message || '사용자 생성 실패');
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await usersApi.updateUser(selectedUser.id, editForm);
      alert('사용자 정보가 수정되었습니다');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      alert(error.message || '사용자 수정 실패');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('이 사용자를 비활성화하시겠습니까?')) return;

    try {
      await usersApi.deleteUser(userId);
      alert('사용자가 비활성화되었습니다');
      loadUsers();
    } catch (error: any) {
      alert(error.message || '사용자 비활성화 실패');
    }
  };

  const handleActivateUser = async (userId: string) => {
    if (!confirm('이 사용자를 활성화하시겠습니까?')) return;

    try {
      await usersApi.activateUser(userId);
      alert('사용자가 활성화되었습니다');
      loadUsers();
    } catch (error: any) {
      alert(error.message || '사용자 활성화 실패');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('이 사용자의 비밀번호를 초기화하시겠습니까? 새 비밀번호가 이메일로 발송됩니다.')) return;

    try {
      await usersApi.resetPassword(userId, true);
      alert('비밀번호가 초기화되었습니다');
    } catch (error: any) {
      alert(error.message || '비밀번호 초기화 실패');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setShowEditModal(true);
  };

  const openActivityModal = async (user: User) => {
    setSelectedUser(user);
    setShowActivityModal(true);
    setActivityTab('login');
    setLoadingActivity(true);

    try {
      const response = await usersApi.getUserActivities(user.id);
      setActivityData(response.data);
    } catch (error: any) {
      alert(error.message || '활동 내역 조회 실패');
      setShowActivityModal(false);
    } finally {
      setLoadingActivity(false);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '최고관리자';
      case 'HOLDING':
        return '신한금융지주';
      case 'BANK':
        return '신한은행';
      case 'CLIENT':
        return '클라이언트';
      default:
        return role;
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

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-shinhan-darkGray">회원 관리</h1>
          <p className="mt-2 text-gray-600">
            플랫폼 사용자를 생성하고 관리합니다
          </p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="이름 또는 이메일 검색"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
              >
                <option value="">전체 역할</option>
                <option value="ADMIN">최고관리자</option>
                <option value="HOLDING">신한금융지주</option>
                <option value="BANK">신한은행</option>
                <option value="CLIENT">클라이언트</option>
              </select>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-shinhan-blue text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              + 사용자 생성
            </button>
          </div>
        </div>

        {/* 사용자 목록 테이블 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-600">로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-500">사용자가 없습니다</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-shinhan-border">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-shinhan-darkGray">이름</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-shinhan-darkGray">이메일</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-shinhan-darkGray">역할</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-shinhan-darkGray">상태</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-shinhan-darkGray">생성일</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-shinhan-darkGray">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-shinhan-border">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-shinhan-darkGray">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getRoleName(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {user.isActive ? (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              활성
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              onClick={() => openActivityModal(user)}
                              className="px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition-colors"
                            >
                              활동
                            </button>
                            <button
                              onClick={() => openEditModal(user)}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-shinhan-darkGray rounded transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="px-3 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded transition-colors"
                            >
                              비밀번호 초기화
                            </button>
                            {user.isActive ? (
                              <button
                                onClick={() => handleDeactivateUser(user.id)}
                                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-shinhan-error rounded transition-colors"
                              >
                                비활성화
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateUser(user.id)}
                                className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-shinhan-success rounded transition-colors"
                              >
                                활성화
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-shinhan-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      총 {total}명 ({page} / {totalPages} 페이지)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 border border-shinhan-border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* 사용자 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-shinhan-darkGray mb-6">사용자 생성</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  이름 <span className="text-shinhan-error">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  이메일 <span className="text-shinhan-error">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  비밀번호 (선택)
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  placeholder="비워두면 자동 생성됩니다"
                />
                <p className="mt-1 text-xs text-gray-500">
                  비밀번호를 입력하지 않으면 자동으로 생성되어 이메일로 발송됩니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  역할 <span className="text-shinhan-error">*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, role: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                >
                  <option value="CLIENT">클라이언트</option>
                  <option value="BANK">신한은행</option>
                  <option value="HOLDING">신한금융지주</option>
                  <option value="ADMIN">최고관리자</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={createForm.sendEmail}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, sendEmail: e.target.checked })
                  }
                  className="w-4 h-4 text-shinhan-blue"
                />
                <label htmlFor="sendEmail" className="text-sm text-gray-600">
                  비밀번호를 이메일로 발송
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-shinhan-border text-shinhan-darkGray rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-shinhan-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 수정 모달 */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-shinhan-darkGray mb-6">사용자 정보 수정</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  이름 <span className="text-shinhan-error">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  이메일 <span className="text-shinhan-error">*</span>
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  역할 <span className="text-shinhan-error">*</span>
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-lg focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                >
                  <option value="CLIENT">클라이언트</option>
                  <option value="BANK">신한은행</option>
                  <option value="HOLDING">신한금융지주</option>
                  <option value="ADMIN">최고관리자</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-shinhan-border text-shinhan-darkGray rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEditUser}
                className="flex-1 px-4 py-2 bg-shinhan-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 활동 내역 모달 */}
      {showActivityModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-6xl w-full my-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-shinhan-darkGray">
                  {selectedUser.name}님의 활동 내역
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedUser.email} ({getRoleName(selectedUser.role)})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedUser(null);
                  setActivityData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingActivity ? (
              <div className="py-12 text-center text-gray-600">로딩 중...</div>
            ) : activityData ? (
              <>
                {/* 요약 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">총 접속</p>
                    <p className="text-2xl font-bold text-shinhan-blue">{activityData.summary.totalLogins}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">콘텐츠 확인</p>
                    <p className="text-2xl font-bold text-green-600">{activityData.summary.totalViews}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">공유</p>
                    <p className="text-2xl font-bold text-purple-600">{activityData.summary.totalShares}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">업로드</p>
                    <p className="text-2xl font-bold text-yellow-600">{activityData.summary.totalUploads}</p>
                  </div>
                </div>

                {/* 탭 네비게이션 */}
                <div className="border-b border-shinhan-border mb-6">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActivityTab('login')}
                      className={`px-4 py-3 font-medium transition-colors ${
                        activityTab === 'login'
                          ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                          : 'text-gray-500 hover:text-shinhan-darkGray'
                      }`}
                    >
                      접속 기록 ({activityData.loginHistory.length})
                    </button>
                    <button
                      onClick={() => setActivityTab('view')}
                      className={`px-4 py-3 font-medium transition-colors ${
                        activityTab === 'view'
                          ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                          : 'text-gray-500 hover:text-shinhan-darkGray'
                      }`}
                    >
                      콘텐츠 확인 ({activityData.viewHistory.length})
                    </button>
                    <button
                      onClick={() => setActivityTab('share')}
                      className={`px-4 py-3 font-medium transition-colors ${
                        activityTab === 'share'
                          ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                          : 'text-gray-500 hover:text-shinhan-darkGray'
                      }`}
                    >
                      공유한 콘텐츠 ({activityData.sharedContent.length})
                    </button>
                    {selectedUser.role === 'CLIENT' && (
                      <button
                        onClick={() => setActivityTab('upload')}
                        className={`px-4 py-3 font-medium transition-colors ${
                          activityTab === 'upload'
                            ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                            : 'text-gray-500 hover:text-shinhan-darkGray'
                        }`}
                      >
                        업로드 ({activityData.uploadedContent.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* 탭 컨텐츠 */}
                <div className="max-h-96 overflow-y-auto">
                  {/* 접속 기록 */}
                  {activityTab === 'login' && (
                    <div className="space-y-3">
                      {activityData.loginHistory.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">접속 기록이 없습니다</p>
                      ) : (
                        activityData.loginHistory.map((log) => (
                          <div key={log.id} className="border border-shinhan-border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
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
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 콘텐츠 확인 기록 */}
                  {activityTab === 'view' && (
                    <div className="space-y-3">
                      {activityData.viewHistory.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">확인한 콘텐츠가 없습니다</p>
                      ) : (
                        activityData.viewHistory.map((log) => (
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
                  {activityTab === 'share' && (
                    <div className="space-y-3">
                      {activityData.sharedContent.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">공유한 콘텐츠가 없습니다</p>
                      ) : (
                        activityData.sharedContent.map((share) => (
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
                  {activityTab === 'upload' && selectedUser.role === 'CLIENT' && (
                    <div className="space-y-3">
                      {activityData.uploadedContent.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">업로드한 콘텐츠가 없습니다</p>
                      ) : (
                        activityData.uploadedContent.map((content) => (
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
                                  {content.tags.map((tag, idx) => (
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
              <div className="py-12 text-center text-gray-500">활동 내역을 불러오지 못했습니다</div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedUser(null);
                  setActivityData(null);
                }}
                className="px-6 py-2 bg-gray-100 text-shinhan-darkGray rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
