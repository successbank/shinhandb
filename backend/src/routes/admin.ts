import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { getCache, setCache, getCacheStats, CacheKeys, CacheTTL } from '../services/cache.service';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// 모든 관리자 API는 인증 및 ADMIN 권한 필요
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /api/admin/dashboard/stats - 대시보드 통계
 * - 총 사용자, 콘텐츠, 카테고리, 태그 수
 * - 최근 7일간 업로드 수
 * - 파일 유형별 분포
 * - 회원 유형별 콘텐츠 수
 */
router.get(
  '/dashboard/stats',
  logActivity('VIEW_DASHBOARD_STATS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const cacheKey = CacheKeys.stats('dashboard');

      // 캐시 확인 (30분)
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log('[Dashboard] Cache hit:', cacheKey);
        return res.json(cached);
      }

      console.log('[Dashboard] Cache miss, querying DB:', cacheKey);

      // 1. 기본 통계
      const basicStats = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM contents) as total_contents,
          (SELECT COUNT(*) FROM categories) as total_categories,
          (SELECT COUNT(*) FROM tags) as total_tags,
          (SELECT COUNT(*) FROM bookmarks) as total_bookmarks
      `);

      // 2. 최근 7일간 업로드 수 (일별)
      const recentUploads = await pool.query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM contents
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // 3. 파일 유형별 분포
      const fileTypeDistribution = await pool.query(`
        SELECT
          file_type,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM contents
        GROUP BY file_type
        ORDER BY count DESC
      `);

      // 4. 회원 유형별 콘텐츠 수
      const contentsByRole = await pool.query(`
        SELECT
          u.role,
          COUNT(c.id) as count
        FROM users u
        LEFT JOIN contents c ON u.id = c.uploader_id
        GROUP BY u.role
        ORDER BY count DESC
      `);

      // 5. 최근 활동 (10개)
      const recentActivities = await pool.query(`
        SELECT
          al.id,
          al.action_type,
          al.created_at,
          al.ip_address,
          u.name as user_name,
          u.role as user_role
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `);

      // 6. 인기 콘텐츠 (북마크 수 기준)
      const popularContents = await pool.query(`
        SELECT
          c.id,
          c.title,
          c.thumbnail_url,
          c.created_at,
          COUNT(b.id) as bookmark_count,
          u.name as uploader_name
        FROM contents c
        LEFT JOIN bookmarks b ON c.id = b.content_id
        LEFT JOIN users u ON c.uploader_id = u.id
        GROUP BY c.id, c.title, c.thumbnail_url, c.created_at, u.name
        ORDER BY bookmark_count DESC
        LIMIT 5
      `);

      // 7. 저장 공간 사용량
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      let storageUsed = 0;
      try {
        const calculateDirSize = async (dir: string): Promise<number> => {
          let size = 0;
          try {
            const files = await fs.readdir(dir, { withFileTypes: true });
            for (const file of files) {
              const filePath = path.join(dir, file.name);
              if (file.isDirectory()) {
                size += await calculateDirSize(filePath);
              } else {
                const stats = await fs.stat(filePath);
                size += stats.size;
              }
            }
          } catch (error) {
            console.warn('[Storage] Error reading directory:', dir);
          }
          return size;
        };

        storageUsed = await calculateDirSize(uploadDir);
      } catch (error) {
        console.warn('[Storage] Error calculating storage:', error);
      }

      // 8. Redis 캐시 통계
      const cacheStats = await getCacheStats();

      const response = {
        success: true,
        data: {
          basic: basicStats.rows[0],
          recentUploads: recentUploads.rows,
          fileTypeDistribution: fileTypeDistribution.rows,
          contentsByRole: contentsByRole.rows,
          recentActivities: recentActivities.rows,
          popularContents: popularContents.rows.map((row) => ({
            ...row,
            bookmark_count: parseInt(row.bookmark_count),
          })),
          storage: {
            used: storageUsed,
            usedFormatted: formatBytes(storageUsed),
          },
          cache: cacheStats,
        },
      };

      // 캐시 저장 (30분)
      await setCache(cacheKey, response, CacheTTL.stats);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/dashboard/users-summary - 사용자 요약 통계
 */
router.get(
  '/dashboard/users-summary',
  logActivity('VIEW_USERS_SUMMARY'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const result = await pool.query(`
        SELECT
          role,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_count
        FROM users
        GROUP BY role
        ORDER BY count DESC
      `);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/dashboard/content-trends - 콘텐츠 트렌드 (월별)
 */
router.get(
  '/dashboard/content-trends',
  logActivity('VIEW_CONTENT_TRENDS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const months = parseInt(req.query.months as string) || 6;

      const result = await pool.query(
        `
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as upload_count,
          COUNT(DISTINCT uploader_id) as unique_uploaders
        FROM contents
        WHERE created_at >= NOW() - INTERVAL '${months} months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `
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

