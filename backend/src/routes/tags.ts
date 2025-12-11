import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// 모든 태그 API는 인증 필요
router.use(authenticate);

// GET /api/tags - 태그 목록 조회
router.get(
  '/',
  logActivity('VIEW_TAGS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      let query = 'SELECT id, name, usage_count, created_at FROM tags';
      let params: any[] = [];

      if (search) {
        query += ' WHERE name ILIKE $1';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY usage_count DESC, name ASC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: {
          items: result.rows,
          total: result.rows.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tags/popular - 인기 태그 조회
router.get(
  '/popular',
  logActivity('VIEW_POPULAR_TAGS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await pool.query(
        `SELECT id, name, usage_count, created_at
         FROM tags
         WHERE usage_count > 0
         ORDER BY usage_count DESC, created_at DESC
         LIMIT $1`,
        [limit]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/tags - 태그 생성 (Admin only)
router.post(
  '/',
  authorize('ADMIN'),
  logActivity('CREATE_TAG'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        throw new AppError(400, '태그 이름을 입력해주세요');
      }

      // 태그 생성 또는 기존 태그 반환
      const result = await pool.query(
        `INSERT INTO tags (name, usage_count) VALUES ($1, 0)
         ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
         RETURNING id, name, usage_count, created_at`,
        [name.trim()]
      );

      res.status(201).json({
        success: true,
        message: '태그가 생성되었습니다',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/tags/:id - 태그 수정 (Admin only)
router.patch(
  '/:id',
  authorize('ADMIN'),
  logActivity('UPDATE_TAG'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        throw new AppError(400, '태그 이름을 입력해주세요');
      }

      const result = await pool.query(
        `UPDATE tags SET name = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, usage_count, created_at, updated_at`,
        [name.trim(), id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '태그를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '태그가 수정되었습니다',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/tags/:id - 태그 삭제 (Admin only)
router.delete(
  '/:id',
  authorize('ADMIN'),
  logActivity('DELETE_TAG'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 태그 사용 여부 확인
      const usageResult = await pool.query(
        'SELECT COUNT(*) FROM content_tags WHERE tag_id = $1',
        [id]
      );

      const usageCount = parseInt(usageResult.rows[0].count);

      if (usageCount > 0) {
        throw new AppError(
          400,
          `이 태그는 ${usageCount}개의 콘텐츠에서 사용 중이므로 삭제할 수 없습니다`
        );
      }

      const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        throw new AppError(404, '태그를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '태그가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/tags/content/:contentId - 콘텐츠에 태그 추가
router.post(
  '/content/:contentId',
  logActivity('ADD_TAG_TO_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { contentId } = req.params;
      const { tagName } = req.body;

      if (!tagName || tagName.trim().length === 0) {
        throw new AppError(400, '태그 이름을 입력해주세요');
      }

      // 콘텐츠 존재 확인
      const contentCheck = await pool.query('SELECT id FROM contents WHERE id = $1', [
        contentId,
      ]);

      if (contentCheck.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      // 태그 생성 또는 가져오기
      const tagResult = await pool.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET usage_count = tags.usage_count + 1
         RETURNING id`,
        [tagName.trim()]
      );

      const tagId = tagResult.rows[0].id;

      // 콘텐츠-태그 연결
      await pool.query(
        `INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [contentId, tagId]
      );

      res.json({
        success: true,
        message: '태그가 추가되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/tags/content/:contentId/:tagId - 콘텐츠에서 태그 제거
router.delete(
  '/content/:contentId/:tagId',
  logActivity('REMOVE_TAG_FROM_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { contentId, tagId } = req.params;

      const result = await pool.query(
        'DELETE FROM content_tags WHERE content_id = $1 AND tag_id = $2 RETURNING *',
        [contentId, tagId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '태그 연결을 찾을 수 없습니다');
      }

      // 태그 사용 횟수 감소
      await pool.query(
        'UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1',
        [tagId]
      );

      res.json({
        success: true,
        message: '태그가 제거되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
