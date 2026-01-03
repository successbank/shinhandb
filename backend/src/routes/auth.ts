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
      const { username, password } = req.body;

      if (!username || !password) {
        throw new AppError(400, '아이디와 비밀번호를 입력해주세요');
      }

      const result = await pool.query(
        'SELECT id, username, name, password, role, is_active FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        recordLoginFailure(username);
        throw new AppError(401, '아이디 또는 비밀번호가 올바르지 않습니다');
      }

      const user = result.rows[0];

      if (!user.is_active) {
        throw new AppError(403, '비활성화된 계정입니다');
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        recordLoginFailure(username);
        throw new AppError(401, '아이디 또는 비밀번호가 올바르지 않습니다');
      }

      clearLoginAttempts(username);

      const token = generateToken(user);

      const { password: _, ...userWithoutPassword } = user;

      // 로그인 성공 활동 로그 기록
      try {
        await pool.query(
          `INSERT INTO activity_logs (user_id, action_type, ip_address, details, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [
            user.id,
            'LOGIN',
            req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
            JSON.stringify({
              username: user.username,
              userAgent: req.headers['user-agent'] || 'Unknown',
              timestamp: new Date().toISOString(),
            }),
          ]
        );
      } catch (logError) {
        console.error('[Login] Failed to log activity:', logError);
        // 활동 로그 실패해도 로그인은 성공 처리
      }

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
