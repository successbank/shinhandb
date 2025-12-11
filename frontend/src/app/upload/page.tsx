'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import UploadProgress from '@/components/UploadProgress';
import { uploadFiles, UploadProgress as UploadProgressType } from '@/lib/api';

interface UploadState {
  isUploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
}

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: 'idle',
  });

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
          categoryId: categoryId || undefined,
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
              setCategoryId('');
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

  return (
    <div className="min-h-screen bg-[#F5F5F5] py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#333333]">콘텐츠 업로드</h1>
          <p className="mt-2 text-gray-600">
            신한금융 광고 자료를 업로드하고 관리하세요
          </p>
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
                setCategoryId('');
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
                uploadState.isUploading || selectedFiles.length === 0 || !title.trim()
              }
              className="px-6 py-2 bg-[#0046FF] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadState.isUploading ? '업로드 중...' : '업로드'}
            </button>
          </div>

          {/* 성공 메시지 */}
          {uploadState.status === 'success' && uploadState.result && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-medium text-[#43A047] mb-2">
                업로드 성공!
              </h4>
              <p className="text-sm text-gray-700">
                {uploadState.result.message || '파일이 성공적으로 업로드되었습니다'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
