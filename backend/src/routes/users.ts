import { Router, Request, Response } from 'express';
import { AuthRequest, ApiResponse, UserRole, PaginatedResponse, User } from '../types';
import { pool } from '../db';
import { hashPassword } from '../utils/password';
import { generateRandomPassword } from '../utils/generatePassword';
import { sendWelcomeEmail } from '../utils/email';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// GET /api/users/:id/activities - 사용자 활동 내역 조회
// 특별 처리: 본인 또는 ADMIN만 접근 가능 (router.use 전에 정의)
router.get(
  '/:id/activities',
  authenticate, // ADMIN 권한 체크 없음, 본인 확인만
  logActivity('VIEW_USER_ACTIVITIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 본인 또는 ADMIN만 접근 가능
      if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
        throw new AppError(403, '접근 권한이 없습니다');
      }

      // 사용자 존재 확인
      const userCheck = await pool.query(
        'SELECT id, username, name, role FROM users WHERE id = $1',
        [id]
      );
      if (userCheck.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      const user = userCheck.rows[0];

      // 1. 접속 기록 (LOGIN과 LOGOUT 매칭하여 세션 계산)
      const allSessionLogs = await pool.query(
        `SELECT id, action_type, ip_address, created_at, details
         FROM activity_logs
         WHERE user_id = $1 AND action_type IN ('LOGIN', 'LOGOUT')
         ORDER BY created_at ASC`,
        [id]
      );

      // 세션 매칭: 각 LOGIN에 대해 다음 LOGOUT 찾기
      const sessions: any[] = [];
      const logs = allSessionLogs.rows;

      for (let i = 0; i < logs.length; i++) {
        if (logs[i].action_type === 'LOGIN') {
          const loginLog = logs[i];

          // 다음 LOGOUT 찾기 (같은 사용자의 다음 로그아웃)
          let logoutLog = null;
          for (let j = i + 1; j < logs.length; j++) {
            if (logs[j].action_type === 'LOGOUT') {
              logoutLog = logs[j];
              break;
            }
            // 다음 LOGIN이 나오면 중단 (로그아웃 없이 재로그인)
            if (logs[j].action_type === 'LOGIN') {
              break;
            }
          }

          // 세션 시간 계산 (초 단위)
          let durationSeconds = null;
          if (logoutLog) {
            const loginTime = new Date(loginLog.created_at).getTime();
            const logoutTime = new Date(logoutLog.created_at).getTime();
            durationSeconds = Math.floor((logoutTime - loginTime) / 1000);
          }

          sessions.push({
            loginId: loginLog.id,
            logoutId: logoutLog?.id || null,
            loginTime: loginLog.created_at,
            logoutTime: logoutLog?.created_at || null,
            durationSeconds,
            ipAddress: loginLog.ip_address,
            details: loginLog.details,
          });
        }
      }

      // 최근 100개 세션만 (역순 정렬)
      const loginLogs = { rows: sessions.reverse().slice(0, 100) };

      // 2. 콘텐츠 확인 기록 (최근 100개)
      const viewLogs = await pool.query(
        `SELECT al.id, al.created_at, al.details, c.id as content_id, c.title, c.thumbnail_url, c.file_type
         FROM activity_logs al
         LEFT JOIN contents c ON (al.details->>'contentId')::uuid = c.id
         WHERE al.user_id = $1 AND al.action_type = 'VIEW_CONTENT'
         ORDER BY al.created_at DESC
         LIMIT 100`,
        [id]
      );

      // 3. 공유한 콘텐츠
      const sharedContent = await pool.query(
        `SELECT sl.id, sl.content_id, sl.token, sl.expires_at, sl.created_at,
                c.title, c.thumbnail_url, c.file_type
         FROM share_links sl
         JOIN contents c ON sl.content_id = c.id
         WHERE sl.created_by = $1
         ORDER BY sl.created_at DESC`,
        [id]
      );

      // 4. 업로드한 콘텐츠 (클라이언트만)
      let uploadedContent: any = { rows: [] };
      if (user.role === 'CLIENT') {
        uploadedContent = await pool.query(
          `SELECT id, title, description, file_type, file_size, thumbnail_url,
                  category_id, tags, ocr_text, editable_until, created_at, updated_at
           FROM contents
           WHERE uploader_id = $1
           ORDER BY created_at DESC`,
          [id]
        );
      }

      // User-Agent 파싱 함수
      const parseUserAgent = (ua: string) => {
        if (!ua) return { device: 'Unknown', os: 'Unknown', browser: 'Unknown' };

        // OS 감지
        let os = 'Unknown';
        if (ua.includes('Windows NT 10.0')) os = 'Windows 10';
        else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
        else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
        else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
        else if (ua.includes('Mac OS X')) os = 'macOS';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
        else if (ua.includes('Linux')) os = 'Linux';

        // 기기 감지
        let device = 'Desktop';
        if (ua.includes('Mobile') || ua.includes('Android')) device = 'Mobile';
        else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

        // 브라우저 감지
        let browser = 'Unknown';
        if (ua.includes('Edg/')) browser = 'Edge';
        else if (ua.includes('Chrome/')) browser = 'Chrome';
        else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Firefox/')) browser = 'Firefox';
        else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer';

        return { device, os, browser };
      };

      // 접속 기록 포맷팅 (세션 정보 포함)
      const formattedLoginLogs = loginLogs.rows.map((log) => {
        const userAgent = log.details?.userAgent || '';
        const parsed = parseUserAgent(userAgent);
        return {
          id: log.loginId,
          loginTime: log.loginTime,
          logoutTime: log.logoutTime,
          durationSeconds: log.durationSeconds,
          ipAddress: log.ipAddress,
          device: parsed.device,
          os: parsed.os,
          browser: parsed.browser,
          location: '대한민국', // IP 기반 지역 조회는 별도 서비스 필요
        };
      });

      // 콘텐츠 확인 기록 포맷팅
      const formattedViewLogs = viewLogs.rows.map((log) => ({
        id: log.id,
        timestamp: log.created_at,
        contentId: log.content_id,
        contentTitle: log.title,
        contentThumbnail: log.thumbnail_url,
        contentType: log.file_type,
      }));

      // 공유 콘텐츠 포맷팅
      const formattedShares = sharedContent.rows.map((share) => ({
        id: share.id,
        contentId: share.content_id,
        contentTitle: share.title,
        contentThumbnail: share.thumbnail_url,
        contentType: share.file_type,
        shareToken: share.token,
        expiresAt: share.expires_at,
        createdAt: share.created_at,
        shareUrl: `${process.env.FRONTEND_URL || 'http://192.168.1.45:5647'}/share/${share.token}`,
      }));

      // 업로드 콘텐츠 포맷팅
      const formattedUploads = uploadedContent.rows.map((content: any) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        fileType: content.file_type,
        fileSize: content.file_size,
        thumbnailUrl: content.thumbnail_url,
        categoryId: content.category_id,
        tags: content.tags,
        ocrText: content.ocr_text,
        editableUntil: content.editable_until,
        createdAt: content.created_at,
        updatedAt: content.updated_at,
        contentUrl: `${process.env.FRONTEND_URL || 'http://192.168.1.45:5647'}/contents/${content.id}`,
      }));

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
          loginHistory: formattedLoginLogs,
          viewHistory: formattedViewLogs,
          sharedContent: formattedShares,
          uploadedContent: formattedUploads,
          summary: {
            totalLogins: loginLogs.rows.length,
            totalViews: viewLogs.rows.length,
            totalShares: sharedContent.rows.length,
            totalUploads: uploadedContent.rows.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 모든 사용자 관리 API는 ADMIN 권한 필요
router.use(authenticate, authorize('ADMIN'));

// GET /api/users - 사용자 목록 조회 (페이지네이션)
router.get(
  '/',
  logActivity('VIEW_USERS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const role = req.query.role as UserRole | undefined;
      const search = req.query.search as string | undefined;
      const offset = (page - 1) * pageSize;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (role) {
        whereConditions.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 전체 개수 조회
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM users ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // 사용자 목록 조회
      const result = await pool.query(
        `SELECT id, username, name, role, is_active, created_at, updated_at
         FROM users
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, pageSize, offset]
      );

      const users = result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const response: PaginatedResponse<any> = {
        items: users,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/:id - 사용자 상세 조회
router.get(
  '/:id',
  logActivity('VIEW_USER_DETAIL'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT id, username, name, role, is_active, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      const user = {
        id: result.rows[0].id,
        username: result.rows[0].username,
        name: result.rows[0].name,
        role: result.rows[0].role,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users - 사용자 생성
router.post(
  '/',
  logActivity('CREATE_USER'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { username, name, password: providedPassword, role, sendEmail: shouldSendEmail = true } = req.body;

      // 입력 검증
      if (!username || !name || !role) {
        throw new AppError(400, '필수 항목을 모두 입력해주세요 (username, name, role)');
      }

      // 역할 검증
      const validRoles: UserRole[] = ['ADMIN', 'HOLDING', 'BANK', 'CLIENT'];
      if (!validRoles.includes(role)) {
        throw new AppError(400, '유효하지 않은 역할입니다 (ADMIN, HOLDING, BANK, CLIENT)');
      }

      // 아이디 중복 확인
      const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        throw new AppError(409, '이미 존재하는 아이디입니다');
      }

      // 비밀번호 생성 또는 검증
      let password: string;
      let autoGeneratedPassword: string | null = null;

      if (providedPassword) {
        // 비밀번호가 제공된 경우 강도 검증
        if (providedPassword.length < 8) {
          throw new AppError(400, '비밀번호는 최소 8자 이상이어야 합니다');
        }
        password = providedPassword;
      } else {
        // 비밀번호 자동 생성
        password = generateRandomPassword(12);
        autoGeneratedPassword = password;
        console.log('[User Create] Auto-generated password for', username);
      }

      // 비밀번호 해싱
      const hashedPassword = await hashPassword(password);

      // 사용자 생성
      const result = await pool.query(
        `INSERT INTO users (username, name, password, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, username, name, role, is_active, created_at, updated_at`,
        [username, name, hashedPassword, role]
      );

      const newUser = {
        id: result.rows[0].id,
        username: result.rows[0].username,
        name: result.rows[0].name,
        role: result.rows[0].role,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      // 이메일 발송 (자동 생성된 비밀번호 또는 환영 이메일)
      if (shouldSendEmail && autoGeneratedPassword) {
        const emailSent = await sendWelcomeEmail(
          username,
          name,
          username,
          autoGeneratedPassword,
          role
        );

        if (emailSent) {
          console.log('[User Create] Welcome email sent to', username);
        } else {
          console.error('[User Create] Failed to send welcome email to', username);
        }
      }

      res.status(201).json({
        success: true,
        message: autoGeneratedPassword
          ? '사용자가 생성되었습니다. 초기 비밀번호가 이메일로 발송되었습니다.'
          : '사용자가 생성되었습니다',
        data: newUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/users/:id - 사용자 정보 수정
router.patch(
  '/:id',
  logActivity('UPDATE_USER'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { name, username, role, isActive } = req.body;

      // 사용자 존재 확인
      const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
      if (existingUser.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (username !== undefined) {
        // 아이디 중복 확인
        const duplicateCheck = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, id]
        );
        if (duplicateCheck.rows.length > 0) {
          throw new AppError(409, '이미 존재하는 아이디입니다');
        }

        updates.push(`username = $${paramIndex}`);
        params.push(username);
        paramIndex++;
      }

      if (role !== undefined) {
        const validRoles: UserRole[] = ['ADMIN', 'HOLDING', 'BANK', 'CLIENT'];
        if (!validRoles.includes(role)) {
          throw new AppError(400, '유효하지 않은 역할입니다');
        }

        updates.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(isActive);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new AppError(400, '수정할 항목이 없습니다');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, username, name, role, is_active, created_at, updated_at`,
        params
      );

      const updatedUser = {
        id: result.rows[0].id,
        username: result.rows[0].username,
        name: result.rows[0].name,
        role: result.rows[0].role,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      res.json({
        success: true,
        message: '사용자 정보가 수정되었습니다',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/users/:id - 사용자 비활성화 (실제 삭제 안 함)
router.delete(
  '/:id',
  logActivity('DEACTIVATE_USER'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 본인 계정 비활성화 방지
      if (req.user!.id === id) {
        throw new AppError(400, '본인 계정은 비활성화할 수 없습니다');
      }

      // 사용자 존재 확인
      const existingUser = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [id]);
      if (existingUser.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      if (!existingUser.rows[0].is_active) {
        throw new AppError(400, '이미 비활성화된 계정입니다');
      }

      // 사용자 비활성화
      await pool.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      res.json({
        success: true,
        message: '사용자가 비활성화되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users/:id/reset-password - 비밀번호 초기화 (관리자가 사용자 비밀번호 재설정)
router.post(
  '/:id/reset-password',
  logActivity('RESET_USER_PASSWORD'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { sendEmail: shouldSendEmail = true } = req.body;

      // 사용자 존재 확인
      const result = await pool.query(
        'SELECT id, username, name, role, is_active FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      const user = result.rows[0];

      if (!user.is_active) {
        throw new AppError(400, '비활성화된 계정은 비밀번호를 초기화할 수 없습니다');
      }

      // 새 비밀번호 자동 생성
      const newPassword = generateRandomPassword(12);
      const hashedPassword = await hashPassword(newPassword);

      // 비밀번호 업데이트
      await pool.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashedPassword, id]
      );

      console.log('[Password Reset] Password reset for user:', user.username);

      // 이메일 발송
      if (shouldSendEmail) {
        const emailSent = await sendWelcomeEmail(
          user.username,
          user.name,
          user.username,
          newPassword,
          user.role
        );

        if (emailSent) {
          console.log('[Password Reset] Email sent to', user.username);
        } else {
          console.error('[Password Reset] Failed to send email to', user.username);
        }
      }

      res.json({
        success: true,
        message: '비밀번호가 초기화되었습니다. 새 비밀번호가 이메일로 발송되었습니다.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users/:id/activate - 사용자 계정 활성화
router.post(
  '/:id/activate',
  logActivity('ACTIVATE_USER'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 사용자 존재 확인
      const existingUser = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [id]);
      if (existingUser.rows.length === 0) {
        throw new AppError(404, '사용자를 찾을 수 없습니다');
      }

      if (existingUser.rows[0].is_active) {
        throw new AppError(400, '이미 활성화된 계정입니다');
      }

      // 사용자 활성화
      await pool.query(
        'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      res.json({
        success: true,
        message: '사용자가 활성화되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);


export default router;
