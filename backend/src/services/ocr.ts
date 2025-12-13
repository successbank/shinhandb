import { ImageAnnotatorClient } from '@google-cloud/vision';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

/**
 * Google Cloud Vision API를 이용한 OCR 서비스
 * - 이미지에서 텍스트 추출 (TEXT_DETECTION)
 * - OpenAI를 활용한 지능적인 태그 생성
 * - 한글/영문 지원
 */

// Google Cloud Vision API 클라이언트 초기화
let visionClient: ImageAnnotatorClient | null = null;

// OpenAI API 클라이언트 초기화
let openaiClient: OpenAI | null = null;

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
      // Credentials가 없으면 에러 발생
      throw new Error('Google Cloud Vision API credentials가 설정되지 않았습니다. GOOGLE_CLOUD_VISION_API_KEY 또는 GOOGLE_APPLICATION_CREDENTIALS 환경 변수를 설정해주세요.');
    }
  }
  return visionClient;
};

/**
 * OpenAI API 클라이언트 초기화
 */
const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY 환경 변수를 설정해주세요.');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openaiClient;
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

/**
 * OpenAI를 사용한 지능적인 태그 생성
 * - OCR로 추출한 텍스트를 분석하여 광고 콘텐츠에 적합한 태그 생성
 * - 한국어와 영어를 모두 지원
 * - 신한금융 광고 특화 태그 생성
 * @param ocrText OCR로 추출한 텍스트
 * @param maxTags 최대 태그 개수 (기본값: 10)
 * @returns 생성된 태그 배열
 */
export const generateTagsWithAI = async (
  ocrText: string,
  maxTags: number = 10
): Promise<string[]> => {
  try {
    if (!ocrText || ocrText.trim().length === 0) {
      console.log('[AI Tag Generation] No text provided');
      return [];
    }

    const client = getOpenAIClient();

    // OpenAI API 호출
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 신한금융 광고 콘텐츠 관리 전문가입니다.
광고 이미지에서 추출한 텍스트를 분석하여 검색과 분류에 유용한 태그를 생성합니다.

태그 생성 가이드라인:
1. 광고의 핵심 주제와 메시지를 파악
2. 브랜드명, 상품명, 서비스명 추출
3. 캠페인 성격 (브랜드 PR, 상품, 이벤트, CSR 등) 파악
4. 타겟 고객층 (개인, 기업, 청년, 시니어 등) 식별
5. 시즌/이벤트 (설날, 추석, 크리스마스 등) 관련 정보
6. 감성/톤앤매너 (따뜻함, 신뢰, 혁신, 편리함 등)
7. 매체/형식 (웹배너, 포스터, 영상썸네일, SNS 등)

출력 형식:
- 한국어 태그 사용 (필요시 영어 혼용)
- 간결하고 구체적인 단어/구문
- 최대 ${maxTags}개
- 쉼표로 구분된 텍스트만 출력 (다른 설명 없이)

예시: 신한은행, 적금, 청년, 금융상품, 브랜드 캠페인, 2024, 봄, 따뜻함, 웹배너`,
        },
        {
          role: 'user',
          content: `다음 광고 이미지에서 추출한 텍스트를 분석하여 태그를 생성해주세요:\n\n${ocrText}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      console.warn('[AI Tag Generation] No response from OpenAI');
      return [];
    }

    // 응답에서 태그 추출 (쉼표로 구분)
    const tags = responseText
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0 && tag.length <= 50) // 너무 긴 태그 제외
      .slice(0, maxTags);

    console.log('[AI Tag Generation] Generated tags:', tags);
    return tags;
  } catch (error: any) {
    console.error('[AI Tag Generation] Error:', error.message);

    // OpenAI API 에러가 발생해도 업로드는 계속 진행
    // 기본 태그 추출 로직으로 폴백
    return extractTagsFromText(ocrText, maxTags);
  }
};

/**
 * 통합 태그 생성 (OCR + AI)
 * - OCR로 텍스트 추출
 * - OpenAI로 지능적인 태그 생성
 * - 실패 시 기본 태그 추출 로직으로 폴백
 * @param imagePath 이미지 파일 경로
 * @param maxTags 최대 태그 개수
 * @returns { ocrText: 추출된 텍스트, tags: 생성된 태그 배열 }
 */
export const extractTextAndGenerateTags = async (
  imagePath: string,
  maxTags: number = 10
): Promise<{ ocrText: string; tags: string[] }> => {
  try {
    // 1. OCR로 텍스트 추출
    const extractedText = await extractTextFromImage(imagePath);

    if (!extractedText || extractedText.trim().length === 0) {
      console.log('[OCR + AI] No text detected');
      return { ocrText: '', tags: [] };
    }

    // 2. 텍스트 전처리
    const ocrText = preprocessText(extractedText);

    // 3. OpenAI로 태그 생성 (실패 시 기본 로직으로 폴백)
    let tags: string[] = [];

    try {
      tags = await generateTagsWithAI(ocrText, maxTags);
    } catch (aiError: any) {
      console.warn('[OCR + AI] AI tag generation failed, using fallback:', aiError.message);
      tags = extractTagsFromText(ocrText, maxTags);
    }

    return { ocrText, tags };
  } catch (error: any) {
    console.error('[OCR + AI] Error:', error.message);
    return { ocrText: '', tags: [] };
  }
};
