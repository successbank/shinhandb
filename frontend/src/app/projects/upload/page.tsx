'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';
import FileTypeSelector from '@/components/FileTypeSelector';
import UploadProgress from '@/components/UploadProgress';
import { projectsApi, categoriesApi, previewTags, UploadProgress as UploadProgressType } from '@/lib/api';
import { formatFileSize, getFileIcon } from '@/lib/fileUtils';

interface FileMeta {
  fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function ProjectUploadPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  // 단계 관리 (1: 프로젝트 정보, 2: 파일 업로드)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: 프로젝트 정보
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>('');

  // Step 2: 파일 정보
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileMeta, setFileMeta] = useState<FileMeta[]>([]);
  const [tags, setTags] = useState('');
  const [generatingTags, setGeneratingTags] = useState(false);
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);

  // 업로드 상태
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
   * Step 1: 프로젝트 생성
   */
  const handleCreateProject = async () => {
    if (!projectTitle.trim()) {
      alert('프로젝트 제목을 입력해주세요');
      return;
    }

    if (categoryIds.length === 0) {
      alert('최소 1개의 카테고리를 선택해주세요');
      return;
    }

    try {
      const response = await projectsApi.create({
        title: projectTitle.trim(),
        description: projectDescription.trim() || undefined,
        categoryIds,
      });

      if (response.success && response.data) {
        setProjectId(response.data.id);
        setStep(2);
      }
    } catch (error: any) {
      alert(error.message || '프로젝트 생성 실패');
    }
  };

  /**
   * Step 2: 파일 선택 핸들러
   */
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 최대 10개 제한
    if (fileArray.length > 10) {
      alert('최대 10개의 파일만 업로드 가능합니다');
      return;
    }

    setSelectedFiles(fileArray);

    // 각 파일에 대한 메타데이터 초기화 (기본값: 제안 시안)
    const initialMeta: FileMeta[] = fileArray.map(() => ({
      fileTypeFlag: 'PROPOSAL_DRAFT',
    }));
    setFileMeta(initialMeta);

    // 이미지 파일 AI 태그 자동 생성
    const imageFiles = fileArray.filter((file) => {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.gif');
    });

    if (imageFiles.length > 0) {
      setGeneratingTags(true);
      setGeneratedTags([]);

      try {
        const response = await previewTags(imageFiles);

        if (response.success && response.data.length > 0) {
          const allTags: string[] = [];

          response.data.forEach((preview: any) => {
            if (preview.tags && preview.tags.length > 0) {
              allTags.push(...preview.tags);
            }
          });

          const uniqueTags = [...new Set(allTags)];
          setGeneratedTags(uniqueTags);
          setTags(uniqueTags.join(', '));
        }
      } catch (error: any) {
        console.error('[Tag Generation] Failed:', error.message);
      } finally {
        setGeneratingTags(false);
      }
    }
  };

  /**
   * 파일 타입 변경
   */
  const handleFileTypeChange = (index: number, fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') => {
    const newFileMeta = [...fileMeta];
    newFileMeta[index] = { fileTypeFlag };
    setFileMeta(newFileMeta);
  };

  /**
   * 파일 제거
   */
  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newMeta = fileMeta.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setFileMeta(newMeta);
  };

  /**
   * Step 2: 파일 업로드
   */
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('업로드할 파일을 선택해주세요');
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      status: 'uploading',
    });

    try {
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await projectsApi.uploadFiles(
        projectId,
        selectedFiles,
        fileMeta,
        tagArray.length > 0 ? tagArray : undefined,
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
            });

            // 성공 시 프로젝트 상세 페이지로 이동
            setTimeout(() => {
              router.push(`/projects/${projectId}`);
            }, 2000);
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

  return (
    <div className="min-h-screen flex flex-col bg-shinhan-lightGray">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto flex">
          {/* Step 1에서만 카테고리 사이드바 표시 */}
          {step === 1 && (
            <CategoryTreeSidebar
              categories={categories}
              selectedCategoryIds={categoryIds}
              onCategorySelect={setCategoryIds}
              userRole={user?.role === 'ADMIN' ? undefined : user?.role}
              maxSelection={3}
            />
          )}

          {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-8">
              {/* 진행 표시기 */}
              <div className="mb-8 flex items-center justify-center">
                <div className="flex items-center">
                  {/* Step 1 */}
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        step === 1
                          ? 'bg-[#0046FF] text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      1
                    </div>
                    <span className={`ml-2 font-medium ${step === 1 ? 'text-[#0046FF]' : 'text-gray-500'}`}>
                      프로젝트 정보
                    </span>
                  </div>

                  {/* 연결선 */}
                  <div className="w-20 h-1 mx-4 bg-gray-300"></div>

                  {/* Step 2 */}
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        step === 2
                          ? 'bg-[#0046FF] text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      2
                    </div>
                    <span className={`ml-2 font-medium ${step === 2 ? 'text-[#0046FF]' : 'text-gray-500'}`}>
                      파일 업로드
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 1: 프로젝트 정보 입력 */}
              {step === 1 && (
                <div className="bg-white rounded-lg shadow-md p-8">
                  <h1 className="text-3xl font-bold text-shinhan-darkGray mb-6">
                    새 프로젝트 생성
                  </h1>

                  {/* 제목 */}
                  <div className="mb-6">
                    <label
                      htmlFor="projectTitle"
                      className="block text-sm font-medium text-[#333333] mb-2"
                    >
                      프로젝트 제목 <span className="text-[#E53935]">*</span>
                    </label>
                    <input
                      id="projectTitle"
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="예: 신한카드 2024 브랜드 캠페인"
                      className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF] text-gray-900"
                    />
                  </div>

                  {/* 설명 */}
                  <div className="mb-6">
                    <label
                      htmlFor="projectDescription"
                      className="block text-sm font-medium text-[#333333] mb-2"
                    >
                      설명 (선택)
                    </label>
                    <textarea
                      id="projectDescription"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="프로젝트에 대한 설명을 입력하세요"
                      rows={4}
                      className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF] text-gray-900"
                    />
                  </div>

                  {/* 선택된 카테고리 */}
                  <div className="mb-6">
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
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-red-600 italic">
                        왼쪽 카테고리 트리에서 최소 1개의 카테고리를 선택해주세요 (최대 3개)
                      </p>
                    )}
                  </div>

                  {/* 다음 버튼 */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleCreateProject}
                      disabled={!projectTitle.trim() || categoryIds.length === 0}
                      className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음 단계
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: 파일 업로드 */}
              {step === 2 && (
                <div className="bg-white rounded-lg shadow-md p-8">
                  <h1 className="text-3xl font-bold text-shinhan-darkGray mb-2">
                    파일 업로드 및 타입 선택
                  </h1>
                  <p className="text-gray-600 mb-6">
                    프로젝트: <strong>{projectTitle}</strong>
                  </p>

                  {/* 업로드 성공 배너 */}
                  {uploadState.status === 'success' && (
                    <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
                      <div className="flex items-center gap-4">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h3 className="text-2xl font-bold">업로드 완료!</h3>
                          <p className="text-green-50">
                            {selectedFiles.length}개의 파일이 성공적으로 업로드되었습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 파일 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#333333] mb-2">
                      파일 선택 <span className="text-[#E53935]">*</span>
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleFilesSelected}
                      accept=".jpg,.jpeg,.png,.gif"
                      className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                      disabled={uploadState.isUploading}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      JPG, PNG, GIF 파일 (최대 10MB, 최대 10개)
                    </p>
                  </div>

                  {/* AI 태그 생성 상태 */}
                  {generatingTags && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#0046FF] rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-[#0046FF]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-base font-semibold text-[#0046FF]">
                          AI가 이미지를 분석하여 태그를 생성하고 있습니다...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 선택된 파일 목록 */}
                  {selectedFiles.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-[#333333] mb-3">
                        선택된 파일 ({selectedFiles.length}/10)
                      </h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-start gap-4 p-4 bg-white border border-[#E0E0E0] rounded-lg"
                          >
                            {/* 파일 아이콘 */}
                            <div className="text-3xl flex-shrink-0">{getFileIcon(file)}</div>

                            {/* 파일 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#333333] truncate mb-1">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 mb-3">
                                {formatFileSize(file.size)}
                              </p>

                              {/* 파일 타입 선택 */}
                              <FileTypeSelector
                                value={fileMeta[index]?.fileTypeFlag || 'PROPOSAL_DRAFT'}
                                onChange={(value) => handleFileTypeChange(index, value)}
                                disabled={uploadState.isUploading}
                                name={`fileType-${index}`}
                              />
                            </div>

                            {/* 제거 버튼 */}
                            <button
                              onClick={() => removeFile(index)}
                              disabled={uploadState.isUploading}
                              className="flex-shrink-0 p-2 text-gray-400 hover:text-[#E53935] hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 태그 입력 */}
                  <div className="mb-6">
                    <label htmlFor="tags" className="block text-sm font-medium text-[#333333] mb-2">
                      태그 (선택)
                      {generatedTags.length > 0 && (
                        <span className="ml-2 text-xs text-green-600">
                          - AI 태그가 자동으로 추가되었습니다
                        </span>
                      )}
                    </label>
                    <input
                      id="tags"
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="태그를 쉼표로 구분하여 입력"
                      className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF] text-gray-900"
                      disabled={uploadState.isUploading || generatingTags}
                    />
                  </div>

                  {/* 업로드 진행률 */}
                  {uploadState.status !== 'idle' && (
                    <div className="mb-6">
                      <UploadProgress
                        percentage={uploadState.progress}
                        fileName={`${selectedFiles.length}개 파일 업로드 중...`}
                        status={uploadState.status as 'uploading' | 'success' | 'error'}
                        error={uploadState.error}
                      />
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => {
                        setStep(1);
                        setSelectedFiles([]);
                        setFileMeta([]);
                        setTags('');
                        setGeneratedTags([]);
                      }}
                      disabled={uploadState.isUploading}
                      className="px-6 py-2 border border-[#E0E0E0] text-[#333333] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      이전 단계
                    </button>
                    <button
                      onClick={handleUploadFiles}
                      disabled={uploadState.isUploading || selectedFiles.length === 0}
                      className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {uploadState.isUploading ? '업로드 중...' : '업로드'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
