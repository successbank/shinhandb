import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// 모든 로그 API는 관리자만 접근 가능
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /api/logs - 활동 로그 조회
router.get('/', async (req: AuthRequest, res: Response<ApiResponse>, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const userId = req.query.userId as string | undefined;
    const actionType = req.query.actionType as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const offset = (page - 1) * pageSize;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (actionType) {
      whereConditions.push(`action_type = $${paramIndex}`);
      params.push(actionType);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 전체 개수 조회
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM activity_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 로그 목록 조회
    const result = await pool.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    res.json({
      success: true,
      data: {
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        filters: {
          userId,
          actionType,
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
