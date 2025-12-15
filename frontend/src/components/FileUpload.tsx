'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  formatFileSize,
  validateFile,
  getFileIcon,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
} from '@/lib/fileUtils';

interface FileWithPreview extends File {
  preview?: string;
}

interface FileUploadProps {
  onFilesSelected?: (files: File[]) => void;
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
}

export default function FileUpload({
  onFilesSelected,
  maxFiles = MAX_FILE_COUNT,
  multiple = true,
  className = '',
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 파일 추가 핸들러
   */
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newErrors: { [key: string]: string } = {};
    const validFiles: FileWithPreview[] = [];

    // 파일 개수 제한 확인
    if (selectedFiles.length + fileArray.length > maxFiles) {
      alert(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다`);
      return;
    }

    // 각 파일 검증
    fileArray.forEach((file) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        newErrors[file.name] = validation.error || '파일 검증 실패';
      } else {
        validFiles.push(file);
      }
    });

    setErrors(newErrors);

    if (validFiles.length > 0) {
      const updatedFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(updatedFiles);
      onFilesSelected?.(updatedFiles);
    }

    // 에러가 있으면 표시
    if (Object.keys(newErrors).length > 0) {
      console.warn('파일 검증 실패:', newErrors);
    }
  };

  /**
   * 파일 제거 핸들러
   */
  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesSelected?.(updatedFiles);

    // 해당 파일의 에러 제거
    const fileName = selectedFiles[index].name;
    const newErrors = { ...errors };
    delete newErrors[fileName];
    setErrors(newErrors);
  };

  /**
   * 드래그 오버 핸들러
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  /**
   * 드래그 리브 핸들러
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  /**
   * 드롭 핸들러
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  /**
   * 파일 입력 변경 핸들러
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleFiles(files);

    // 입력 초기화 (동일 파일 재선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 파일 선택 영역 클릭 핸들러
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 드래그 앤 드롭 영역 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${
            dragActive
              ? 'border-[#0046FF] bg-blue-50'
              : 'border-[#E0E0E0] bg-[#F5F5F5] hover:border-[#0046FF] hover:bg-blue-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif"
        />

        <div className="space-y-4">
          {/* 아이콘 */}
          <div className="flex justify-center">
            <svg
              className="w-16 h-16 text-gray-400"
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
          </div>

          {/* 안내 텍스트 */}
          <div>
            <p className="text-lg font-medium text-[#333333]">
              {dragActive
                ? '파일을 여기에 놓으세요'
                : '파일을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              JPG, PNG, GIF (최대 {formatFileSize(MAX_FILE_SIZE)})
            </p>
            <p className="mt-1 text-sm text-gray-500">
              최대 {maxFiles}개 파일 동시 업로드 가능
            </p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {Object.keys(errors).length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-medium text-[#E53935] mb-2">
            업로드 실패한 파일:
          </h4>
          <ul className="space-y-1">
            {Object.entries(errors).map(([fileName, error]) => (
              <li key={fileName} className="text-sm text-[#E53935]">
                <span className="font-medium">{fileName}</span>: {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 선택된 파일 목록 */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-[#333333] mb-3">
            선택된 파일 ({selectedFiles.length}/{maxFiles})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-4 bg-white border border-[#E0E0E0] rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4 flex-1">
                  {/* 파일 아이콘 */}
                  <div className="text-3xl">{getFileIcon(file)}</div>

                  {/* 파일 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#333333] truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type || '알 수 없음'}
                    </p>
                  </div>
                </div>

                {/* 제거 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="ml-4 p-2 text-gray-400 hover:text-[#E53935] hover:bg-red-50 rounded-full transition-colors"
                  aria-label={`${file.name} 제거`}
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
