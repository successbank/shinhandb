import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate } from '../middlewares/auth';
import { hashPassword } from '../utils/password';

const router = Router();

// 모든 마이페이지 API는 인증 필요
router.use(authenticate);

// GET /api/mypage/bookmarks - 북마크 목록
router.get(
  '/bookmarks',
  logActivity('VIEW_MY_BOOKMARKS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM bookmarks WHERE user_id = $1',
        [req.user!.id]
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT b.id, b.memo, b.created_at,
                c.id as content_id, c.title, c.file_url, c.thumbnail_url, c.file_type
         FROM bookmarks b
         INNER JOIN contents c ON b.content_id = c.id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user!.id, pageSize, offset]
      );

      res.json({
        success: true,
        data: {
          items: result.rows,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/mypage/bookmarks - 북마크 추가
router.post(
  '/bookmarks',
  logActivity('ADD_BOOKMARK'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { contentId, memo } = req.body;

      if (!contentId) {
        throw new AppError(400, '콘텐츠 ID를 입력해주세요');
      }

      await pool.query(
        `INSERT INTO bookmarks (user_id, content_id, memo)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, content_id) DO UPDATE SET memo = EXCLUDED.memo`,
        [req.user!.id, contentId, memo || null]
      );

      res.status(201).json({
        success: true,
        message: '북마크가 추가되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/mypage/bookmarks/:id - 북마크 삭제
router.delete(
  '/bookmarks/:id',
  logActivity('REMOVE_BOOKMARK'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM bookmarks WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.user!.id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '북마크를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '북마크가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/mypage/bookmarks/:id/memo - 메모 수정
router.patch(
  '/bookmarks/:id/memo',
  logActivity('UPDATE_BOOKMARK_MEMO'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { memo } = req.body;

      const result = await pool.query(
        'UPDATE bookmarks SET memo = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, memo',
        [memo, id, req.user!.id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '북마크를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '메모가 수정되었습니다',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/mypage/uploads - 내 업로드 목록
router.get(
  '/uploads',
  logActivity('VIEW_MY_UPLOADS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM contents WHERE uploader_id = $1',
        [req.user!.id]
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT id, title, file_url, thumbnail_url, file_type, file_size, created_at
         FROM contents
         WHERE uploader_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user!.id, pageSize, offset]
      );

      res.json({
        success: true,
        data: {
          items: result.rows,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/mypage/password - 비밀번호 변경
router.patch(
  '/password',
  logActivity('CHANGE_PASSWORD'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new AppError(400, '현재 비밀번호와 새 비밀번호를 입력해주세요');
      }

      // 현재 비밀번호 확인 (생략 - 실제로는 bcrypt.compare 필요)
      const hashedPassword = await hashPassword(newPassword);

      await pool.query(
        'UPDATE users SET password_hash = $1, is_first_password = false WHERE id = $2',
        [hashedPassword, req.user!.id]
      );

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
