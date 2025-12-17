'use client';

import { useState, useEffect } from 'react';
import { projectsApi, categoriesApi } from '@/lib/api';
import { formatFileSize, isValidFileType, isValidFileSize, getFileIcon } from '@/lib/fileUtils';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';
import FileTypeSelector from '@/components/FileTypeSelector';
import ImageSliderModal from './ImageSliderModal';
import ShareModal from '@/components/Share/ShareModal';

interface ProjectDetailModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onTagClick?: (tag: string) => void;
  userRole?: string;
  userId?: string;
  // 프로젝트 네비게이션
  currentIndex?: number;
  totalCount?: number;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

interface FileItem {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
  tags?: string[];
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  title: string;
  description?: string;
  uploaderName: string;
  uploaderId: string;
  editableUntil?: string;
  createdAt: string;
  files: {
    proposalDrafts: FileItem[];
    finalManuscripts: FileItem[];
  };
  categories: Array<{ id: string; name: string }>;
  tags: string[];
  fileCount: {
    total: number;
    proposal: number;
    final: number;
  };
}

export default function ProjectDetailModal({
  projectId,
  isOpen,
  onClose,
  onUpdate,
  onTagClick,
  userRole,
  userId,
  currentIndex,
  totalCount,
  onNavigatePrev,
  onNavigateNext,
}: ProjectDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  // 수정 모드 상태
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // 수정 모드: 두 줄 제목 입력
  const [editTitleLine1Enabled, setEditTitleLine1Enabled] = useState(false);
  const [editTitleLine1, setEditTitleLine1] = useState('');
  const [editTitleLine2, setEditTitleLine2] = useState('');

  // 파일 타입 변경 상태 (임시 저장)
  const [fileTypeChanges, setFileTypeChanges] = useState<Record<string, 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT'>>({});

  // 삭제 대기 파일 ID 목록 (수정 모드용)
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());

  // 파일 업로드 관련 (보기 모드용)
  const [selectedNewFiles, setSelectedNewFiles] = useState<File[]>([]);
  const [newFileMeta, setNewFileMeta] = useState<Array<{
    fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
  }>>([]);

  // 업로드 상태
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    status: 'idle' | 'uploading' | 'success' | 'error';
    error?: string;
  }>({
    isUploading: false,
    progress: 0,
    status: 'idle',
  });

  // 드래그앤드롭
  const [isDragging, setIsDragging] = useState(false);

  // 이미지 슬라이더 상태
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 공유 모달 상태
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentShareFile, setCurrentShareFile] = useState<FileItem | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectDetail();
      loadCategories();
    }
  }, [isOpen, projectId]);

  const loadProjectDetail = async () => {
    try {
      setLoading(true);
      const response = await projectsApi.getDetail(projectId);
      if (response.success && response.data) {
        setProjectDetail(response.data);
        setEditTitle(response.data.title);
        setEditDescription(response.data.description || '');
        setEditCategoryIds(response.data.categories.map((c: any) => c.id));

        // 두 줄 제목 파싱
        const lines = response.data.title.split('\n');
        if (lines.length > 1) {
          setEditTitleLine1Enabled(true);
          setEditTitleLine1(lines[0]);
          setEditTitleLine2(lines.slice(1).join('\n'));
        } else {
          setEditTitleLine1Enabled(false);
          setEditTitleLine1('');
          setEditTitleLine2(lines[0] || '');
        }
      }
    } catch (error: any) {
      console.error('프로젝트 상세 로드 실패:', error);
      alert(error.message || '프로젝트 정보를 불러오는 데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getList();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setFileTypeChanges({});
    setFilesToDelete(new Set());
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (projectDetail) {
      setEditTitle(projectDetail.title);
      setEditDescription(projectDetail.description || '');
      setEditCategoryIds(projectDetail.categories.map((c) => c.id));
    }
    setFileTypeChanges({});
    setFilesToDelete(new Set());
  };

  const handleSaveEdit = async () => {
    if (!projectDetail) return;

    // 두 줄 제목 통합
    const fullTitle = editTitleLine1Enabled && editTitleLine1.trim()
      ? `${editTitleLine1.trim()}\n${editTitleLine2.trim()}`
      : editTitleLine2.trim();

    if (!fullTitle) {
      alert('프로젝트 제목을 입력해주세요');
      return;
    }

    if (fullTitle.length > 255) {
      alert('제목은 최대 255자까지 입력 가능합니다');
      return;
    }

    try {
      // 1. 프로젝트 정보 업데이트
      if (fullTitle !== projectDetail.title ||
          editDescription.trim() !== projectDetail.description ||
          JSON.stringify(editCategoryIds.sort()) !== JSON.stringify(projectDetail.categories.map(c => c.id).sort())) {
        await projectsApi.update(projectId, {
          title: fullTitle,
          description: editDescription.trim(),
          categoryIds: editCategoryIds,
        });
      }

      // 2. 파일 타입 변경 처리
      for (const [fileId, newType] of Object.entries(fileTypeChanges)) {
        await projectsApi.updateFileType(projectId, fileId, newType);
      }

      // 3. 파일 삭제 처리
      for (const fileId of filesToDelete) {
        await projectsApi.deleteFile(projectId, fileId);
      }

      alert('프로젝트가 수정되었습니다');
      setIsEditMode(false);
      setFileTypeChanges({});
      setFilesToDelete(new Set());
      await loadProjectDetail();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message || '프로젝트 수정 실패');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectDetail) return;

    const confirmed = confirm(
      `프로젝트 "${projectDetail.title}"를 삭제하시겠습니까?\n연결된 모든 파일도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      await projectsApi.delete(projectId);
      alert('프로젝트가 삭제되었습니다');
      onClose();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message || '프로젝트 삭제 실패');
    }
  };

  const handleFileTypeChange = (fileId: string, currentType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') => {
    const newType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT' =
      currentType === 'PROPOSAL_DRAFT' ? 'FINAL_MANUSCRIPT' : 'PROPOSAL_DRAFT';

    setFileTypeChanges(prev => ({
      ...prev,
      [fileId]: newType,
    }));
  };

  const handleToggleFileDelete = (fileId: string) => {
    setFilesToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const getFileCurrentType = (file: FileItem): 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT' => {
    return fileTypeChanges[file.id] || file.fileTypeFlag;
  };

  const isFileMarkedForDelete = (fileId: string): boolean => {
    return filesToDelete.has(fileId);
  };

  // 권한 체크
  const canEdit = userRole === 'ADMIN' ||
    (userRole === 'CLIENT' && projectDetail?.uploaderId === userId);

  const canDelete = userRole === 'ADMIN';

  // 보기 모드: 파일 즉시 삭제
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    const confirmed = confirm(
      `이 파일을 삭제하시겠습니까?\n\n파일명: ${fileName}\n\n⚠️ 삭제된 파일은 복구할 수 없습니다.`
    );

    if (!confirmed) return;

    try {
      await projectsApi.deleteFile(projectId, fileId);
      alert('파일이 삭제되었습니다');
      await loadProjectDetail();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message || '파일 삭제 실패');
    }
  };

  // 보기 모드: 파일 타입 즉시 변경
  const handleFileTypeToggle = async (
    fileId: string,
    currentType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT'
  ) => {
    const newType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT' =
      currentType === 'PROPOSAL_DRAFT' ? 'FINAL_MANUSCRIPT' : 'PROPOSAL_DRAFT';

    try {
      await projectsApi.updateFileType(projectId, fileId, newType);
      await loadProjectDetail();
    } catch (error: any) {
      alert(error.message || '파일 타입 변경 실패');
    }
  };

  // 이미지 클릭 핸들러
  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsImageSliderOpen(true);
  };

  // 파일 선택 핸들러
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
  };

  // 드래그앤드롭 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  // 파일 처리 (검증 + 상태 저장)
  const processFiles = (files: File[]) => {
    // 최대 10개 제한
    if (files.length > 10) {
      alert('최대 10개의 파일만 업로드 가능합니다');
      return;
    }

    // 파일 타입/크기 검증
    const invalidFiles: string[] = [];
    files.forEach(file => {
      if (!isValidFileType(file) || !isValidFileSize(file)) {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(
        `지원하지 않는 파일이 포함되어 있습니다:\n\n${invalidFiles.join('\n')}\n\n` +
        `허용: JPG, PNG, GIF (최대 10MB)`
      );
      return;
    }

    setSelectedNewFiles(files);
    setNewFileMeta(files.map(() => ({ fileTypeFlag: 'PROPOSAL_DRAFT' })));
  };

  // 파일 업로드 핸들러
  const handleUploadFiles = async () => {
    if (selectedNewFiles.length === 0) {
      alert('업로드할 파일을 선택해주세요');
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      status: 'uploading',
    });

    try {
      await projectsApi.uploadFiles(
        projectId,
        selectedNewFiles,
        newFileMeta,
        undefined, // tags
        {
          onProgress: (progress) => {
            setUploadState(prev => ({
              ...prev,
              progress: progress.percentage,
            }));
          },
          onSuccess: () => {
            setUploadState({
              isUploading: false,
              progress: 100,
              status: 'success',
            });

            // 2초 후 자동 정리
            setTimeout(() => {
              setSelectedNewFiles([]);
              setNewFileMeta([]);
              setUploadState({
                isUploading: false,
                progress: 0,
                status: 'idle',
              });
              loadProjectDetail();
              if (onUpdate) onUpdate();
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

  // 공유 버튼 클릭 핸들러
  const handleShareClick = (file: FileItem) => {
    setCurrentShareFile(file);
    setIsShareModalOpen(true);
  };

  // 공유 모달 닫기
  const handleShareModalClose = () => {
    setIsShareModalOpen(false);
    setCurrentShareFile(null);
  };

  // 프로젝트 공유 버튼 클릭 핸들러
  const handleProjectShare = () => {
    if (!projectDetail) return;

    // 프로젝트 대표 이미지 선택 (최종원고 우선, 없으면 제안시안)
    const representativeFile =
      projectDetail.files?.finalManuscripts?.[0] ||
      projectDetail.files?.proposalDrafts?.[0];

    if (representativeFile) {
      handleShareClick(representativeFile);
    } else {
      alert('공유할 이미지가 없습니다.');
    }
  };

  // 모달 닫기 (업로드 중일 때는 경고)
  const handleClose = () => {
    if (uploadState.isUploading) {
      alert('파일 업로드가 진행 중입니다. 완료될 때까지 기다려주세요.');
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-shinhan-darkGray">
            {isEditMode ? '프로젝트 수정' : '프로젝트 상세'}
          </h2>

          <div className="flex items-center gap-2">
            {!isEditMode && canEdit && (
              <button
                onClick={handleEdit}
                disabled={uploadState.isUploading}
                className={`p-2 rounded-lg transition-colors ${
                  uploadState.isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="수정"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}

            {!isEditMode && canDelete && (
              <button
                onClick={handleDeleteProject}
                disabled={uploadState.isUploading}
                className={`p-2 rounded-lg transition-colors ${
                  uploadState.isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                title="삭제"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {isEditMode && (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  저장
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  취소
                </button>
              </>
            )}

            <button
              onClick={handleClose}
              disabled={uploadState.isUploading}
              className={`transition-colors ${
                uploadState.isUploading
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={uploadState.isUploading ? '업로드 진행 중...' : '닫기'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모달 내용 */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0046FF] mx-auto mb-4"></div>
                <p className="text-gray-600">로딩 중...</p>
              </div>
            </div>
          )}

          {!loading && projectDetail && (
            <>
              {/* 프로젝트 정보 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                {isEditMode ? (
                  <>
                    {/* 수정 모드: 제목 (두 줄 입력) */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        프로젝트 제목 *
                      </label>

                      {/* 첫 번째 줄 (체크박스로 활성화) */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id="editEnableTitleLine1"
                            checked={editTitleLine1Enabled}
                            onChange={(e) => setEditTitleLine1Enabled(e.target.checked)}
                            className="w-4 h-4 text-[#0046FF] border-gray-300 rounded focus:ring-[#0046FF]"
                          />
                          <label htmlFor="editEnableTitleLine1" className="text-sm text-gray-600 cursor-pointer">
                            첫 번째 줄 제목 사용
                          </label>
                        </div>
                        <input
                          type="text"
                          value={editTitleLine1}
                          onChange={(e) => setEditTitleLine1(e.target.value)}
                          placeholder="첫 번째 줄 제목 (선택)"
                          disabled={!editTitleLine1Enabled}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF] ${
                            !editTitleLine1Enabled ? 'bg-gray-100 cursor-not-allowed' : ''
                          }`}
                          maxLength={127}
                        />
                      </div>

                      {/* 두 번째 줄 (항상 활성화) */}
                      <input
                        type="text"
                        value={editTitleLine2}
                        onChange={(e) => setEditTitleLine2(e.target.value)}
                        placeholder="프로젝트 제목을 입력하세요"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                        maxLength={127}
                      />

                      {/* 글자 수 표시 */}
                      <p className="mt-1 text-xs text-gray-500 text-right">
                        {editTitleLine1Enabled && editTitleLine1.trim()
                          ? `${editTitleLine1.length + editTitleLine2.length + 1}/255자`
                          : `${editTitleLine2.length}/255자`}
                      </p>
                    </div>

                    {/* 수정 모드: 설명 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        프로젝트 설명
                      </label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                        placeholder="프로젝트 설명을 입력하세요"
                      />
                    </div>

                    {/* 수정 모드: 카테고리 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        카테고리 선택 (최대 3개) *
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                        <CategoryTreeSidebar
                          categories={categories}
                          selectedCategoryIds={editCategoryIds}
                          onCategorySelect={setEditCategoryIds}
                          maxSelection={3}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {editCategoryIds.map((catId) => {
                          const category = categories.find((c) => c.id === catId);
                          return category ? (
                            <span
                              key={catId}
                              className="px-3 py-1 bg-blue-100 text-[#0046FF] text-sm rounded-full flex items-center gap-2"
                            >
                              {category.name}
                              <button
                                onClick={() => setEditCategoryIds(prev => prev.filter(id => id !== catId))}
                                className="hover:text-red-600"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        선택됨: {editCategoryIds.length}/3
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 보기 모드: 프로젝트 정보 (두 줄 제목 지원) */}
                    <div className="mb-2">
                      {projectDetail.title.split('\n').map((line, index, array) => (
                        <div
                          key={index}
                          className={`flex items-center ${index === array.length - 1 ? 'justify-between' : 'justify-start'}`}
                        >
                          <h3 className="text-[22px] font-bold text-shinhan-darkGray">
                            {line}
                          </h3>
                          {/* 마지막 줄 끝에만 공유 버튼 표시 */}
                          {index === array.length - 1 && (
                            <button
                              className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors ml-4"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProjectShare();
                              }}
                              title="프로젝트 공유"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {projectDetail.description && (
                      <p className="text-gray-600 mb-4">{projectDetail.description}</p>
                    )}

                    {/* 메타 정보 */}
                    {/* <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>업로더: {projectDetail.uploaderName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{new Date(projectDetail.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>전체 {projectDetail.fileCount.total}개 파일</span>
                      </div>
                    </div> */}

                    {/* 카테고리 */}
                    {/* {projectDetail.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {projectDetail.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="px-3 py-1 bg-blue-100 text-[#0046FF] text-sm rounded-full"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    )} */}
                  </>
                )}
              </div>

              {/* 파일 섹션 렌더링 함수 */}
              {isEditMode ? renderEditModeFiles() : renderViewModeFiles()}
            </>
          )}
        </div>
      </div>

      {/* 공유 모달 */}
      {isShareModalOpen && currentShareFile && projectDetail && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={handleShareModalClose}
          shareData={{
            title: projectDetail.title,
            description: currentShareFile.fileTypeFlag === 'FINAL_MANUSCRIPT' ? '최종 원고' : '제안 시안',
            imageUrl: currentShareFile.fileUrl,
            webUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/projects/${projectId}`,
          }}
        />
      )}
    </div>
  );

  // 보기 모드: 파일 목록
  function renderViewModeFiles() {
    if (!projectDetail) return null;

    // 모든 파일을 하나의 배열로 합치기 (이미지 슬라이더용)
    const allFiles = [
      ...projectDetail.files.finalManuscripts.map(f => ({ ...f, typeLabel: '최종 원고' })),
      ...projectDetail.files.proposalDrafts.map(f => ({ ...f, typeLabel: '제안 시안' })),
    ];

    return (
      <>
        {/* 최종 원고 섹션 */}
        {projectDetail.fileCount.final > 0 && (
          <div className="mb-6">
            <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">
              최종 원고 ({projectDetail.fileCount.final}개)
            </h4>
            <div className="space-y-6 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
              {projectDetail.files.finalManuscripts.map((file, index) => (
                <div
                  key={file.id}
                  className="border border-[#E0E0E0] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* 이미지와 플래그 */}
                  <div className="relative cursor-pointer" onClick={() => handleImageClick(index)}>
                    {/* 플래그 */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1 bg-[#0046FF] text-white text-sm font-medium rounded shadow-md">
                        최종 원고
                      </span>
                    </div>

                    {/* 이전 프로젝트 화살표 (왼쪽) - 첫 번째 이미지일 때만 */}
                    {index === 0 && onNavigatePrev && currentIndex !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigatePrev();
                        }}
                        disabled={currentIndex === 0}
                        className={`absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all md:hidden ${
                          currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={currentIndex === 0 ? '첫 번째 프로젝트입니다' : '이전 프로젝트'}
                      >
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}

                    {/* 다음 프로젝트 화살표 (오른쪽) - 첫 번째 이미지일 때만 */}
                    {index === 0 && onNavigateNext && currentIndex !== undefined && totalCount !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateNext();
                        }}
                        disabled={currentIndex === totalCount - 1}
                        className={`absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all md:hidden ${
                          currentIndex === totalCount - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={currentIndex === totalCount - 1 ? '마지막 프로젝트입니다' : '다음 프로젝트'}
                      >
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    {/* 큰 이미지 (원본 사용) */}
                    {file.fileUrl ? (
                      <img
                        src={file.fileUrl}
                        alt="최종 원고"
                        className="w-full h-auto object-contain bg-gray-50"
                        style={{ maxWidth: '100%', display: 'block' }}
                      />
                    ) : (
                      <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
                        <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* 버튼 영역 */}
                  <div className="p-4 bg-white flex justify-end gap-2">
                    <a
                      href={file.fileUrl}
                      download
                      className="inline-flex items-center px-6 py-2 bg-[#0046FF] text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      다운로드
                    </a>
                    <button
                      className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareClick(file);
                      }}
                      title="이미지 공유"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 제안 시안 섹션 */}
        {projectDetail.fileCount.proposal > 0 && (
          <div className="mb-6">
            <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">
              제안 시안 ({projectDetail.fileCount.proposal}개)
            </h4>
            <div className="space-y-6 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
              {projectDetail.files.proposalDrafts.map((file, index) => (
                <div
                  key={file.id}
                  className="border border-[#E0E0E0] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* 이미지와 플래그 */}
                  <div className="relative cursor-pointer" onClick={() => handleImageClick(projectDetail.fileCount.final + index)}>
                    {/* 플래그 */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1 bg-gray-600 text-white text-sm font-medium rounded shadow-md">
                        제안 시안
                      </span>
                    </div>

                    {/* 이전 프로젝트 화살표 (왼쪽) - 최종 원고가 없고 첫 번째 이미지일 때만 */}
                    {projectDetail.fileCount.final === 0 && index === 0 && onNavigatePrev && currentIndex !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigatePrev();
                        }}
                        disabled={currentIndex === 0}
                        className={`absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all md:hidden ${
                          currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={currentIndex === 0 ? '첫 번째 프로젝트입니다' : '이전 프로젝트'}
                      >
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}

                    {/* 다음 프로젝트 화살표 (오른쪽) - 최종 원고가 없고 첫 번째 이미지일 때만 */}
                    {projectDetail.fileCount.final === 0 && index === 0 && onNavigateNext && currentIndex !== undefined && totalCount !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateNext();
                        }}
                        disabled={currentIndex === totalCount - 1}
                        className={`absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all md:hidden ${
                          currentIndex === totalCount - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={currentIndex === totalCount - 1 ? '마지막 프로젝트입니다' : '다음 프로젝트'}
                      >
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    {/* 큰 이미지 (원본 사용) */}
                    {file.fileUrl ? (
                      <img
                        src={file.fileUrl}
                        alt="제안 시안"
                        className="w-full h-auto object-contain bg-gray-50"
                        style={{ maxWidth: '100%', display: 'block' }}
                      />
                    ) : (
                      <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
                        <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* 버튼 영역 */}
                  <div className="p-4 bg-white flex justify-end gap-2">
                    <a
                      href={file.fileUrl}
                      download
                      className="inline-flex items-center px-6 py-2 bg-[#0046FF] text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      다운로드
                    </a>
                    <button
                      className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareClick(file);
                      }}
                      title="이미지 공유"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일이 없는 경우 */}
        {allFiles.length === 0 && (
          <div className="text-center py-12 mb-6">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">아직 업로드된 파일이 없습니다.</p>
          </div>
        )}

        {/* 태그 영역 (파일 추가 영역 위) */}
        {projectDetail.tags.length > 0 && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">프로젝트 태그</h4>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('태그 펼치기 버튼 클릭, 현재 상태:', isTagsExpanded);
                  setIsTagsExpanded((prev) => {
                    console.log('상태 변경: ', prev, '->', !prev);
                    return !prev;
                  });
                }}
                className="flex items-center gap-1 px-3 py-1 text-xs text-[#0046FF] hover:bg-blue-50 rounded transition-colors"
              >
                {isTagsExpanded ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    접기
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    태그 펼쳐보기
                  </>
                )}
              </button>
            </div>
            <div
              className="relative"
              style={{
                maxHeight: isTagsExpanded ? '1000px' : '45px',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out'
              }}
            >
              <div className="flex flex-wrap gap-2">
              {projectDetail.tags.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (onTagClick) {
                      onTagClick(tag);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-full shadow-sm hover:shadow hover:bg-[#0046FF] hover:text-white hover:border-[#0046FF] transition-all cursor-pointer"
                  title={`"${tag}" 태그로 검색`}
                >
                  #{tag}
                </button>
              ))}
              </div>
              {/* Fade effect when collapsed */}
              {!isTagsExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent pointer-events-none"></div>
              )}
            </div>
            {!isTagsExpanded && projectDetail.tags.length > 10 && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                {projectDetail.tags.length}개의 태그가 있습니다
              </div>
            )}
          </div>
        )}

        {/* 파일 업로드 영역 (ADMIN, CLIENT만 표시) */}
        {(userRole === 'ADMIN' || userRole === 'CLIENT') && renderFileUploadZone()}

        {/* 이미지 슬라이더 모달 */}
        <ImageSliderModal
          isOpen={isImageSliderOpen}
          onClose={() => setIsImageSliderOpen(false)}
          images={allFiles}
          initialIndex={currentImageIndex}
          currentIndex={currentImageIndex}
          onIndexChange={setCurrentImageIndex}
        />
      </>
    );
  }

  // 파일 업로드 영역 (보기 모드)
  function renderFileUploadZone() {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">파일 추가</h4>

        {/* 드래그앤드롭 영역 */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-[#0046FF] bg-blue-50'
              : 'border-gray-300 hover:border-[#0046FF] hover:bg-gray-50'
          } ${uploadState.isUploading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif"
            onChange={handleFilesSelected}
            className="hidden"
            id="file-upload-modal"
            disabled={uploadState.isUploading}
          />
          <label
            htmlFor="file-upload-modal"
            className="cursor-pointer flex flex-col items-center"
          >
            <svg
              className="w-12 h-12 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-600 mb-1">
              <span className="text-[#0046FF] font-medium">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-gray-500">
              JPG, PNG, GIF (최대 10MB, 최대 10개)
            </p>
          </label>
        </div>

        {/* 선택된 파일 목록 */}
        {selectedNewFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              선택된 파일 ({selectedNewFiles.length}개)
            </p>
            {selectedNewFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* 파일 아이콘 */}
                <div className="flex-shrink-0 text-2xl">
                  {getFileIcon(file)}
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* 파일 타입 선택 */}
                <div className="flex-shrink-0">
                  <FileTypeSelector
                    value={newFileMeta[index]?.fileTypeFlag || 'PROPOSAL_DRAFT'}
                    onChange={(value) => {
                      const newMeta = [...newFileMeta];
                      newMeta[index] = { fileTypeFlag: value };
                      setNewFileMeta(newMeta);
                    }}
                  />
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => {
                    setSelectedNewFiles(prev => prev.filter((_, i) => i !== index));
                    setNewFileMeta(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="파일 제거"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 업로드 진행 상태 */}
        {uploadState.status !== 'idle' && (
          <div className="mt-4">
            {uploadState.status === 'uploading' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">업로드 중...</span>
                  <span className="text-sm text-gray-600">{uploadState.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-[#0046FF] h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadState.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {uploadState.status === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">파일 업로드 완료!</span>
              </div>
            )}

            {uploadState.status === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <p className="text-sm font-medium">업로드 실패</p>
                {uploadState.error && (
                  <p className="text-xs mt-1">{uploadState.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 업로드 버튼 */}
        {selectedNewFiles.length > 0 && uploadState.status !== 'success' && (
          <div className="mt-4">
            <button
              onClick={handleUploadFiles}
              disabled={uploadState.isUploading}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                uploadState.isUploading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#0046FF] text-white hover:bg-blue-700'
              }`}
            >
              {uploadState.isUploading ? '업로드 중...' : `${selectedNewFiles.length}개 파일 업로드`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // 수정 모드: 파일 목록
  function renderEditModeFiles() {
    if (!projectDetail) return null;

    const allFiles = [
      ...projectDetail.files.proposalDrafts.map(f => ({ ...f, originalType: 'PROPOSAL_DRAFT' as const })),
      ...projectDetail.files.finalManuscripts.map(f => ({ ...f, originalType: 'FINAL_MANUSCRIPT' as const })),
    ];

    // 삭제 예정이 아닌 파일만 표시
    const activeFiles = allFiles.filter(f => !isFileMarkedForDelete(f.id));

    if (activeFiles.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">모든 파일이 삭제 예정입니다.</p>
        </div>
      );
    }

    return (
      <div>
        <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">
          파일 목록 ({activeFiles.length}개)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeFiles.map((file) => (
            <EditableFileCard
              key={file.id}
              file={file}
              currentType={getFileCurrentType(file)}
              onTypeChange={() => handleFileTypeChange(file.id, getFileCurrentType(file))}
              onDelete={() => handleToggleFileDelete(file.id)}
            />
          ))}
        </div>
      </div>
    );
  }
}

// 갤러리 타입 파일 카드 컴포넌트 (타이틀, 파일용량, 다운로드 버튼 숨김)
function GalleryFileCard({
  file,
  canEdit,
  onDelete,
  onTypeChange,
  onClick
}: {
  file: FileItem & { typeLabel: string };
  canEdit?: boolean;
  onDelete?: (fileId: string, fileName: string) => void;
  onTypeChange?: (fileId: string, currentType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') => void;
  onClick?: () => void;
}) {
  return (
    <div
      className="group relative rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      {/* 썸네일 */}
      {file.thumbnailUrl ? (
        <img
          src={file.thumbnailUrl}
          alt={file.fileName}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* 파일 타입 배지 (좌상단) */}
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-1 text-xs font-medium rounded shadow-sm ${
          file.fileTypeFlag === 'FINAL_MANUSCRIPT'
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white'
        }`}>
          {file.typeLabel}
        </span>
      </div>

      {/* 수정 버튼 (우상단, 권한 있을 때만 hover 시 표시) */}
      {canEdit && onTypeChange && onDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          {/* 타입 변경 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTypeChange(file.id, file.fileTypeFlag);
            }}
            className="p-1.5 bg-white/90 hover:bg-white rounded shadow-sm transition-colors"
            title="타입 변경"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          {/* 삭제 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id, file.fileName);
            }}
            className="p-1.5 bg-white/90 hover:bg-red-50 rounded shadow-sm transition-colors"
            title="삭제"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* 확대 아이콘 (hover 시 중앙에 표시) */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-2">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <span className="text-sm font-medium">클릭하여 크게 보기</span>
        </div>
      </div>
    </div>
  );
}

// 일반 파일 카드 컴포넌트 (수정 모드용)
function FileCard({
  file,
  canEdit,
  onDelete,
  onTypeChange
}: {
  file: FileItem;
  canEdit?: boolean;
  onDelete?: (fileId: string, fileName: string) => void;
  onTypeChange?: (fileId: string, currentType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') => void;
}) {
  return (
    <div className="border border-[#E0E0E0] rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* 썸네일 */}
      {file.thumbnailUrl ? (
        <img
          src={file.thumbnailUrl}
          alt={file.fileName}
          className="w-full h-48 object-cover rounded mb-3"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded mb-3 flex items-center justify-center">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* 파일명 */}
      <p className="text-sm font-medium text-[#333333] truncate mb-1">
        {file.fileName}
      </p>

      {/* 파일 크기 */}
      <p className="text-xs text-gray-500 mb-3">
        {formatFileSize(file.fileSize)}
      </p>

      {/* 수정 버튼 (권한 있을 때만) */}
      {canEdit && onTypeChange && onDelete && (
        <div className="flex items-center justify-between mb-3">
          {/* 타입 토글 버튼 */}
          <button
            onClick={() => onTypeChange(file.id, file.fileTypeFlag)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              file.fileTypeFlag === 'PROPOSAL_DRAFT'
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
            title="클릭하여 타입 변경"
          >
            {file.fileTypeFlag === 'PROPOSAL_DRAFT' ? '제안 시안' : '최종 원고'} ⇄
          </button>

          {/* 삭제 버튼 */}
          <button
            onClick={() => onDelete(file.id, file.fileName)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="파일 삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* 다운로드 버튼 */}
      <a
        href={file.fileUrl}
        download
        className="block w-full py-2 text-center bg-[#0046FF] text-white text-sm rounded hover:bg-blue-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        다운로드
      </a>
    </div>
  );
}

// 수정 가능한 파일 카드 컴포넌트
function EditableFileCard({
  file,
  currentType,
  onTypeChange,
  onDelete
}: {
  file: FileItem & { originalType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT' };
  currentType: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';
  onTypeChange: () => void;
  onDelete: () => void;
}) {
  const typeLabel = currentType === 'PROPOSAL_DRAFT' ? '제안 시안' : '최종 원고';
  const typeColor = currentType === 'PROPOSAL_DRAFT' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

  return (
    <div className="border border-[#E0E0E0] rounded-lg p-4 hover:shadow-md transition-shadow relative">
      {/* 파일 타입 변경 버튼 */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={onTypeChange}
          className={`px-2 py-1 text-xs font-medium rounded ${typeColor}`}
          title="클릭하여 타입 변경"
        >
          {typeLabel} ⇄
        </button>
      </div>

      {/* 삭제 버튼 */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={onDelete}
          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
        >
          삭제
        </button>
      </div>

      {/* 썸네일 */}
      {file.thumbnailUrl ? (
        <img
          src={file.thumbnailUrl}
          alt={file.fileName}
          className="w-full h-48 object-cover rounded mb-3"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded mb-3 flex items-center justify-center">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* 파일명 */}
      <p className="text-sm font-medium text-[#333333] truncate mb-1">
        {file.fileName}
      </p>

      {/* 파일 크기 */}
      <p className="text-xs text-gray-500">
        {formatFileSize(file.fileSize)}
      </p>
    </div>
  );
}
