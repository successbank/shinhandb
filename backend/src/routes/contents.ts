import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadMultiple, getFileType, formatFileSize } from '../utils/upload';
import { generateThumbnail, isImageFile } from '../utils/thumbnail';
import {
  extractTextFromImage,
  preprocessText,
  extractTagsFromText,
  isOcrSupportedFile,
} from '../services/ocr';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// 모든 콘텐츠 API는 인증 필요
router.use(authenticate);

// POST /api/contents - 콘텐츠 생성 (파일 업로드)
// ADMIN 및 CLIENT만 업로드 가능
router.post(
  '/',
  authorize('ADMIN', 'CLIENT'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadMultiple(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(413, '파일 크기가 200MB를 초과합니다'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError(400, '파일은 최대 10개까지 업로드 가능합니다'));
        }
        return next(new AppError(400, err.message));
      }
      next();
    });
  },
  logActivity('UPLOAD_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { title, description, categoryId, tags } = req.body;
      const files = req.files as Express.Multer.File[];

      // 파일 검증
      if (!files || files.length === 0) {
        throw new AppError(400, '업로드할 파일을 선택해주세요');
      }

      // 제목 검증
      if (!title) {
        throw new AppError(400, '콘텐츠 제목을 입력해주세요');
      }

      // 카테고리 검증 (옵션)
      if (categoryId) {
        const categoryCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [
          categoryId,
        ]);
        if (categoryCheck.rows.length === 0) {
          throw new AppError(404, '존재하지 않는 카테고리입니다');
        }
      }

      const uploadedContents = [];

      for (const file of files) {
        // 파일 정보
        const fileUrl = `/uploads/originals/${file.filename}`;
        const fileType = getFileType(file.mimetype);
        const fileSize = file.size;

        // 썸네일 생성 (이미지 파일만)
        let thumbnailUrl: string | null = null;
        if (isImageFile(file.filename)) {
          const originalPath = file.path;
          const thumbnailFilename = `thumb_${file.filename}`;
          const thumbnailPath = path.join(
            path.dirname(originalPath).replace('originals', 'thumbnails'),
            thumbnailFilename
          );

          const thumbnailGenerated = await generateThumbnail(originalPath, thumbnailPath);
          if (thumbnailGenerated) {
            thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
          }
        }

        // OCR 텍스트 추출 (이미지 파일만)
        let ocrText: string | null = null;
        let autoTags: string[] = [];

        if (isOcrSupportedFile(file.filename)) {
          try {
            console.log('[OCR] Processing file:', file.filename);
            const originalPath = file.path;

            // 텍스트 추출
            const extractedText = await extractTextFromImage(originalPath);

            if (extractedText && extractedText.trim().length > 0) {
              // 텍스트 전처리
              ocrText = preprocessText(extractedText);

              // 자동 태그 추출
              autoTags = extractTagsFromText(ocrText, 10);
              console.log('[OCR] Auto tags generated:', autoTags);
            }
          } catch (error: any) {
            console.warn('[OCR] Warning - OCR failed for file:', file.filename, error.message);
            // OCR 실패는 업로드를 막지 않음 (경고만 표시)
          }
        }

        // editable_until 계산 (CLIENT만 30분 제한)
        let editableUntil: Date | null = null;
        if (req.user!.role === 'CLIENT') {
          editableUntil = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
        }

        // 콘텐츠 DB 저장 (OCR 텍스트 포함)
        const result = await pool.query(
          `INSERT INTO contents
           (title, description, file_url, file_type, file_size, thumbnail_url,
            category_id, uploader_id, editable_until, ocr_text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, title, file_url, thumbnail_url, created_at`,
          [
            title,
            description || null,
            fileUrl,
            fileType,
            fileSize,
            thumbnailUrl,
            categoryId || null,
            req.user!.id,
            editableUntil,
            ocrText,
          ]
        );

        const newContent = result.rows[0];

        // 태그 추가 (수동 태그 + 자동 태그)
        const allTags: string[] = [];

        // 수동 태그 추가
        if (tags) {
          const tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
          allTags.push(...tagArray);
        }

        // 자동 태그 추가 (OCR에서 추출된 태그)
        allTags.push(...autoTags);

        // 태그 중복 제거
        const uniqueTags = [...new Set(allTags)];

        // 태그 저장
        for (const tagName of uniqueTags) {
          if (!tagName || tagName.trim().length === 0) continue;

          // 태그 존재 확인 또는 생성
          const tagResult = await pool.query(
            `INSERT INTO tags (name) VALUES ($1)
             ON CONFLICT (name) DO UPDATE SET usage_count = tags.usage_count + 1
             RETURNING id`,
            [tagName.trim()]
          );
          const tagId = tagResult.rows[0].id;

          // 콘텐츠-태그 연결
          await pool.query(
            'INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newContent.id, tagId]
          );
        }

        uploadedContents.push({
          id: newContent.id,
          title: newContent.title,
          fileUrl: newContent.file_url,
          thumbnailUrl: newContent.thumbnail_url,
          fileSize: formatFileSize(fileSize),
          fileType,
          createdAt: newContent.created_at,
        });
      }

      res.status(201).json({
        success: true,
        message: `${uploadedContents.length}개의 파일이 업로드되었습니다`,
        data: uploadedContents,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/contents - 콘텐츠 목록 조회 및 통합 검색
router.get(
  '/',
  logActivity('VIEW_CONTENTS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const categoryId = req.query.categoryId as string | undefined;
      const search = req.query.search as string | undefined;
      const fileType = req.query.fileType as string | undefined;
      const uploaderId = req.query.uploaderId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const tags = req.query.tags as string | undefined; // 쉼표로 구분된 태그
      const offset = (page - 1) * pageSize;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      // 카테고리 필터
      if (categoryId) {
        whereConditions.push(`c.category_id = $${paramIndex}`);
        params.push(categoryId);
        paramIndex++;
      }

      // 키워드 검색 (제목, 설명, OCR 텍스트)
      if (search && search.trim().length > 0) {
        whereConditions.push(`(
          c.title ILIKE $${paramIndex} OR
          c.description ILIKE $${paramIndex} OR
          c.ocr_text ILIKE $${paramIndex}
        )`);
        params.push(`%${search.trim()}%`);
        paramIndex++;
      }

      // 파일 유형 필터
      if (fileType) {
        whereConditions.push(`c.file_type = $${paramIndex}`);
        params.push(fileType);
        paramIndex++;
      }

      // 업로더 필터
      if (uploaderId) {
        whereConditions.push(`c.uploader_id = $${paramIndex}`);
        params.push(uploaderId);
        paramIndex++;
      }

      // 날짜 범위 필터
      if (startDate) {
        whereConditions.push(`c.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`c.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      // 태그 필터
      let tagJoin = '';
      if (tags && tags.trim().length > 0) {
        const tagArray = tags.split(',').map((tag) => tag.trim());
        tagJoin = `
          INNER JOIN content_tags ct ON c.id = ct.content_id
          INNER JOIN tags t ON ct.tag_id = t.id
        `;
        whereConditions.push(`t.name = ANY($${paramIndex})`);
        params.push(tagArray);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 전체 개수 조회
      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT c.id) FROM contents c ${tagJoin} ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // 콘텐츠 목록 조회 (태그 정보 포함)
      const result = await pool.query(
        `SELECT DISTINCT c.id, c.title, c.description, c.file_url, c.file_type, c.file_size,
                c.thumbnail_url, c.created_at, c.updated_at,
                u.name as uploader_name, u.role as uploader_role,
                cat.name as category_name,
                (SELECT array_agg(t2.name)
                 FROM content_tags ct2
                 INNER JOIN tags t2 ON ct2.tag_id = t2.id
                 WHERE ct2.content_id = c.id) as tags
         FROM contents c
         LEFT JOIN users u ON c.uploader_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         ${tagJoin}
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, pageSize, offset]
      );

      const contents = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        fileUrl: row.file_url,
        fileType: row.file_type,
        fileSize: formatFileSize(row.file_size),
        thumbnailUrl: row.thumbnail_url,
        categoryName: row.category_name,
        uploaderName: row.uploader_name,
        uploaderRole: row.uploader_role,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({
        success: true,
        data: {
          items: contents,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          filters: {
            search,
            categoryId,
            fileType,
            uploaderId,
            startDate,
            endDate,
            tags: tags ? tags.split(',').map((t) => t.trim()) : [],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/contents/:id - 콘텐츠 상세 조회
router.get(
  '/:id',
  logActivity('VIEW_CONTENT_DETAIL'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT c.*,
                u.name as uploader_name, u.email as uploader_email, u.role as uploader_role,
                cat.name as category_name
         FROM contents c
         LEFT JOIN users u ON c.uploader_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      const content = result.rows[0];

      // 태그 조회
      const tagsResult = await pool.query(
        `SELECT t.id, t.name FROM tags t
         INNER JOIN content_tags ct ON t.id = ct.tag_id
         WHERE ct.content_id = $1`,
        [id]
      );

      res.json({
        success: true,
        data: {
          id: content.id,
          title: content.title,
          description: content.description,
          fileUrl: content.file_url,
          fileType: content.file_type,
          fileSize: formatFileSize(content.file_size),
          thumbnailUrl: content.thumbnail_url,
          ocrText: content.ocr_text,
          categoryId: content.category_id,
          categoryName: content.category_name,
          uploaderId: content.uploader_id,
          uploaderName: content.uploader_name,
          uploaderEmail: content.uploader_email,
          uploaderRole: content.uploader_role,
          editableUntil: content.editable_until,
          tags: tagsResult.rows,
          createdAt: content.created_at,
          updatedAt: content.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/contents/:id/extend-edit - 수정 시간 연장 (Admin only)
router.patch(
  '/:id/extend-edit',
  authorize('ADMIN'),
  logActivity('EXTEND_EDIT_TIME'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { minutes } = req.body;

      if (!minutes || minutes <= 0) {
        throw new AppError(400, '연장할 시간(분)을 입력해주세요');
      }

      const newEditableUntil = new Date(Date.now() + minutes * 60 * 1000);

      const result = await pool.query(
        'UPDATE contents SET editable_until = $1 WHERE id = $2 RETURNING id, editable_until',
        [newEditableUntil, id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        message: `수정 가능 시간이 ${minutes}분 연장되었습니다`,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/contents/:id/share - 공유 링크 생성
router.post(
  '/:id/share',
  logActivity('CREATE_SHARE_LINK'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { expiresIn } = req.body; // 1, 7, 30, null (무제한)

      // 콘텐츠 존재 확인
      const contentCheck = await pool.query('SELECT id FROM contents WHERE id = $1', [id]);

      if (contentCheck.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      // 만료 시간 계산
      let expireDate: Date | null = null;
      if (expiresIn) {
        expireDate = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000); // 일 단위
      }

      // 공유 링크 생성
      const result = await pool.query(
        `INSERT INTO share_links (content_id, shared_by_id, expire_date)
         VALUES ($1, $2, $3)
         RETURNING id, content_id, expire_date, created_at`,
        [id, req.user!.id, expireDate]
      );

      const shareLink = result.rows[0];
      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${
        shareLink.id
      }`;

      res.status(201).json({
        success: true,
        message: '공유 링크가 생성되었습니다',
        data: {
          ...shareLink,
          shareUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/contents/share/:shareId - 공유 링크로 콘텐츠 조회
router.get(
  '/share/:shareId',
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { shareId } = req.params;

      // 공유 링크 조회
      const shareLinkResult = await pool.query(
        'SELECT id, content_id, expire_date FROM share_links WHERE id = $1',
        [shareId]
      );

      if (shareLinkResult.rows.length === 0) {
        throw new AppError(404, '공유 링크를 찾을 수 없습니다');
      }

      const shareLink = shareLinkResult.rows[0];

      // 만료 확인
      if (shareLink.expire_date && new Date(shareLink.expire_date) < new Date()) {
        throw new AppError(410, '공유 링크가 만료되었습니다');
      }

      // 콘텐츠 조회
      const contentResult = await pool.query(
        `SELECT c.*, u.name as uploader_name, cat.name as category_name
         FROM contents c
         LEFT JOIN users u ON c.uploader_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id = $1`,
        [shareLink.content_id]
      );

      if (contentResult.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      res.json({
        success: true,
        data: contentResult.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/contents/:id - 콘텐츠 삭제
router.delete(
  '/:id',
  authorize('ADMIN', 'CLIENT'),
  logActivity('DELETE_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 콘텐츠 조회
      const result = await pool.query(
        'SELECT id, file_url, thumbnail_url, uploader_id FROM contents WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      const content = result.rows[0];

      // 권한 확인 (본인 또는 ADMIN만 삭제 가능)
      if (req.user!.role !== 'ADMIN' && content.uploader_id !== req.user!.id) {
        throw new AppError(403, '본인이 업로드한 콘텐츠만 삭제할 수 있습니다');
      }

      // 파일 삭제
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const originalPath = path.join(uploadDir, 'originals', path.basename(content.file_url));

      try {
        await fs.unlink(originalPath);
      } catch (error) {
        console.warn('[File Delete] Original file not found:', originalPath);
      }

      // 썸네일 삭제
      if (content.thumbnail_url) {
        const thumbnailPath = path.join(
          uploadDir,
          'thumbnails',
          path.basename(content.thumbnail_url)
        );
        try {
          await fs.unlink(thumbnailPath);
        } catch (error) {
          console.warn('[File Delete] Thumbnail not found:', thumbnailPath);
        }
      }

      // DB에서 삭제 (CASCADE로 content_tags도 삭제됨)
      await pool.query('DELETE FROM contents WHERE id = $1', [id]);

      res.json({
        success: true,
        message: '콘텐츠가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
