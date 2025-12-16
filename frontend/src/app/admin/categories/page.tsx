'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { categoriesApi } from '@/lib/api';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

interface Category {
  id: string;
  name: string;
  user_role: string;
  parent_id: string | null;
  order: number;
  children?: Category[];
}

type MemberType = 'HOLDING' | 'BANK';

export default function CategoriesManagementPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberType, setSelectedMemberType] = useState<MemberType>('HOLDING');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    memberType: 'HOLDING' as MemberType,
    parentId: '',
    sortOrder: 0,
  });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadCategories();
    }
  }, [isAuthenticated, user]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await categoriesApi.getCategories();
      setCategories(response.data || []);
    } catch (error: any) {
      console.error('카테고리 로드 실패:', error);
      alert(error.message || '카테고리를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('카테고리 이름을 입력해주세요');
      return;
    }

    try {
      await categoriesApi.createCategory({
        name: formData.name.trim(),
        memberType: formData.memberType,
        parentId: formData.parentId || null,
        sortOrder: formData.sortOrder,
      });

      alert('카테고리가 생성되었습니다');
      setShowCreateModal(false);
      setFormData({ name: '', memberType: 'HOLDING', parentId: '', sortOrder: 0 });
      loadCategories();
    } catch (error: any) {
      console.error('카테고리 생성 실패:', error);
      alert(error.message || '카테고리 생성에 실패했습니다');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCategory) return;

    if (!formData.name.trim()) {
      alert('카테고리 이름을 입력해주세요');
      return;
    }

    try {
      await categoriesApi.updateCategory(editingCategory.id, {
        name: formData.name.trim(),
        sortOrder: formData.sortOrder,
      });

      alert('카테고리가 수정되었습니다');
      setShowEditModal(false);
      setEditingCategory(null);
      setFormData({ name: '', memberType: 'HOLDING', parentId: '', sortOrder: 0 });
      loadCategories();
    } catch (error: any) {
      console.error('카테고리 수정 실패:', error);
      alert(error.message || '카테고리 수정에 실패했습니다');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await categoriesApi.deleteCategory(category.id);
      alert('카테고리가 삭제되었습니다');
      loadCategories();
    } catch (error: any) {
      console.error('카테고리 삭제 실패:', error);
      alert(error.message || '카테고리 삭제에 실패했습니다');
    }
  };

  const openCreateModal = (memberType: MemberType, parentId?: string) => {
    setFormData({
      name: '',
      memberType,
      parentId: parentId || '',
      sortOrder: 0,
    });
    setShowCreateModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      memberType: category.user_role as MemberType,
      parentId: category.parent_id || '',
      sortOrder: category.order,
    });
    setShowEditModal(true);
  };

  const filteredCategories = categories.filter(
    (cat) => cat.user_role === selectedMemberType
  );

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
            <h1 className="text-2xl font-bold text-shinhan-darkGray">
              카테고리 관리
            </h1>
            <button
              onClick={() => openCreateModal(selectedMemberType)}
              className="px-6 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              + 1차 카테고리 추가
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-2 mb-6 border-b border-shinhan-border">
            <button
              onClick={() => setSelectedMemberType('HOLDING')}
              className={`px-6 py-3 font-medium transition-colors ${
                selectedMemberType === 'HOLDING'
                  ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                  : 'text-gray-500 hover:text-shinhan-darkGray'
              }`}
            >
              신한금융지주
            </button>
            <button
              onClick={() => setSelectedMemberType('BANK')}
              className={`px-6 py-3 font-medium transition-colors ${
                selectedMemberType === 'BANK'
                  ? 'text-shinhan-blue border-b-2 border-shinhan-blue'
                  : 'text-gray-500 hover:text-shinhan-darkGray'
              }`}
            >
              신한은행
            </button>
          </div>

          {/* 카테고리 목록 */}
          <div className="space-y-4">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                카테고리가 없습니다
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="border border-shinhan-border rounded-lg p-4"
                >
                  {/* 1차 카테고리 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-shinhan-blue"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      <span className="font-semibold text-shinhan-darkGray">
                        {category.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        순서: {category.order}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openCreateModal(selectedMemberType, category.id)}
                        className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded transition-colors"
                      >
                        + 2차 추가
                      </button>
                      <button
                        onClick={() => openEditModal(category)}
                        className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 2차 카테고리 */}
                  {category.children && category.children.length > 0 && (
                    <div className="ml-8 mt-3 space-y-2">
                      {category.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between bg-gray-50 p-3 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-sm text-shinhan-darkGray">
                              {child.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              순서: {child.order}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(child)}
                              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(child)}
                              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-shinhan-darkGray mb-6">
              {formData.parentId ? '2차 카테고리 추가' : '1차 카테고리 추가'}
            </h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  카테고리 이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  placeholder="카테고리 이름 입력"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  순서
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  숫자가 작을수록 먼저 표시됩니다
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  생성
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', memberType: 'HOLDING', parentId: '', sortOrder: 0 });
                  }}
                  className="flex-1 px-6 py-2 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-shinhan-darkGray mb-6">
              카테고리 수정
            </h2>
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  카테고리 이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  placeholder="카테고리 이름 입력"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
                  순서
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  숫자가 작을수록 먼저 표시됩니다
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                    setFormData({ name: '', memberType: 'HOLDING', parentId: '', sortOrder: 0 });
                  }}
                  className="flex-1 px-6 py-2 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
