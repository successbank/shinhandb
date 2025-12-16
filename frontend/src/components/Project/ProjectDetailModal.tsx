'use client';

import { useState, useEffect } from 'react';
import { projectsApi, categoriesApi } from '@/lib/api';
import { formatFileSize } from '@/lib/fileUtils';
import CategoryTreeSidebar from '@/components/Category/CategoryTreeSidebar';

interface ProjectDetailModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  userRole?: string;
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
  userRole,
}: ProjectDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // 수정 모드 상태
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // 파일 타입 변경 상태 (임시 저장)
  const [fileTypeChanges, setFileTypeChanges] = useState<Record<string, 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT'>>({});

  // 삭제 대기 파일 ID 목록
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());

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

    try {
      // 1. 프로젝트 정보 업데이트
      if (editTitle.trim() !== projectDetail.title ||
          editDescription.trim() !== projectDetail.description ||
          JSON.stringify(editCategoryIds.sort()) !== JSON.stringify(projectDetail.categories.map(c => c.id).sort())) {
        await projectsApi.update(projectId, {
          title: editTitle.trim(),
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
    (userRole === 'CLIENT' && projectDetail?.uploaderId === projectDetail?.uploaderId);

  const canDelete = userRole === 'ADMIN';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                수정
              </button>
            )}

            {!isEditMode && canDelete && (
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
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
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
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
                    {/* 수정 모드: 제목 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        프로젝트 제목 *
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0046FF]"
                        placeholder="프로젝트 제목을 입력하세요"
                      />
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
                    {/* 보기 모드: 프로젝트 정보 */}
                    <h3 className="text-2xl font-bold text-shinhan-darkGray mb-2">
                      {projectDetail.title}
                    </h3>
                    {projectDetail.description && (
                      <p className="text-gray-600 mb-4">{projectDetail.description}</p>
                    )}

                    {/* 메타 정보 */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
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
                    </div>

                    {/* 카테고리 */}
                    {projectDetail.categories.length > 0 && (
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
                    )}
                  </>
                )}

                {/* 태그 클라우드 */}
                {!isEditMode && projectDetail.tags.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">태그</h4>
                    <div className="flex flex-wrap gap-2">
                      {projectDetail.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 파일 섹션 렌더링 함수 */}
              {isEditMode ? renderEditModeFiles() : renderViewModeFiles()}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // 보기 모드: 파일 목록
  function renderViewModeFiles() {
    if (!projectDetail) return null;

    return (
      <>
        {/* 제안 시안 */}
        {projectDetail.fileCount.proposal > 0 && (
          <div className="mb-6">
            <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">
              제안 시안 ({projectDetail.fileCount.proposal}개)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectDetail.files.proposalDrafts.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}

        {/* 최종 원고 */}
        {projectDetail.fileCount.final > 0 && (
          <div>
            <h4 className="text-xl font-bold text-shinhan-darkGray mb-4">
              최종 원고 ({projectDetail.fileCount.final}개)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectDetail.files.finalManuscripts.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}

        {/* 파일이 없는 경우 */}
        {projectDetail.fileCount.total === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">아직 업로드된 파일이 없습니다.</p>
          </div>
        )}
      </>
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

// 일반 파일 카드 컴포넌트
function FileCard({ file }: { file: FileItem }) {
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
      <p className="text-xs text-gray-500 mb-2">
        {formatFileSize(file.fileSize)}
      </p>

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
