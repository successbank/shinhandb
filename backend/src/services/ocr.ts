import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

/**
 * OpenAI GPT-4 Vision을 이용한 OCR 서비스
 * - 이미지에서 텍스트 추출 (GPT-4 Vision)
 * - OpenAI를 활용한 지능적인 태그 생성
 * - 한글/영문 지원
 * - Google Cloud Vision API 불필요 (OpenAI API Key만 필요)
 */

// OpenAI API 클라이언트 초기화
let openaiClient: OpenAI | null = null;

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
 * 이미지에서 텍스트 추출 (OCR) - OpenAI GPT-4 Vision 사용
 * @param imagePath 이미지 파일 경로
 * @returns 추출된 텍스트
 */
export const extractTextFromImage = async (imagePath: string): Promise<string> => {
  try {
    // 파일 존재 확인
    await fs.access(imagePath);

    // OpenAI 클라이언트 가져오기
    const client = getOpenAIClient();

    // 이미지 파일을 Base64로 인코딩
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // 파일 확장자로 MIME 타입 결정
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // GPT-4 Vision API 호출
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 이미지에서 보이는 모든 텍스트를 정확하게 추출해주세요. 한글과 영어를 모두 인식하여 원본 그대로 추출하되, 다른 설명이나 해석은 하지 말고 텍스트만 출력해주세요.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1, // 낮은 temperature로 정확성 향상
    });

    const extractedText = response.choices[0]?.message?.content?.trim() || '';

    if (!extractedText) {
      console.log('[OCR] No text detected in image:', imagePath);
      return '';
    }

    console.log('[OCR] Text extracted:', extractedText.substring(0, 100) + '...');
    return extractedText;
  } catch (error: any) {
    console.error('[OCR] Error extracting text from image:', error);

    // OpenAI API 에러 처리
    if (error.status === 401) {
      throw new Error('OpenAI API 인증 실패. OPENAI_API_KEY를 확인하세요.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API 요청 한도 초과. 잠시 후 다시 시도하세요.');
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
 * 통합 태그 생성 (OCR + AI) - OpenAI Vision으로 한 번에 처리
 * - GPT-4 Vision으로 텍스트 추출과 태그 생성을 동시에 수행
 * - 이미지를 직접 분석하여 더 정확한 태그 생성
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
    // 파일 존재 확인
    await fs.access(imagePath);

    // OpenAI 클라이언트 가져오기
    const client = getOpenAIClient();

    // 이미지 파일을 Base64로 인코딩
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // 파일 확장자로 MIME 타입 결정
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // GPT-4 Vision으로 OCR + 태그 생성 동시에 수행
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 신한금융 광고 콘텐츠 관리 전문가입니다.
광고 이미지를 분석하여:
1. 이미지에서 보이는 모든 텍스트를 추출
2. **크게 보이거나 강조된 핵심 문구**만을 기반으로 정확히 5개의 태그를 생성

태그 생성 우선순위 (중요도 순):
1. **대형 헤드라인/메인 카피** - 가장 크고 눈에 띄는 텍스트 우선
2. **브랜드명** - 신한금융, 신한은행 등
3. **핵심 상품/서비스명** - 강조된 상품이나 서비스
4. **주요 혜택/특징** - 크게 표시된 수치나 혜택
5. **캠페인 키워드** - 강조된 이벤트나 주제

태그 생성 규칙:
- 정확히 5개만 생성 (많아도 적어도 안됨)
- 작은 글씨나 부가 설명은 무시
- 시각적으로 강조된 텍스트만 선택
- 간결하고 검색에 유용한 키워드로 변환
- 중요도가 높은 순서대로 정렬

출력 형식 (JSON):
{
  "text": "추출된 모든 텍스트",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 광고 이미지를 분석하여 텍스트를 추출하고, 크게 보이거나 강조된 핵심 문구에서 정확히 5개의 태그만 생성해주세요.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0.5,
    });

    const responseText = response.choices[0]?.message?.content?.trim();

    if (!responseText) {
      console.warn('[OCR + AI] No response from OpenAI');
      return { ocrText: '', tags: [] };
    }

    // JSON 파싱
    const result = JSON.parse(responseText);
    const ocrText = preprocessText(result.text || '');
    const tags = (result.tags || [])
      .filter((tag: string) => tag && tag.length > 0 && tag.length <= 50)
      .slice(0, 5); // 정확히 5개만 사용

    console.log('[OCR + AI] Text extracted:', ocrText.substring(0, 100) + '...');
    console.log('[OCR + AI] Tags generated (top 5):', tags);

    return { ocrText, tags };
  } catch (error: any) {
    console.error('[OCR + AI] Error:', error.message);

    // 에러 발생 시 기본 OCR만 시도
    try {
      const extractedText = await extractTextFromImage(imagePath);
      const ocrText = preprocessText(extractedText);
      const tags = extractTagsFromText(ocrText, 5); // 5개로 제한
      return { ocrText, tags };
    } catch (fallbackError: any) {
      console.error('[OCR + AI] Fallback also failed:', fallbackError.message);
      return { ocrText: '', tags: [] };
    }
  }
};
