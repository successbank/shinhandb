import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { generateShareId, validateShareId } from '../utils/shareId';
import bcrypt from 'bcrypt';
import { redis } from '../services/cache.service';

const router = Router();

// 모든 관리자 API는 인증 및 ADMIN 권한 필요
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * POST /api/admin/external-shares
 * 외부공유 URL 생성
 */
router.post(
  '/',
  logActivity('CREATE_EXTERNAL_SHARE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    const client = await pool.connect();

    try {
      const { projectSelections, password, expiresAt } = req.body;

      // 입력 검증
      if (!projectSelections || !Array.isArray(projectSelections)) {
        throw new AppError(400, '프로젝트 선택 정보가 필요합니다');
      }

      if (projectSelections.length === 0) {
        throw new AppError(400, '최소 1개 이상의 프로젝트를 선택해주세요');
      }

      if (!password || typeof password !== 'string') {
        throw new AppError(400, '비밀번호를 입력해주세요');
      }

      // 비밀번호 검증 (4자리 숫자)
      if (!/^\d{4}$/.test(password)) {
        throw new AppError(400, '비밀번호는 4자리 숫자여야 합니다');
      }

      // projectSelections 검증
      for (const selection of projectSelections) {
        if (!selection.projectId || !selection.category || !selection.year || !selection.quarter) {
          throw new AppError(400, '프로젝트 선택 정보가 올바르지 않습니다');
        }

        if (!['holding', 'bank'].includes(selection.category)) {
          throw new AppError(400, '카테고리는 holding 또는 bank만 가능합니다');
        }

        if (!['1Q', '2Q', '3Q', '4Q'].includes(selection.quarter)) {
          throw new AppError(400, '분기는 1Q, 2Q, 3Q, 4Q만 가능합니다');
        }

        if (selection.year < 2020 || selection.year > 2099) {
          throw new AppError(400, '연도는 2020~2099 사이여야 합니다');
        }
      }

      // 만료일 검증
      let expiresAtDate: Date | null = null;
      if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          throw new AppError(400, '만료일 형식이 올바르지 않습니다');
        }
        if (expiresAtDate <= new Date()) {
          throw new AppError(400, '만료일은 현재 시간 이후여야 합니다');
        }
      }

      await client.query('BEGIN');

      // share_id 생성 (중복 체크)
      let shareId: string;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        shareId = generateShareId();
        const checkResult = await client.query(
          'SELECT id FROM external_shares WHERE share_id = $1',
          [shareId]
        );
        if (checkResult.rows.length === 0) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new AppError(500, '고유 ID 생성에 실패했습니다. 다시 시도해주세요');
      }

      // 비밀번호 해싱
      const passwordHash = await bcrypt.hash(password, 12);

      // external_shares 생성
      const shareResult = await client.query(
        `INSERT INTO external_shares (share_id, password_hash, is_active, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, share_id AS "shareId", is_active AS "isActive",
                   expires_at AS "expiresAt", created_at AS "createdAt",
                   view_count AS "viewCount"`,
        [shareId!, passwordHash, true, expiresAtDate, req.user!.id]
      );

      const share = shareResult.rows[0];

      // share_contents 생성 (배치 insert)
      const insertValues: any[] = [];
      const insertParams: any[] = [];
      let paramIndex = 1;

      for (let i = 0; i < projectSelections.length; i++) {
        const selection = projectSelections[i];

        // 프로젝트 존재 여부 확인
        const projectCheck = await client.query(
          'SELECT id FROM projects WHERE id = $1',
          [selection.projectId]
        );

        if (projectCheck.rows.length === 0) {
          throw new AppError(404, `프로젝트를 찾을 수 없습니다: ${selection.projectId}`);
        }

        insertValues.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
        );

        insertParams.push(
          share.id,
          selection.projectId,
          selection.category,
          selection.year,
          selection.quarter,
          i // display_order
        );
      }

      await client.query(
        `INSERT INTO share_contents (share_id, project_id, category, year, quarter, display_order)
         VALUES ${insertValues.join(', ')}`,
        insertParams
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          ...share,
          shareUrl: `/share/${share.shareId}`,
          projectCount: projectSelections.length,
        },
        message: '외부공유가 생성되었습니다',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/admin/external-shares
 * 외부공유 목록 조회
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const isActive = req.query.isActive;
      const isExpired = req.query.isExpired;

      let whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // ADMIN이 아닌 경우만 created_by 필터 적용
      if (req.user!.role !== 'ADMIN') {
        whereConditions.push(`created_by = $${paramIndex++}`);
        params.push(req.user!.id);
      }

      // 활성화 상태 필터
      if (isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        params.push(isActive === 'true');
      }

      // 만료 여부 필터
      if (isExpired === 'true') {
        whereConditions.push(`expires_at IS NOT NULL AND expires_at < NOW()`);
      } else if (isExpired === 'false') {
        whereConditions.push(`(expires_at IS NULL OR expires_at >= NOW())`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 총 개수 조회
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM external_shares ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // 목록 조회
      const result = await pool.query(
        `SELECT
           es.id,
           es.share_id AS "shareId",
           es.is_active AS "isActive",
           es.expires_at AS "expiresAt",
           es.created_at AS "createdAt",
           es.view_count AS "viewCount",
           es.last_accessed_at AS "lastAccessedAt",
           COUNT(DISTINCT sc.project_id) AS "projectCount"
         FROM external_shares es
         LEFT JOIN share_contents sc ON es.id = sc.share_id
         ${whereClause}
         GROUP BY es.id
         ORDER BY es.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/external-shares/:id
 * 외부공유 상세 조회
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 공유 정보 조회 (ADMIN은 모든 공유 조회 가능)
      const shareResult = await pool.query(
        `SELECT
           id,
           share_id AS "shareId",
           is_active AS "isActive",
           expires_at AS "expiresAt",
           created_at AS "createdAt",
           view_count AS "viewCount",
           last_accessed_at AS "lastAccessedAt"
         FROM external_shares
         WHERE id = $1`,
        [id]
      );

      if (shareResult.rows.length === 0) {
        throw new AppError(404, '외부공유를 찾을 수 없습니다');
      }

      const share = shareResult.rows[0];

      // 포함된 프로젝트 조회
      const contentsResult = await pool.query(
        `SELECT
           sc.id,
           sc.project_id AS "projectId",
           sc.category,
           sc.year,
           sc.quarter,
           sc.display_order AS "displayOrder",
           p.title AS "projectTitle",
           p.description AS "projectDescription"
         FROM share_contents sc
         JOIN projects p ON sc.project_id = p.id
         WHERE sc.share_id = $1
         ORDER BY sc.year DESC, sc.quarter, sc.display_order, sc.id ASC`,
        [share.id]
      );

      res.json({
        success: true,
        data: {
          ...share,
          shareUrl: `/share/${share.shareId}`,
          projects: contentsResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/external-shares/:id
 * 외부공유 수정 (비밀번호, 활성화 상태, 만료일, URL)
 */
router.patch(
  '/:id',
  logActivity('UPDATE_EXTERNAL_SHARE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { password, isActive, expiresAt, projectSelections, shareId: newShareId } = req.body;

      // 권한 확인 (ADMIN은 모든 공유 수정 가능)
      const checkResult = await pool.query(
        'SELECT id FROM external_shares WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new AppError(404, '외부공유를 찾을 수 없습니다');
      }

      // 기존 shareId 조회 (Redis 캐시 삭제용)
      const oldShareResult = await pool.query(
        'SELECT share_id FROM external_shares WHERE id = $1',
        [id]
      );
      const oldShareId = oldShareResult.rows[0]?.share_id;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // shareId (URL) 변경
      if (newShareId !== undefined && newShareId !== '' && newShareId !== oldShareId) {
        // 형식 검증 (영문+숫자만, 4-20자)
        if (!/^[A-Za-z0-9]{4,20}$/.test(newShareId)) {
          throw new AppError(400, 'URL은 4-20자의 영문과 숫자만 가능합니다');
        }

        // 중복 검사 (자기 자신 제외)
        const duplicateCheck = await pool.query(
          'SELECT id FROM external_shares WHERE share_id = $1 AND id != $2',
          [newShareId, id]
        );
        if (duplicateCheck.rows.length > 0) {
          throw new AppError(409, '이미 사용 중인 URL입니다');
        }

        updates.push(`share_id = $${paramIndex++}`);
        params.push(newShareId);
      }

      // 비밀번호 변경
      if (password !== undefined) {
        if (!/^\d{4}$/.test(password)) {
          throw new AppError(400, '비밀번호는 4자리 숫자여야 합니다');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        updates.push(`password_hash = $${paramIndex++}`);
        params.push(passwordHash);
      }

      // 활성화 상태 변경
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      // 만료일 변경
      if (expiresAt !== undefined) {
        if (expiresAt === null) {
          updates.push(`expires_at = NULL`);
        } else {
          const expiresAtDate = new Date(expiresAt);
          if (isNaN(expiresAtDate.getTime())) {
            throw new AppError(400, '만료일 형식이 올바르지 않습니다');
          }
          updates.push(`expires_at = $${paramIndex++}`);
          params.push(expiresAtDate);
        }
      }

      // 프로젝트 선택 수정
      if (projectSelections && Array.isArray(projectSelections)) {
        // 트랜잭션 시작
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // 기존 share_contents 삭제
          await client.query('DELETE FROM share_contents WHERE share_id = $1', [id]);

          // 새로운 프로젝트 추가
          if (projectSelections.length > 0) {
            const insertValues: string[] = [];
            const insertParams: any[] = [];
            let insertParamIndex = 1;

            for (let i = 0; i < projectSelections.length; i++) {
              const selection = projectSelections[i];

              // 프로젝트 존재 여부 확인
              const projectCheck = await client.query(
                'SELECT id FROM projects WHERE id = $1',
                [selection.projectId]
              );

              if (projectCheck.rows.length === 0) {
                throw new AppError(404, `프로젝트를 찾을 수 없습니다: ${selection.projectId}`);
              }

              insertValues.push(
                `($${insertParamIndex++}, $${insertParamIndex++}, $${insertParamIndex++}, $${insertParamIndex++}, $${insertParamIndex++}, $${insertParamIndex++})`
              );

              insertParams.push(
                id,
                selection.projectId,
                selection.category,
                selection.year,
                selection.quarter,
                selection.displayOrder ?? i // 명시적 값 우선, 없으면 인덱스
              );
            }

            await client.query(
              `INSERT INTO share_contents (share_id, project_id, category, year, quarter, display_order)
               VALUES ${insertValues.join(', ')}`,
              insertParams
            );
          }

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      // external_shares 테이블 업데이트
      if (updates.length > 0) {
        params.push(id);

        await pool.query(
          `UPDATE external_shares
           SET ${updates.join(', ')}, updated_at = NOW()
           WHERE id = $${paramIndex}`,
          params
        );
      }

      // 최종 결과 조회
      const finalResult = await pool.query(
        `SELECT id, share_id AS "shareId", is_active AS "isActive",
                expires_at AS "expiresAt", updated_at AS "updatedAt"
         FROM external_shares
         WHERE id = $1`,
        [id]
      );

      // Redis 캐시 삭제 (공유 페이지에 즉시 반영)
      if (finalResult.rows[0]) {
        const currentShareId = finalResult.rows[0].shareId;
        // 새 shareId 캐시 삭제
        await redis.del(`share_contents:${currentShareId}`);
        // 기존 shareId가 다른 경우 (URL 변경됨) 기존 캐시도 삭제
        if (oldShareId && oldShareId !== currentShareId) {
          await redis.del(`share_contents:${oldShareId}`);
        }
      }

      res.json({
        success: true,
        data: finalResult.rows[0],
        message: '외부공유가 수정되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/external-shares/:id
 * 외부공유 삭제
 */
router.delete(
  '/:id',
  logActivity('DELETE_EXTERNAL_SHARE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 삭제 전 share_id 조회 (캐시 삭제용)
      const shareInfo = await pool.query(
        'SELECT share_id FROM external_shares WHERE id = $1',
        [id]
      );
      const shareIdToDelete = shareInfo.rows[0]?.share_id;

      if (!shareIdToDelete) {
        throw new AppError(404, '외부공유를 찾을 수 없습니다');
      }

      // ADMIN은 모든 공유 삭제 가능, 일반 사용자는 자신이 만든 것만
      let deleteQuery = 'DELETE FROM external_shares WHERE id = $1';
      const deleteParams: any[] = [id];

      if (req.user!.role !== 'ADMIN') {
        deleteQuery += ' AND created_by = $2';
        deleteParams.push(req.user!.id);
      }

      deleteQuery += ' RETURNING id';

      const result = await pool.query(deleteQuery, deleteParams);

      if (result.rows.length === 0) {
        throw new AppError(404, '외부공유를 찾을 수 없거나 삭제 권한이 없습니다');
      }

      // Redis 캐시 삭제
      await redis.del(`share_contents:${shareIdToDelete}`);

      res.json({
        success: true,
        message: '외부공유가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/external-shares/:id/contents
 * 외부공유에 프로젝트 추가
 */
router.post(
  '/:id/contents',
  logActivity('ADD_SHARE_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { projectId, category, year, quarter } = req.body;

      // 권한 확인
      const shareCheck = await pool.query(
        'SELECT id FROM external_shares WHERE id = $1 AND created_by = $2',
        [id, req.user!.id]
      );

      if (shareCheck.rows.length === 0) {
        throw new AppError(404, '외부공유를 찾을 수 없습니다');
      }

      // 입력 검증
      if (!projectId || !category || !year || !quarter) {
        throw new AppError(400, '모든 필드를 입력해주세요');
      }

      if (!['holding', 'bank'].includes(category)) {
        throw new AppError(400, '카테고리는 holding 또는 bank만 가능합니다');
      }

      if (!['1Q', '2Q', '3Q', '4Q'].includes(quarter)) {
        throw new AppError(400, '분기는 1Q, 2Q, 3Q, 4Q만 가능합니다');
      }

      // 프로젝트 존재 확인
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectCheck.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      // 추가 (중복 시 UNIQUE 제약 조건 에러)
      const result = await pool.query(
        `INSERT INTO share_contents (share_id, project_id, category, year, quarter)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, project_id AS "projectId", category, year, quarter`,
        [id, projectId, category, year, quarter]
      );

      // share_id 조회 후 Redis 캐시 삭제
      const shareResult = await pool.query(
        'SELECT share_id FROM external_shares WHERE id = $1',
        [id]
      );
      if (shareResult.rows[0]) {
        await redis.del(`share_contents:${shareResult.rows[0].share_id}`);
      }

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: '프로젝트가 추가되었습니다',
      });
    } catch (error) {
      if ((error as any).code === '23505') {
        // UNIQUE 위반
        next(new AppError(409, '이미 추가된 프로젝트입니다'));
      } else {
        next(error);
      }
    }
  }
);

/**
 * DELETE /api/admin/external-shares/:id/contents/:contentId
 * 외부공유에서 프로젝트 제거
 */
router.delete(
  '/:id/contents/:contentId',
  logActivity('REMOVE_SHARE_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { id, contentId } = req.params;

      // 권한 확인
      const shareCheck = await pool.query(
        'SELECT id FROM external_shares WHERE id = $1 AND created_by = $2',
        [id, req.user!.id]
      );

      if (shareCheck.rows.length === 0) {
        throw new AppError(404, '외부공유를 찾을 수 없습니다');
      }

      const result = await pool.query(
        'DELETE FROM share_contents WHERE id = $1 AND share_id = $2 RETURNING id',
        [contentId, id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      // share_id 조회 후 Redis 캐시 삭제
      const shareResult = await pool.query(
        'SELECT share_id FROM external_shares WHERE id = $1',
        [id]
      );
      if (shareResult.rows[0]) {
        await redis.del(`share_contents:${shareResult.rows[0].share_id}`);
      }

      res.json({
        success: true,
        message: '프로젝트가 제거되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
