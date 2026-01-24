import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { getCache, setCache, deleteCache, CacheKeys, CacheTTL } from '../services/cache.service';

const router = Router();

// 모든 카테고리 API는 인증 필요
router.use(authenticate);

// GET /api/categories - 카테고리 목록 조회 (캐싱 적용)
// 사용자 역할에 따른 자동 필터링:
// - BANK: 신한은행 카테고리만
// - HOLDING: 신한금융지주 카테고리만
// - CLIENT, ADMIN: 전체 카테고리
router.get(
  '/',
  logActivity('VIEW_CATEGORIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      // 명시적 파라미터 확인
      let memberType = req.query.memberType as string | undefined;

      // 명시적 파라미터가 없으면 사용자 역할에 따라 자동 설정
      if (!memberType && req.user) {
        const userRole = req.user.role;
        if (userRole === 'BANK') {
          memberType = 'BANK';  // 신한은행 → 은행 카테고리만
        } else if (userRole === 'HOLDING') {
          memberType = 'HOLDING';  // 신한금융지주 → 지주 카테고리만
        }
        // CLIENT, ADMIN → memberType 없음 → 전체 반환
      }

      const cacheKey = memberType
        ? CacheKeys.categories(memberType)
        : CacheKeys.categories('all');

      // 캐시 확인
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log('[Categories] Cache hit:', cacheKey);
        return res.json(cached);
      }

      console.log('[Categories] Cache miss, querying DB:', cacheKey);

      let query = `
        SELECT
          c.id,
          c.name,
          c.user_role,
          c.parent_id,
          c."order",
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT cc.content_id) as content_count,
          COUNT(DISTINCT pc.project_id) as project_count
        FROM categories c
        LEFT JOIN content_categories cc ON c.id = cc.category_id
        LEFT JOIN project_categories pc ON c.id = pc.category_id
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
        content_count: parseInt(row.content_count) || 0,
        project_count: parseInt(row.project_count) || 0
      }));

      // 전체 콘텐츠 수 및 프로젝트 수 계산 (중복 제거)
      const totalCountResult = await pool.query(
        'SELECT COUNT(DISTINCT id) as total FROM contents'
      );
      const totalContentCount = parseInt(totalCountResult.rows[0].total) || 0;

      const totalProjectCountResult = await pool.query(
        'SELECT COUNT(DISTINCT id) as total FROM projects'
      );
      const totalProjectCount = parseInt(totalProjectCountResult.rows[0].total) || 0;

      // 그룹별 유니크 프로젝트 수 (중복 제거)
      const groupCountResult = await pool.query(`
        SELECT c.user_role, COUNT(DISTINCT pc.project_id) as project_count
        FROM project_categories pc
        INNER JOIN categories c ON pc.category_id = c.id
        GROUP BY c.user_role
      `);
      const holdingProjectCount = parseInt(groupCountResult.rows.find((r: any) => r.user_role === 'HOLDING')?.project_count || '0');
      const bankProjectCount = parseInt(groupCountResult.rows.find((r: any) => r.user_role === 'BANK')?.project_count || '0');

      const response = {
        success: true,
        data: categories, // flat 배열로 반환
        meta: {
          totalContentCount,
          totalProjectCount,
          holdingProjectCount,
          bankProjectCount,
        },
      };

      // 캐시 저장 (1시간)
      await setCache(cacheKey, response, CacheTTL.categories);

      res.json(response);
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

      // 캐시 무효화
      await deleteCache(CacheKeys.categories(memberType));
      await deleteCache(CacheKeys.categories('all'));

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

      // 캐시 무효화
      await deleteCache(CacheKeys.categories(result.rows[0].user_role));
      await deleteCache(CacheKeys.categories('all'));

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

      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id, user_role', [id]);

      if (result.rows.length === 0) {
        throw new AppError(404, '카테고리를 찾을 수 없습니다');
      }

      // 캐시 무효화
      await deleteCache(CacheKeys.categories(result.rows[0].user_role));
      await deleteCache(CacheKeys.categories('all'));

      res.json({
        success: true,
        message: '카테고리가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/categories/reorder - 카테고리 순서 일괄 변경 (드래그 앤 드롭)
router.put(
  '/reorder',
  authorize('ADMIN'),
  logActivity('REORDER_CATEGORIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { items } = req.body;

      // 입력 검증
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError(400, '변경할 카테고리 순서 정보를 입력해주세요');
      }

      // 모든 항목에 id와 order가 있는지 확인
      for (const item of items) {
        if (!item.id || item.order === undefined) {
          throw new AppError(400, '각 항목에 id와 order가 필요합니다');
        }
      }

      // 트랜잭션으로 일괄 업데이트
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of items) {
          await client.query(
            'UPDATE categories SET "order" = $1, updated_at = NOW() WHERE id = $2',
            [item.order, item.id]
          );
        }

        await client.query('COMMIT');

        // 캐시 무효화
        await deleteCache(CacheKeys.categories('HOLDING'));
        await deleteCache(CacheKeys.categories('BANK'));
        await deleteCache(CacheKeys.categories('all'));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      res.json({
        success: true,
        message: `${items.length}개 카테고리의 순서가 변경되었습니다`,
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
