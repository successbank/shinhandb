import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { AppError } from '../middlewares/errorHandler';

/**
 * 파일 업로드 설정 (Multer)
 * - 최대 200MB 파일 크기 제한
 * - 지원 파일 형식: JPG, PNG, GIF, PDF, MP4, MOV, PSD, AI, ZIP
 */

// 지원하는 파일 형식 (MIME 타입)
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  document: ['application/pdf'],
  video: ['video/mp4', 'video/quicktime'], // MOV는 video/quicktime
  design: [
    'application/x-photoshop', // PSD
    'image/vnd.adobe.photoshop', // PSD
    'application/illustrator', // AI
    'application/postscript', // AI
  ],
  archive: ['application/zip', 'application/x-zip-compressed'],
};

// 모든 허용된 MIME 타입을 하나의 배열로 변환
const ALL_ALLOWED_TYPES = Object.values(ALLOWED_FILE_TYPES).flat();

// 파일 확장자로도 검증 (MIME 타입이 신뢰할 수 없을 수 있음)
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.pdf',
  '.mp4',
  '.mov',
  '.psd',
  '.ai',
  '.zip',
];

// 최대 파일 크기 (200MB)
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

/**
 * 파일 필터 함수 - 파일 형식 검증
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // MIME 타입 검증
  const isAllowedMimeType = ALL_ALLOWED_TYPES.includes(file.mimetype);

  // 확장자 검증
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedExtension = ALLOWED_EXTENSIONS.includes(ext);

  if (isAllowedMimeType || isAllowedExtension) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        `지원하지 않는 파일 형식입니다. 허용된 형식: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }
};

/**
 * 저장소 설정 - 파일명 및 저장 경로 설정
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 파일 저장 경로 (환경 변수에서 가져오거나 기본값 사용)
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 고유한 파일명 생성 (UUID + 원본 확장자)
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

/**
 * Multer 인스턴스 - 단일 파일 업로드
 */
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single('file');

/**
 * Multer 인스턴스 - 다중 파일 업로드 (최대 10개)
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // 최대 10개 파일 동시 업로드
  },
}).array('files', 10);

/**
 * 파일 형식 확인 함수
 */
export const getFileType = (mimetype: string): string => {
  if (ALLOWED_FILE_TYPES.image.includes(mimetype)) return 'image';
  if (ALLOWED_FILE_TYPES.document.includes(mimetype)) return 'document';
  if (ALLOWED_FILE_TYPES.video.includes(mimetype)) return 'video';
  if (ALLOWED_FILE_TYPES.design.includes(mimetype)) return 'design';
  if (ALLOWED_FILE_TYPES.archive.includes(mimetype)) return 'archive';
  return 'unknown';
};

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
