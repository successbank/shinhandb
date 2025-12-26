import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/cache.service';
import { AppError } from './errorHandler';

/**
 * 외부공유 비밀번호 인증 Rate Limiting
 * - IP 기반 제한
 * - 5회 실패 시 30분 차단
 * - Redis에 실패 카운트 저장
 */

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 30 * 60; // 30분 (초 단위)
const ATTEMPT_WINDOW = 30 * 60; // 30분 윈도우

/**
 * 실패 카운트 증가
 */
export async function incrementFailedAttempts(
  ip: string,
  shareId: string
): Promise<number> {
  const key = `share_auth_fail:${shareId}:${ip}`;
  const current = await redis.incr(key);

  // 첫 번째 실패일 경우 TTL 설정
  if (current === 1) {
    await redis.expire(key, ATTEMPT_WINDOW);
  }

  return current;
}

/**
 * 실패 카운트 초기화 (성공 시)
 */
export async function resetFailedAttempts(
  ip: string,
  shareId: string
): Promise<void> {
  const key = `share_auth_fail:${shareId}:${ip}`;
  await redis.del(key);
}

/**
 * 차단 상태 확인
 */
export async function isBlocked(ip: string, shareId: string): Promise<boolean> {
  const blockKey = `share_auth_block:${shareId}:${ip}`;
  const blocked = await redis.get(blockKey);
  return blocked === '1';
}

/**
 * IP 차단
 */
export async function blockIP(ip: string, shareId: string): Promise<void> {
  const blockKey = `share_auth_block:${shareId}:${ip}`;
  await redis.setex(blockKey, BLOCK_DURATION, '1');
}

/**
 * 실패 카운트 조회
 */
export async function getFailedAttempts(
  ip: string,
  shareId: string
): Promise<number> {
  const key = `share_auth_fail:${shareId}:${ip}`;
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Rate Limiting 미들웨어
 */
export async function shareAuthRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const shareId = req.params.shareId;

    if (!shareId) {
      return next();
    }

    // 차단 상태 확인
    const blocked = await isBlocked(ip, shareId);
    if (blocked) {
      throw new AppError(
        429,
        '너무 많은 시도로 인해 일시적으로 차단되었습니다. 30분 후 다시 시도해주세요.'
      );
    }

    // 실패 카운트 확인
    const failCount = await getFailedAttempts(ip, shareId);
    if (failCount >= MAX_ATTEMPTS) {
      // 차단 처리
      await blockIP(ip, shareId);
      throw new AppError(
        429,
        '비밀번호 입력 횟수를 초과했습니다. 30분 후 다시 시도해주세요.'
      );
    }

    // 남은 시도 횟수를 response에 추가
    res.locals.remainingAttempts = MAX_ATTEMPTS - failCount;

    next();
  } catch (error) {
    next(error);
  }
}
