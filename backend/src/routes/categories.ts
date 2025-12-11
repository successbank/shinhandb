import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// 모든 카테고리 API는 인증 필요
router.use(authenticate);

// GET /api/categories - 카테고리 목록 조회
router.get(
  '/',
  logActivity('VIEW_CATEGORIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const memberType = req.query.memberType as string | undefined;

      let query = `
        SELECT
          c.id,
          c.name,
          c.user_role,
          c.parent_id,
          c."order",
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT cc.content_id) as content_count
        FROM categories c
        LEFT JOIN content_categories cc ON c.id = cc.category_id
      `;
      const params: any[] = [];

      if (memberType) {
        query += ' WHERE c.user_role = $1';
        params.push(memberType);
      }

      query += ' GROUP BY c.id, c.name, c.user_role, c.parent_id, c."order", c.created_at, c.updated_at';
      query += ' ORDER BY c."order" ASC, c.name ASC';

      const result = await pool.query(query, params);

      // 카테고리 데이터 정리 (flat 배열로 반환 - 프론트엔드에서 계층 구조 생성)
      const categories = result.rows.map(row => ({
        ...row,
        content_count: parseInt(row.content_count) || 0
      }));

      // 전체 콘텐츠 수 계산 (중복 제거)
      const totalCountResult = await pool.query(
        'SELECT COUNT(DISTINCT id) as total FROM contents'
      );
      const totalContentCount = parseInt(totalCountResult.rows[0].total) || 0;

      res.json({
        success: true,
        data: categories, // flat 배열로 반환
        meta: {
          totalContentCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/categories - 카테고리 생성 (Admin only)
router.post(
  '/',
  authorize('ADMIN'),
  logActivity('CREATE_CATEGORY'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { name, memberType, parentId, sortOrder } = req.body;

      if (!name || !memberType) {
        throw new AppError(400, '카테고리 이름과 회원 유형을 입력해주세요');
      }

      // 회원 유형 검증
      const validMemberTypes = ['HOLDING', 'BANK'];
      if (!validMemberTypes.includes(memberType)) {
        throw new AppError(400, '유효하지 않은 회원 유형입니다');
      }

      // 부모 카테고리 존재 확인
      if (parentId) {
        const parentCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [
          parentId,
        ]);
        if (parentCheck.rows.length === 0) {
          throw new AppError(404, '부모 카테고리를 찾을 수 없습니다');
        }
      }

      const result = await pool.query(
        `INSERT INTO categories (name, user_role, parent_id, "order")
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, user_role, parent_id, "order", created_at`,
        [name, memberType, parentId || null, sortOrder || 0]
      );

      res.status(201).json({
        success: true,
        message: '카테고리가 생성되었습니다',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/categories/:id - 카테고리 수정 (Admin only)
router.patch(
  '/:id',
  authorize('ADMIN'),
  logActivity('UPDATE_CATEGORY'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { name, sortOrder } = req.body;

      if (!name && sortOrder === undefined) {
        throw new AppError(400, '수정할 정보를 입력해주세요');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (sortOrder !== undefined) {
        updates.push(`"order" = $${paramIndex}`);
        params.push(sortOrder);
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await pool.query(
        `UPDATE categories SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, user_role, parent_id, "order", created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '카테고리를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '카테고리가 수정되었습니다',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/categories/:id - 카테고리 삭제 (Admin only)
router.delete(
  '/:id',
  authorize('ADMIN'),
  logActivity('DELETE_CATEGORY'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 자식 카테고리 확인
      const childrenCheck = await pool.query(
        'SELECT COUNT(*) FROM categories WHERE parent_id = $1',
        [id]
      );

      if (parseInt(childrenCheck.rows[0].count) > 0) {
        throw new AppError(400, '하위 카테고리가 있는 카테고리는 삭제할 수 없습니다');
      }

      // 카테고리 사용 여부 확인
      const usageCheck = await pool.query(
        'SELECT COUNT(*) FROM contents WHERE category_id = $1',
        [id]
      );

      if (parseInt(usageCheck.rows[0].count) > 0) {
        throw new AppError(
          400,
          `이 카테고리는 ${usageCheck.rows[0].count}개의 콘텐츠에서 사용 중이므로 삭제할 수 없습니다`
        );
      }

      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        throw new AppError(404, '카테고리를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: '카테고리가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/categories/init - 기본 카테고리 초기화 (Admin only)
router.post(
  '/init',
  authorize('ADMIN'),
  logActivity('INIT_CATEGORIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      // 신한금융지주 기본 카테고리
      const holdingCategories = ['CSR', '브랜드', '스포츠', '기타'];

      // 신한은행 기본 카테고리
      const bankCategories = ['브랜드 PR', '상품&서비스', '땡겨요', '기타'];

      let created = 0;

      for (let i = 0; i < holdingCategories.length; i++) {
        await pool.query(
          `INSERT INTO categories (name, user_role, "order")
           VALUES ($1, 'HOLDING', $2)
           ON CONFLICT DO NOTHING`,
          [holdingCategories[i], i]
        );
        created++;
      }

      for (let i = 0; i < bankCategories.length; i++) {
        await pool.query(
          `INSERT INTO categories (name, user_role, "order")
           VALUES ($1, 'BANK', $2)
           ON CONFLICT DO NOTHING`,
          [bankCategories[i], i]
        );
        created++;
      }

      res.json({
        success: true,
        message: `${created}개의 기본 카테고리가 생성되었습니다`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
