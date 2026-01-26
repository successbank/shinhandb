import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { validateShareId } from '../utils/shareId';
import {
  shareAuthRateLimit,
  incrementFailedAttempts,
  resetFailedAttempts,
  getFailedAttempts,
} from '../middlewares/shareRateLimit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { redis } from '../services/cache.service';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30m'; // 30분

/**
 * POST /api/public/share/:shareId/verify
 * 비밀번호 검증 및 JWT 토큰 발급
 */
router.post(
  '/:shareId/verify',
  shareAuthRateLimit,
  async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    const client = await pool.connect();

    try {
      const { shareId } = req.params;
      const { password } = req.body;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || '';

      // shareId 검증
      if (!validateShareId(shareId)) {
        throw new AppError(400, '올바르지 않은 공유 ID입니다');
      }

      // 비밀번호 검증
      if (!password || !/^\d{4}$/.test(password)) {
        throw new AppError(400, '비밀번호는 4자리 숫자여야 합니다');
      }

      // 공유 정보 조회
      const shareResult = await client.query(
        `SELECT id, share_id, password_hash, is_active, expires_at
         FROM external_shares
         WHERE share_id = $1`,
        [shareId]
      );

      if (shareResult.rows.length === 0) {
        // 접근 로그 기록 (실패)
        await client.query(
          `INSERT INTO share_access_logs (share_id, ip_address, user_agent, success)
           SELECT id, $2, $3, false FROM external_shares WHERE share_id = $1`,
          [shareId, ip, userAgent]
        );
        throw new AppError(404, '존재하지 않는 공유 링크입니다');
      }

      const share = shareResult.rows[0];

      // 활성화 상태 확인
      if (!share.is_active) {
        await client.query(
          `INSERT INTO share_access_logs (share_id, ip_address, user_agent, success)
           VALUES ($1, $2, $3, false)`,
          [share.id, ip, userAgent]
        );
        throw new AppError(403, '비활성화된 공유 링크입니다');
      }

      // 만료 확인
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        await client.query(
          `INSERT INTO share_access_logs (share_id, ip_address, user_agent, success)
           VALUES ($1, $2, $3, false)`,
          [share.id, ip, userAgent]
        );
        throw new AppError(403, '만료된 공유 링크입니다');
      }

      // 비밀번호 검증
      const passwordMatch = await bcrypt.compare(password, share.password_hash);

      if (!passwordMatch) {
        // 실패 카운트 증가
        const failCount = await incrementFailedAttempts(ip, shareId);

        // 접근 로그 기록 (실패)
        await client.query(
          `INSERT INTO share_access_logs (share_id, ip_address, user_agent, success)
           VALUES ($1, $2, $3, false)`,
          [share.id, ip, userAgent]
        );

        const remainingAttempts = 5 - failCount;

        throw new AppError(
          401,
          `비밀번호가 일치하지 않습니다. (남은 시도: ${remainingAttempts}회)`
        );
      }

      // 성공: 실패 카운트 초기화
      await resetFailedAttempts(ip, shareId);

      // 접근 로그 기록 (성공)
      await client.query(
        `INSERT INTO share_access_logs (share_id, ip_address, user_agent, success)
         VALUES ($1, $2, $3, true)`,
        [share.id, ip, userAgent]
      );

      // 조회수 및 마지막 접근 시간 업데이트
      await client.query(
        `UPDATE external_shares
         SET view_count = view_count + 1,
             last_accessed_at = NOW()
         WHERE id = $1`,
        [share.id]
      );

      // JWT 토큰 생성
      const token = jwt.sign(
        {
          shareId: share.share_id,
          shareUUID: share.id,
          type: 'external_share',
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        data: {
          token,
          expiresIn: 1800, // 30분 (초 단위)
        },
        message: '인증에 성공했습니다',
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * JWT 토큰 검증 미들웨어 (외부공유 전용)
 */
async function verifyShareToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, '인증이 필요합니다');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (decoded.type !== 'external_share') {
        throw new AppError(401, '올바르지 않은 토큰입니다');
      }

      // shareId 일치 확인
      if (decoded.shareId !== req.params.shareId) {
        throw new AppError(403, '접근 권한이 없습니다');
      }

      // res.locals에 저장
      res.locals.shareUUID = decoded.shareUUID;
      res.locals.shareId = decoded.shareId;

      next();
    } catch (jwtError) {
      if ((jwtError as any).name === 'TokenExpiredError') {
        throw new AppError(401, '토큰이 만료되었습니다. 다시 로그인해주세요');
      } else if ((jwtError as any).name === 'JsonWebTokenError') {
        throw new AppError(401, '올바르지 않은 토큰입니다');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/public/share/:shareId/contents
 * 공유된 콘텐츠 목록 조회 (타임라인 형식)
 */
router.get(
  '/:shareId/contents',
  verifyShareToken,
  async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { shareId } = req.params;
      const shareUUID = res.locals.shareUUID;

      // Redis 캐싱 (30분)
      const cacheKey = `share_contents:${shareId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
        });
      }

      // 공유 활성화 및 만료 확인
      const shareCheck = await pool.query(
        `SELECT is_active, expires_at FROM external_shares WHERE id = $1`,
        [shareUUID]
      );

      if (shareCheck.rows.length === 0) {
        throw new AppError(404, '공유 링크를 찾을 수 없습니다');
      }

      const share = shareCheck.rows[0];

      if (!share.is_active) {
        throw new AppError(403, '비활성화된 공유 링크입니다');
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        throw new AppError(403, '만료된 공유 링크입니다');
      }

      // 콘텐츠 조회 (프로젝트 + 파일 정보)
      const contentsResult = await pool.query(
        `SELECT
           sc.category,
           sc.year,
           sc.quarter,
           sc.display_order,
           p.id AS "projectId",
           p.title AS "projectTitle",
           p.description AS "projectDescription",
           p.created_at AS "projectCreatedAt",
           -- 프로젝트의 첫 번째 파일 썸네일 (대표 이미지)
           (
             SELECT thumbnail_url
             FROM contents
             WHERE project_id = p.id
             ORDER BY created_at
             LIMIT 1
           ) AS "thumbnailUrl",
           -- 프로젝트의 파일 개수
           (
             SELECT COUNT(*)
             FROM contents
             WHERE project_id = p.id
           ) AS "fileCount"
         FROM share_contents sc
         JOIN projects p ON sc.project_id = p.id
         WHERE sc.share_id = $1
         ORDER BY sc.year DESC, sc.quarter, sc.display_order`,
        [shareUUID]
      );

      // 타임라인 형식으로 변환
      const timeline: any = {
        holding: {},
        bank: {},
      };

      for (const row of contentsResult.rows) {
        const { category, year, quarter } = row;

        if (!timeline[category][year]) {
          timeline[category][year] = {};
        }

        if (!timeline[category][year][quarter]) {
          timeline[category][year][quarter] = [];
        }

        timeline[category][year][quarter].push({
          projectId: row.projectId,
          title: row.projectTitle,
          description: row.projectDescription,
          thumbnailUrl: row.thumbnailUrl,
          fileCount: parseInt(row.fileCount, 10),
          createdAt: row.projectCreatedAt,
          displayOrder: row.display_order,
        });
      }

      // 빈 카테고리 제거
      if (Object.keys(timeline.holding).length === 0) {
        delete timeline.holding;
      }
      if (Object.keys(timeline.bank).length === 0) {
        delete timeline.bank;
      }

      const responseData = {
        shareId,
        timeline,
      };

      // 캐싱 (30분)
      await redis.setex(cacheKey, 1800, JSON.stringify(responseData));

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/public/share/:shareId/project/:projectId
 * 특정 프로젝트 상세 조회 (외부공유용)
 */
router.get(
  '/:shareId/project/:projectId',
  verifyShareToken,
  async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { shareId, projectId } = req.params;
      const shareUUID = res.locals.shareUUID;

      // 해당 프로젝트가 이 공유에 포함되어 있는지 확인
      const accessCheck = await pool.query(
        `SELECT sc.id
         FROM share_contents sc
         WHERE sc.share_id = $1 AND sc.project_id = $2`,
        [shareUUID, projectId]
      );

      if (accessCheck.rows.length === 0) {
        throw new AppError(403, '이 프로젝트에 접근할 수 없습니다');
      }

      // 프로젝트 상세 정보 조회
      const projectResult = await pool.query(
        `SELECT
           p.id,
           p.title,
           p.description,
           p.created_at AS "createdAt",
           p.updated_at AS "updatedAt"
         FROM projects p
         WHERE p.id = $1`,
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 프로젝트의 파일 목록 조회
      const filesResult = await pool.query(
        `SELECT
           id,
           title,
           file_url AS "fileUrl",
           file_type AS "fileType",
           file_size AS "fileSize",
           thumbnail_url AS "thumbnailUrl",
           file_type_flag AS "fileTypeFlag",
           created_at AS "createdAt"
         FROM contents
         WHERE project_id = $1
         ORDER BY file_type_flag NULLS LAST, created_at`,
        [projectId]
      );

      // 파일 타입별 그룹화
      const proposalDrafts = filesResult.rows.filter(
        (f) => f.fileTypeFlag === 'PROPOSAL_DRAFT'
      );
      const finalManuscripts = filesResult.rows.filter(
        (f) => f.fileTypeFlag === 'FINAL_MANUSCRIPT'
      );

      res.json({
        success: true,
        data: {
          ...project,
          proposalDrafts,
          finalManuscripts,
          totalFiles: filesResult.rows.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
