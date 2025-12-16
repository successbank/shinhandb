import { Router, Response } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';
import * as XLSX from 'xlsx';

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
      `SELECT al.*, u.name as user_name, u.username as user_email
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

// GET /api/logs/export - 활동 로그 Excel 내보내기
router.get('/export', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.query.userId as string | undefined;
    const actionType = req.query.actionType as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

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

    // 모든 로그 조회 (최대 10,000개)
    const result = await pool.query(
      `SELECT al.id, al.action_type, al.ip_address, al.created_at, al.details,
              u.name as user_name, u.username as user_email, u.role as user_role
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT 10000`,
      params
    );

    // Excel 데이터 포맷팅
    const excelData = result.rows.map((row, index) => ({
      번호: index + 1,
      사용자명: row.user_name || 'N/A',
      이메일: row.user_email || 'N/A',
      역할: row.user_role || 'N/A',
      활동유형: row.action_type,
      'IP 주소': row.ip_address,
      일시: new Date(row.created_at).toLocaleString('ko-KR'),
      상세정보: row.details ? JSON.stringify(row.details) : '',
    }));

    // 워크북 및 워크시트 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 컬럼 너비 조정
    worksheet['!cols'] = [
      { wch: 8 },  // 번호
      { wch: 15 }, // 사용자명
      { wch: 25 }, // 이메일
      { wch: 10 }, // 역할
      { wch: 20 }, // 활동유형
      { wch: 15 }, // IP 주소
      { wch: 20 }, // 일시
      { wch: 50 }, // 상세정보
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '활동 로그');

    // Excel 파일 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성 (날짜 포함)
    const fileName = `activity_logs_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Excel 파일 전송
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
