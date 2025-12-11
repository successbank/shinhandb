import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { verifyToken } from '../utils/jwt';
import { AppError } from './errorHandler';
import { pool } from '../db';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, '인증 토큰이 필요합니다');
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      throw new AppError(401, '유효하지 않거나 만료된 토큰입니다');
    }

    // Fetch user from database
    const result = await pool.query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, '사용자를 찾을 수 없습니다');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError(403, '비활성화된 계정입니다');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, '인증에 실패했습니다'));
    }
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, '인증이 필요합니다'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, '접근 권한이 없습니다'));
    }

    next();
  };
};
