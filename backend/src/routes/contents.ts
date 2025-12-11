import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadMultiple, getFileType, formatFileSize } from '../utils/upload';
import { generateThumbnail, isImageFile } from '../utils/thumbnail';
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

        // editable_until 계산 (CLIENT만 30분 제한)
        let editableUntil: Date | null = null;
        if (req.user!.role === 'CLIENT') {
          editableUntil = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
        }

        // 콘텐츠 DB 저장
        const result = await pool.query(
          `INSERT INTO contents
           (title, description, file_url, file_type, file_size, thumbnail_url,
            category_id, uploader_id, editable_until)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
          ]
        );

        const newContent = result.rows[0];

        // 태그 추가 (옵션)
        if (tags) {
          const tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
          for (const tagName of tagArray) {
            // 태그 존재 확인 또는 생성
            const tagResult = await pool.query(
              `INSERT INTO tags (name) VALUES ($1)
               ON CONFLICT (name) DO UPDATE SET usage_count = tags.usage_count + 1
               RETURNING id`,
              [tagName]
            );
            const tagId = tagResult.rows[0].id;

            // 콘텐츠-태그 연결
            await pool.query('INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2)', [
              newContent.id,
              tagId,
            ]);
          }
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

// GET /api/contents - 콘텐츠 목록 조회
router.get(
  '/',
  logActivity('VIEW_CONTENTS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const categoryId = req.query.categoryId as string | undefined;
      const search = req.query.search as string | undefined;
      const offset = (page - 1) * pageSize;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (categoryId) {
        whereConditions.push(`c.category_id = $${paramIndex}`);
        params.push(categoryId);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`c.title ILIKE $${paramIndex}`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 전체 개수 조회
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM contents c ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // 콘텐츠 목록 조회
      const result = await pool.query(
        `SELECT c.id, c.title, c.description, c.file_url, c.file_type, c.file_size,
                c.thumbnail_url, c.created_at, c.updated_at,
                u.name as uploader_name, u.role as uploader_role,
                cat.name as category_name
         FROM contents c
         LEFT JOIN users u ON c.uploader_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
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
