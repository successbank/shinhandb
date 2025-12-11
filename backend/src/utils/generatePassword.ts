/**
 * 초기 비밀번호 자동 생성 유틸리티
 * - 영문 대소문자, 숫자, 특수문자 조합
 * - 최소 12자리 길이
 */

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*';

/**
 * 안전한 랜덤 비밀번호 생성
 * @param length 비밀번호 길이 (기본값: 12)
 * @returns 랜덤 비밀번호
 */
export const generateRandomPassword = (length: number = 12): string => {
  if (length < 8) {
    throw new Error('비밀번호 길이는 최소 8자 이상이어야 합니다');
  }

  const allChars = LOWERCASE + UPPERCASE + NUMBERS + SYMBOLS;
  let password = '';

  // 각 문자 유형에서 최소 1개씩 보장
  password += LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)];
  password += UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)];
  password += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  password += SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  // 나머지 길이만큼 랜덤 문자 추가
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // 비밀번호 문자 순서 섞기 (Fisher-Yates 알고리즘)
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
};
