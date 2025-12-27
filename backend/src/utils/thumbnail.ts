import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

/**
 * 썸네일 생성 유틸리티 (Sharp 라이브러리 사용)
 * - 이미지 파일만 썸네일 생성 가능
 * - 기본 크기: 800x800px (Retina 디스플레이 최적화)
 */

// 썸네일 크기 설정
const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 800;

// 썸네일 생성 가능한 이미지 형식
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * 이미지 파일 여부 확인
 */
export const isImageFile = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.includes(ext);
};

/**
 * 썸네일 생성
 * @param originalPath 원본 파일 경로
 * @param thumbnailPath 썸네일 저장 경로
 * @param width 썸네일 너비 (기본값: 300)
 * @param height 썸네일 높이 (기본값: 300)
 * @returns 성공 여부
 */
export const generateThumbnail = async (
  originalPath: string,
  thumbnailPath: string,
  width: number = THUMBNAIL_WIDTH,
  height: number = THUMBNAIL_HEIGHT
): Promise<boolean> => {
  try {
    // 원본 파일 존재 확인
    await fs.access(originalPath);

    // 썸네일 저장 디렉토리 확인 및 생성
    const thumbnailDir = path.dirname(thumbnailPath);
    await fs.mkdir(thumbnailDir, { recursive: true });

    // Sharp를 사용한 썸네일 생성
    // fit: 'inside' - 원본 비율 유지하며 긴 쪽을 최대 크기로 제한
    // kernel: 'lanczos3' - 최고 품질 리사이징 알고리즘
    await sharp(originalPath)
      .resize(width, height, {
        fit: 'inside', // 원본 비율 유지 (크롭 없음)
        withoutEnlargement: true, // 작은 이미지 확대 방지
        kernel: 'lanczos3', // 최고 품질 리사이징 알고리즘
      })
      .jpeg({
        quality: 95, // JPEG 품질 (95% - 고품질)
        progressive: true, // 점진적 로딩
        mozjpeg: true, // 최적화된 JPEG 인코딩
      })
      .toFile(thumbnailPath);

    console.log('[Thumbnail] Generated:', thumbnailPath);
    return true;
  } catch (error) {
    console.error('[Thumbnail] Failed to generate thumbnail:', error);
    return false;
  }
};

/**
 * 여러 썸네일 크기 생성 (responsive images)
 * @param originalPath 원본 파일 경로
 * @param baseThumbnailPath 썸네일 저장 경로 (확장자 제외)
 * @returns 생성된 썸네일 경로 배열
 */
export const generateResponsiveThumbnails = async (
  originalPath: string,
  baseThumbnailPath: string
): Promise<{ size: string; path: string }[]> => {
  const sizes = [
    { name: 'small', width: 400, height: 400 },
    { name: 'medium', width: 800, height: 800 },
    { name: 'large', width: 1200, height: 1200 },
  ];

  const results: { size: string; path: string }[] = [];

  for (const size of sizes) {
    const thumbnailPath = `${baseThumbnailPath}_${size.name}.jpg`;
    const success = await generateThumbnail(originalPath, thumbnailPath, size.width, size.height);

    if (success) {
      results.push({ size: size.name, path: thumbnailPath });
    }
  }

  return results;
};

/**
 * 파일 삭제 (원본 및 썸네일)
 * @param originalPath 원본 파일 경로
 * @param thumbnailPath 썸네일 경로 (옵션)
 */
export const deleteFileWithThumbnail = async (
  originalPath: string,
  thumbnailPath?: string
): Promise<void> => {
  try {
    // 원본 파일 삭제
    await fs.unlink(originalPath);
    console.log('[File] Deleted original:', originalPath);

    // 썸네일 삭제
    if (thumbnailPath) {
      try {
        await fs.unlink(thumbnailPath);
        console.log('[File] Deleted thumbnail:', thumbnailPath);
      } catch (error) {
        // 썸네일이 없어도 오류 무시
        console.warn('[File] Thumbnail not found:', thumbnailPath);
      }
    }
  } catch (error) {
    console.error('[File] Failed to delete file:', error);
    throw error;
  }
};

/**
 * 이미지 메타데이터 추출
 * @param filePath 파일 경로
 * @returns 이미지 메타데이터
 */
export const getImageMetadata = async (
  filePath: string
): Promise<sharp.Metadata | null> => {
  try {
    const metadata = await sharp(filePath).metadata();
    return metadata;
  } catch (error) {
    console.error('[Image] Failed to extract metadata:', error);
    return null;
  }
};
