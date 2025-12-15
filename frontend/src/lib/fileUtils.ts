/**
 * 파일 관련 유틸리티 함수
 */

// 지원하는 파일 형식
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
};

// 허용된 파일 확장자
export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
];

// 최대 파일 크기 (200MB)
export const MAX_FILE_SIZE = 200 * 1024 * 1024;

// 최대 파일 개수
export const MAX_FILE_COUNT = 10;

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * 파일 형식 검증
 */
export const isValidFileType = (file: File): boolean => {
  const allAllowedTypes = Object.values(ALLOWED_FILE_TYPES).flat();
  const isAllowedMimeType = allAllowedTypes.includes(file.type);

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const isAllowedExtension = ALLOWED_EXTENSIONS.includes(ext);

  return isAllowedMimeType || isAllowedExtension;
};

/**
 * 파일 크기 검증
 */
export const isValidFileSize = (file: File): boolean => {
  return file.size <= MAX_FILE_SIZE;
};

/**
 * 파일 검증 (형식 + 크기)
 */
export const validateFile = (
  file: File
): { valid: boolean; error?: string } => {
  if (!isValidFileType(file)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. 허용된 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (!isValidFileSize(file)) {
    return {
      valid: false,
      error: `파일 크기가 ${formatFileSize(MAX_FILE_SIZE)}를 초과합니다`,
    };
  }

  return { valid: true };
};

/**
 * 파일 타입 카테고리 확인
 */
export const getFileCategory = (file: File): string => {
  if (ALLOWED_FILE_TYPES.image.includes(file.type)) return 'image';
  return 'unknown';
};

/**
 * 파일 타입 아이콘 가져오기
 */
export const getFileIcon = (file: File): string => {
  const category = getFileCategory(file);
  switch (category) {
    case 'image':
      return '🖼️';
    default:
      return '📁';
  }
};
