import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs/promises';
import path from 'path';

/**
 * Google Cloud Vision API를 이용한 OCR 서비스
 * - 이미지에서 텍스트 추출 (TEXT_DETECTION)
 * - 한글/영문 지원
 */

// Google Cloud Vision API 클라이언트 초기화
let visionClient: ImageAnnotatorClient | null = null;

/**
 * Vision API 클라이언트 초기화
 */
const getVisionClient = (): ImageAnnotatorClient => {
  if (!visionClient) {
    // 환경 변수로 API 키 또는 서비스 계정 JSON 경로 설정
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const apiKey =
      process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      // API Key를 사용하는 경우
      visionClient = new ImageAnnotatorClient({
        apiKey: apiKey,
      });
    } else if (credentials) {
      // 서비스 계정 JSON 파일을 사용하는 경우
      visionClient = new ImageAnnotatorClient({
        keyFilename: credentials,
      });
    } else {
      // 기본 인증 (Application Default Credentials)
      visionClient = new ImageAnnotatorClient();
    }
  }
  return visionClient;
};

/**
 * 이미지에서 텍스트 추출 (OCR)
 * @param imagePath 이미지 파일 경로
 * @returns 추출된 텍스트
 */
export const extractTextFromImage = async (imagePath: string): Promise<string> => {
  try {
    // 파일 존재 확인
    await fs.access(imagePath);

    // Vision API 클라이언트 가져오기
    const client = getVisionClient();

    // 이미지 파일 읽기
    const imageBuffer = await fs.readFile(imagePath);

    // TEXT_DETECTION 실행
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });

    // 추출된 텍스트 가져오기
    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      console.log('[OCR] No text detected in image:', imagePath);
      return '';
    }

    // 첫 번째 항목이 전체 텍스트
    const fullText = detections[0].description || '';

    console.log('[OCR] Text extracted:', fullText.substring(0, 100) + '...');
    return fullText;
  } catch (error: any) {
    console.error('[OCR] Error extracting text from image:', error);

    // Google Cloud Vision API 에러 처리
    if (error.code === 3) {
      throw new Error('Google Cloud Vision API 인증 실패. API Key 또는 서비스 계정을 확인하세요.');
    } else if (error.code === 7) {
      throw new Error('API Key가 유효하지 않거나 권한이 없습니다.');
    }

    throw new Error(`OCR 실패: ${error.message}`);
  }
};

/**
 * 추출된 텍스트 전처리
 * - 특수문자 제거
 * - 연속된 공백 정규화
 * - 줄바꿈 정리
 * @param text 원본 텍스트
 * @returns 전처리된 텍스트
 */
export const preprocessText = (text: string): string => {
  if (!text || text.trim().length === 0) return '';

  let processed = text;

  // 1. 연속된 공백을 하나의 공백으로 변환
  processed = processed.replace(/\s+/g, ' ');

  // 2. 특수문자 제거 (한글, 영문, 숫자, 기본 구두점만 남김)
  processed = processed.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣.,!?-]/g, '');

  // 3. 앞뒤 공백 제거
  processed = processed.trim();

  return processed;
};

/**
 * 텍스트에서 자동 태그 추출
 * - 명사 추출 (간단한 로직)
 * - 불용어 제거
 * - 빈도 기반 필터링
 * @param text 전처리된 텍스트
 * @param maxTags 최대 태그 개수
 * @returns 태그 배열
 */
export const extractTagsFromText = (text: string, maxTags: number = 10): string[] => {
  if (!text || text.trim().length === 0) return [];

  // 1. 단어 단위로 분리
  const words = text.split(/\s+/);

  // 2. 불용어 리스트 (확장 가능)
  const stopWords = new Set([
    '은',
    '는',
    '이',
    '가',
    '을',
    '를',
    '의',
    '에',
    '와',
    '과',
    '도',
    '만',
    '로',
    '으로',
    '에서',
    '부터',
    '까지',
    '하다',
    '있다',
    '없다',
    '되다',
    'and',
    'or',
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
  ]);

  // 3. 단어 빈도 계산
  const wordFrequency: { [key: string]: number } = {};
  words.forEach((word) => {
    const normalized = word.toLowerCase().trim();

    // 길이가 2자 미만이거나 불용어는 제외
    if (normalized.length < 2 || stopWords.has(normalized)) {
      return;
    }

    wordFrequency[normalized] = (wordFrequency[normalized] || 0) + 1;
  });

  // 4. 빈도순으로 정렬
  const sortedWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // 5. 최대 개수만큼 반환
  return sortedWords.slice(0, maxTags);
};

/**
 * 이미지 파일이 OCR 지원 형식인지 확인
 * @param filename 파일명
 * @returns OCR 지원 여부
 */
export const isOcrSupportedFile = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
  return supportedExtensions.includes(ext);
};
