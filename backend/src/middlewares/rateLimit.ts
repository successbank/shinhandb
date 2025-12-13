import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface LoginAttempt {
  count: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

export const loginRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const identifier = req.body.username || req.ip;

  if (!identifier) {
    return next();
  }

  const attempt = loginAttempts.get(identifier);

  if (attempt) {
    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const remainingTime = Math.ceil((attempt.lockedUntil - Date.now()) / 1000 / 60);
      throw new AppError(
        429,
        `계정이 잠겼습니다. ${remainingTime}분 후에 다시 시도해주세요.`
      );
    }

    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      loginAttempts.delete(identifier);
    }
  }

  next();
};

export const recordLoginFailure = (identifier: string) => {
  const attempt = loginAttempts.get(identifier) || { count: 0 };

  attempt.count += 1;

  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOCK_TIME;
  }

  loginAttempts.set(identifier, attempt);
};

export const clearLoginAttempts = (identifier: string) => {
  loginAttempts.delete(identifier);
};
