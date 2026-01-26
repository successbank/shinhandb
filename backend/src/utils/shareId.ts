import crypto from 'crypto';

/**
 * URL-safe한 share_id 생성
 * - 길이: 12자
 * - 문자: 영문 대소문자 + 숫자 (URL-safe)
 * - crypto.randomBytes 기반
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateShareId(): string {
  const length = 12;
  const randomBytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomBytes[i] % ALPHABET.length];
  }

  return result;
}

/**
 * share_id 검증
 * - 길이: 4-20자 (관리자 URL 변경 규칙과 동일)
 * - 문자: 영문 대소문자 + 숫자만
 */
export function validateShareId(shareId: string): boolean {
  if (!shareId || typeof shareId !== 'string') {
    return false;
  }

  // 4-20자 영문+숫자만 (관리자 URL 변경 규칙과 동일)
  const validPattern = /^[A-Za-z0-9]{4,20}$/;
  return validPattern.test(shareId);
}