/**
 * GET /api/admin/dashboard/top-tags - 상위 태그 (사용 빈도)
 */
router.get(
  '/dashboard/top-tags',
  logActivity('VIEW_TOP_TAGS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await pool.query(
        `
        SELECT
          t.id,
          t.name,
          t.usage_count,
          COUNT(DISTINCT ct.content_id) as content_count
        FROM tags t
        LEFT JOIN content_tags ct ON t.id = ct.tag_id
        GROUP BY t.id, t.name, t.usage_count
        ORDER BY t.usage_count DESC, content_count DESC
        LIMIT $1
      `,
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

/**
 * GET /api/admin/dashboard/category-stats - 카테고리별 통계
 */
router.get(
  '/dashboard/category-stats',
  logActivity('VIEW_CATEGORY_STATS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const result = await pool.query(`
        SELECT
          c.id,
          c.name,
          c.user_role,
          COUNT(DISTINCT cc.content_id) as content_count,
          COUNT(DISTINCT b.id) as bookmark_count
        FROM categories c
        LEFT JOIN content_categories cc ON c.id = cc.category_id
        LEFT JOIN contents cont ON cc.content_id = cont.id
        LEFT JOIN bookmarks b ON cont.id = b.content_id
        GROUP BY c.id, c.name, c.user_role
        ORDER BY content_count DESC
      `);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          ...row,
          content_count: parseInt(row.content_count),
          bookmark_count: parseInt(row.bookmark_count),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/cache/clear - 캐시 전체 삭제 (개발용)
 */
router.post(
  '/cache/clear',
  logActivity('CLEAR_CACHE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(403, '프로덕션 환경에서는 캐시 전체 삭제가 제한됩니다');
      }

      const { flushAllCache } = await import('../services/cache.service');
      const result = await flushAllCache();

      if (result) {
        res.json({
          success: true,
          message: '모든 캐시가 삭제되었습니다',
        });
      } else {
        throw new AppError(500, '캐시 삭제에 실패했습니다');
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/system/health - 시스템 헬스 체크
 */
router.get(
  '/system/health',
  logActivity('CHECK_SYSTEM_HEALTH'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const health: any = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {},
      };

      // 1. PostgreSQL 확인
      try {
        await pool.query('SELECT 1');
        health.services.database = { status: 'up', message: 'PostgreSQL connected' };
      } catch (error: any) {
        health.services.database = { status: 'down', message: error.message };
        health.status = 'unhealthy';
      }

      // 2. Redis 확인
      try {
        const cacheStats = await getCacheStats();
        health.services.redis = {
          status: 'up',
          message: 'Redis connected',
          stats: cacheStats,
        };
      } catch (error: any) {
        health.services.redis = { status: 'down', message: error.message };
        health.status = 'degraded';
      }

      // 3. Elasticsearch 확인
      try {
        const { checkConnection } = await import('../services/elasticsearch.service');
        const esHealthy = await checkConnection();
        health.services.elasticsearch = {
          status: esHealthy ? 'up' : 'down',
          message: esHealthy ? 'Elasticsearch connected' : 'Elasticsearch unavailable',
        };
        if (!esHealthy) health.status = 'degraded';
      } catch (error: any) {
        health.services.elasticsearch = { status: 'down', message: error.message };
        health.status = 'degraded';
      }

      // 4. 파일 시스템 확인
      try {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        await fs.access(uploadDir);
        health.services.fileSystem = { status: 'up', message: 'Upload directory accessible' };
      } catch (error: any) {
        health.services.fileSystem = { status: 'down', message: error.message };
        health.status = 'unhealthy';
      }

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: health,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 */
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;
