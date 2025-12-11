import { Router, Request, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import {
  loginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
} from '../middlewares/rateLimit';
import { logActivity } from '../middlewares/activityLog';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Login
router.post(
  '/login',
  loginRateLimit,
  logActivity('LOGIN_ATTEMPT'),
  async (req: Request, res: Response<ApiResponse>, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError(400, '이메일과 비밀번호를 입력해주세요');
      }

      const result = await pool.query(
        'SELECT id, email, name, password, role, is_active FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        recordLoginFailure(email);
        throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
      }

      const user = result.rows[0];

      if (!user.is_active) {
        throw new AppError(403, '비활성화된 계정입니다');
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        recordLoginFailure(email);
        throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
      }

      clearLoginAttempts(email);

      const token = generateToken(user);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: '로그인에 성공했습니다',
        data: {
          token,
          user: userWithoutPassword,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post(
  '/logout',
  authenticate,
  logActivity('LOGOUT'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    res.json({
      success: true,
      message: '로그아웃 되었습니다',
    });
  }
);

// Get current user
router.get(
  '/me',
  authenticate,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { password: _, ...userWithoutPassword } = req.user!;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  }
);

// Change password
router.post(
  '/change-password',
  authenticate,
  logActivity('CHANGE_PASSWORD'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new AppError(400, '현재 비밀번호와 새 비밀번호를 입력해주세요');
      }

      const result = await pool.query(
        'SELECT password FROM users WHERE id = $1',
        [req.user!.id]
      );

      const isPasswordValid = await comparePassword(
        currentPassword,
        result.rows[0].password
      );

      if (!isPasswordValid) {
        throw new AppError(401, '현재 비밀번호가 올바르지 않습니다');
      }

      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [
        hashedPassword,
        req.user!.id,
      ]);

      res.json({
        success: true,
        message: '비밀번호가 변경되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
