'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FileUpload from '@/components/FileUpload';
import UploadProgress from '@/components/UploadProgress';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';
import { uploadFiles, UploadProgress as UploadProgressType, categoriesApi } from '@/lib/api';

interface UploadState {
  isUploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
}

export default function UploadPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]); // 최대 3개
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: 'idle',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
    }
  }, [isAuthenticated]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  /**
   * 파일 선택 핸들러
   */
  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    // 파일이 선택되면 제목을 첫 번째 파일명으로 자동 설정 (확장자 제외)
    if (files.length > 0 && !title) {
      const firstFileName = files[0].name.replace(/\.[^/.]+$/, '');
      setTitle(firstFileName);
    }
  };

  /**
   * 업로드 핸들러
   */
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('업로드할 파일을 선택해주세요');
      return;
    }

    if (!title.trim()) {
      alert('콘텐츠 제목을 입력해주세요');
      return;
    }

    if (categoryIds.length === 0) {
      alert('최소 1개의 카테고리를 선택해주세요');
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      status: 'uploading',
    });

    try {
      // 태그 파싱 (쉼표 구분)
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await uploadFiles(
        selectedFiles,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
          tags: tagArray.length > 0 ? tagArray : undefined,
        },
        {
          onProgress: (progress: UploadProgressType) => {
            setUploadState((prev) => ({
              ...prev,
              progress: progress.percentage,
            }));
          },
          onSuccess: (data) => {
            setUploadState({
              isUploading: false,
              progress: 100,
              status: 'success',
              result: data,
            });

            // 성공 시 폼 초기화
            setTimeout(() => {
              setSelectedFiles([]);
              setTitle('');
              setDescription('');
              setCategoryIds([]);
              setTags('');
              setUploadState({
                isUploading: false,
                progress: 0,
                status: 'idle',
              });
            }, 3000);
          },
          onError: (error) => {
            setUploadState({
              isUploading: false,
              progress: 0,
              status: 'error',
              error: error.message,
            });
          },
        }
      );
    } catch (error: any) {
      setUploadState({
        isUploading: false,
        progress: 0,
        status: 'error',
        error: error.message || '업로드 중 오류가 발생했습니다',
      });
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  // 선택된 카테고리 이름들 가져오기
  const getSelectedCategoryNames = (): string[] => {
    if (categoryIds.length === 0) return [];

    const findCategory = (cats: any[], id: string): string | null => {
      for (const cat of cats) {
        if (cat.id === id) return cat.name;
        if (cat.children) {
          const found = findCategory(cat.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    return categoryIds
      .map((id) => findCategory(categories, id))
      .filter((name): name is string => name !== null);
  };

  // 카테고리 제거 핸들러
  const removeCategoryId = (id: string) => {
    setCategoryIds(categoryIds.filter((catId) => catId !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1920px] mx-auto flex">
          {/* 왼쪽 사이드바 - 카테고리 트리 (다중 선택, 최대 3개) */}
          <CategoryTreeSidebar
            categories={categories}
            selectedCategoryIds={categoryIds}
            onCategorySelect={setCategoryIds}
            userRole={user?.role === 'ADMIN' ? undefined : user?.role}
            maxSelection={3}
          />

          {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-12">
              {/* 헤더 */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-shinhan-darkGray">콘텐츠 업로드</h1>
                <p className="mt-2 text-gray-600">
                  신한금융 광고 자료를 업로드하고 관리하세요
                </p>
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">
                      선택된 카테고리 <span className="text-[#E53935]">*</span>:
                    </span>
                    <span className="text-xs text-gray-500">
                      ({categoryIds.length}/3)
                    </span>
                  </div>
                  {categoryIds.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {getSelectedCategoryNames().map((name, index) => (
                        <span
                          key={categoryIds[index]}
                          className="inline-flex items-center px-3 py-1 bg-shinhan-blue text-white text-sm rounded-full"
                        >
                          {name}
                          <button
                            onClick={() => removeCategoryId(categoryIds[index])}
                            className="ml-2 hover:text-red-200 transition-colors"
                            title="제거"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={() => setCategoryIds([])}
                        className="text-xs text-gray-500 hover:text-red-600 underline"
                      >
                        모두 해제
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-red-600 italic">
                      왼쪽 카테고리 트리에서 최소 1개의 카테고리를 선택해주세요 (최대 3개)
                    </p>
                  )}
                </div>
              </div>

              {/* 업로드 폼 */}
              <div className="bg-white rounded-lg shadow-md p-8">
                {/* 파일 업로드 영역 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    파일 선택 <span className="text-[#E53935]">*</span>
                  </label>
                  <FileUpload onFilesSelected={handleFilesSelected} />
                </div>

                {/* 제목 입력 */}
                <div className="mb-6">
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-[#333333] mb-2"
                  >
                    콘텐츠 제목 <span className="text-[#E53935]">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 신한금융 2024 브랜드 캠페인"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                    disabled={uploadState.isUploading}
                  />
                </div>

                {/* 설명 입력 */}
                <div className="mb-6">
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-[#333333] mb-2"
                  >
                    설명 (선택)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="콘텐츠에 대한 설명을 입력하세요"
                    rows={4}
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                    disabled={uploadState.isUploading}
                  />
                </div>

                {/* 태그 입력 */}
                <div className="mb-6">
                  <label
                    htmlFor="tags"
                    className="block text-sm font-medium text-[#333333] mb-2"
                  >
                    태그 (선택)
                  </label>
                  <input
                    id="tags"
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="태그를 쉼표로 구분하여 입력 (예: 브랜드, 캠페인, 2024)"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                    disabled={uploadState.isUploading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    쉼표(,)로 태그를 구분하세요
                  </p>
                </div>

                {/* 업로드 진행률 */}
                {uploadState.status !== 'idle' && (
                  <div className="mb-6">
                    <UploadProgress
                      percentage={uploadState.progress}
                      fileName={
                        selectedFiles.length > 0
                          ? `${selectedFiles.length}개 파일 업로드 중...`
                          : undefined
                      }
                      status={uploadState.status as 'uploading' | 'success' | 'error'}
                      error={uploadState.error}
                    />
                  </div>
                )}

                {/* 업로드 버튼 */}
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => {
                      setSelectedFiles([]);
                      setTitle('');
                      setDescription('');
                      setCategoryIds([]);
                      setTags('');
                    }}
                    disabled={uploadState.isUploading}
                    className="px-6 py-2 border border-[#E0E0E0] text-[#333333] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    초기화
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={
                      uploadState.isUploading ||
                      selectedFiles.length === 0 ||
                      !title.trim() ||
                      categoryIds.length === 0
                    }
                    className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadState.isUploading ? '업로드 중...' : '업로드'}
                  </button>
                </div>

                {/* 성공 메시지 */}
                {uploadState.status === 'success' && uploadState.result && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-medium text-shinhan-success mb-2">
                      업로드 성공!
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                      {uploadState.result.message || '파일이 성공적으로 업로드되었습니다'}
                    </p>

                    {/* 생성된 태그 정보 표시 */}
                    {uploadState.result.data && Array.isArray(uploadState.result.data) && (
                      <div className="mt-4 space-y-4">
                        {uploadState.result.data.map((content: any, index: number) => (
                          <div key={content.id} className="bg-white p-3 rounded border border-green-300">
                            <div className="flex items-start gap-3">
                              {/* 썸네일 */}
                              {content.thumbnailUrl && (
                                <img
                                  src={content.thumbnailUrl}
                                  alt={content.title}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}

                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {content.title}
                                </p>

                                {/* AI 생성 태그 */}
                                {content.generatedTags && content.generatedTags.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-gray-600 mb-1">
                                      🤖 AI가 생성한 태그:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {content.generatedTags.map((tag: string, tagIndex: number) => (
                                        <span
                                          key={tagIndex}
                                          className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* 전체 태그 */}
                                {content.allTags && content.allTags.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">
                                      전체 태그 ({content.allTags.length}개):
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {content.allTags.map((tag: string, tagIndex: number) => (
                                        <span
                                          key={tagIndex}
                                          className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* OCR 텍스트 미리보기 */}
                                {content.ocrText && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                      추출된 텍스트 보기
                                    </summary>
                                    <p className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                                      {content.ocrText.substring(0, 200)}
                                      {content.ocrText.length > 200 && '...'}
                                    </p>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
