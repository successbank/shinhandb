import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { pool } from '../db';
import { AppError } from '../middlewares/errorHandler';
import { logActivity } from '../middlewares/activityLog';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadMultiple, getFileType, formatFileSize } from '../utils/upload';
import { generateThumbnail, isImageFile } from '../utils/thumbnail';
import {
  extractTextAndGenerateTags,
  isOcrSupportedFile,
} from '../services/ocr';
import { indexContent, deleteContentIndex, searchContents } from '../services/elasticsearch.service';
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
      const { title, description, categoryId, categoryIds, tags } = req.body;
      const files = req.files as Express.Multer.File[];

      // 파일 검증
      if (!files || files.length === 0) {
        throw new AppError(400, '업로드할 파일을 선택해주세요');
      }

      // 제목 검증
      if (!title) {
        throw new AppError(400, '콘텐츠 제목을 입력해주세요');
      }

      // 카테고리 처리 (다중 또는 단일)
      let categoryIdsArray: string[] = [];

      if (categoryIds) {
        // 다중 카테고리 (배열)
        categoryIdsArray = Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds);

        // 최대 3개 제한
        if (categoryIdsArray.length > 3) {
          throw new AppError(400, '카테고리는 최대 3개까지 선택 가능합니다');
        }
      } else if (categoryId) {
        // 하위 호환성: 단일 카테고리
        categoryIdsArray = [categoryId];
      }

      // 카테고리 필수 검증
      if (categoryIdsArray.length === 0) {
        throw new AppError(400, '최소 1개의 카테고리를 선택해주세요');
      }

      // 카테고리 존재 여부 검증
      const categoryCheck = await pool.query(
        'SELECT id FROM categories WHERE id = ANY($1)',
        [categoryIdsArray]
      );
      if (categoryCheck.rows.length !== categoryIdsArray.length) {
        throw new AppError(404, '존재하지 않는 카테고리가 포함되어 있습니다');
      }

      const uploadedContents = [];

      for (const file of files) {
        // 파일 정보
        const fileUrl = `/uploads/originals/${file.filename}`;
        // 한글 파일명 인코딩 문제 해결: latin1 -> utf8 변환
        const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
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

        // OCR + AI 태그 생성 (이미지 파일만)
        let ocrText: string | null = null;
        let autoTags: string[] = [];

        if (isOcrSupportedFile(file.filename)) {
          try {
            console.log('[OCR + AI] Processing file:', file.filename);
            const originalPath = file.path;

            // OCR 텍스트 추출 + OpenAI 태그 생성 (크게 보이는 핵심 문구 기반 5개)
            const result = await extractTextAndGenerateTags(originalPath, 5);

            ocrText = result.ocrText || null;
            autoTags = result.tags || [];

            console.log('[OCR + AI] Auto tags generated (top 5):', autoTags);
          } catch (error: any) {
            console.warn('[OCR + AI] Warning - Processing failed for file:', file.filename, error.message);
            // OCR/AI 실패는 업로드를 막지 않음 (경고만 표시)
          }
        }

        // editable_until 계산 (CLIENT만 30분 제한)
        let editableUntil: Date | null = null;
        if (req.user!.role === 'CLIENT') {
          editableUntil = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
        }

        // 콘텐츠 DB 저장 (OCR 텍스트 포함)
        // category_id는 하위 호환성을 위해 첫 번째 카테고리를 저장
        const result = await pool.query(
          `INSERT INTO contents
           (title, description, file_url, file_name, file_type, file_size, thumbnail_url,
            category_id, uploader_id, editable_until, ocr_text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, title, file_url, file_name, thumbnail_url, created_at`,
          [
            title,
            description || null,
            fileUrl,
            fileName,
            fileType,
            fileSize,
            thumbnailUrl,
            categoryIdsArray.length > 0 ? categoryIdsArray[0] : null,
            req.user!.id,
            editableUntil,
            ocrText,
          ]
        );

        const newContent = result.rows[0];

        // 다중 카테고리 저장 (content_categories 테이블)
        for (const catId of categoryIdsArray) {
          await pool.query(
            `INSERT INTO content_categories (content_id, category_id)
             VALUES ($1, $2)
             ON CONFLICT (content_id, category_id) DO NOTHING`,
            [newContent.id, catId]
          );
        }

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
          ocrText: ocrText || undefined,
          generatedTags: autoTags.length > 0 ? autoTags : undefined,
          allTags: uniqueTags.length > 0 ? uniqueTags : undefined,
          createdAt: newContent.created_at,
        });

        // 카테고리 캐시 무효화 (콘텐츠 수 업데이트를 위해)
        const { deleteCachePattern } = await import('../services/cache.service');
        await deleteCachePattern('categories:*');

        // Elasticsearch 색인 추가
        try {
          // 카테고리 이름 조회
          const categoryNamesResult = await pool.query(
            `SELECT name FROM categories WHERE id = ANY($1)`,
            [categoryIdsArray]
          );
          const categoryNames = categoryNamesResult.rows.map((row: any) => row.name);

          // Elasticsearch에 콘텐츠 색인
          await indexContent({
            id: newContent.id,
            title,
            description: description || null,
            ocr_text: ocrText,
            file_name: file.filename,
            file_type: fileType,
            file_size: fileSize,
            category_ids: categoryIdsArray,
            category_names: categoryNames,
            tags: uniqueTags,
            uploader_id: req.user!.id,
            uploader_name: req.user!.name,
            member_type: req.user!.role,
            created_at: newContent.created_at,
            updated_at: newContent.created_at,
          });
          console.log(`[Upload] Content indexed to Elasticsearch: ${newContent.id}`);
        } catch (esError: any) {
          console.error('[Upload] Failed to index content to Elasticsearch:', esError.message);
          // Elasticsearch 실패는 업로드를 막지 않음
        }
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

// GET /api/contents/search - Elasticsearch 전문 검색 (우선 배치)
router.get(
  '/search',
  logActivity('SEARCH_CONTENTS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const query = req.query.q as string | undefined; // 검색어
      const categoryIds = req.query.categoryIds as string | undefined; // 쉼표로 구분된 카테고리 ID
      const memberType = req.query.memberType as string | undefined;
      const tags = req.query.tags as string | undefined; // 쉼표로 구분된 태그
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const sortBy = (req.query.sortBy as 'relevance' | 'date_desc' | 'date_asc') || 'relevance';

      // 카테고리 ID 배열 변환
      const categoryIdsArray = categoryIds
        ? categoryIds.split(',').map((id) => id.trim()).filter(Boolean)
        : undefined;

      // 태그 배열 변환
      const tagsArray = tags
        ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : undefined;

      // 날짜 변환
      const fromDateObj = fromDate ? new Date(fromDate) : undefined;
      const toDateObj = toDate ? new Date(toDate) : undefined;

      // Elasticsearch 검색 실행
      const result = await searchContents({
        query,
        categoryIds: categoryIdsArray,
        memberType,
        tags: tagsArray,
        fromDate: fromDateObj,
        toDate: toDateObj,
        page,
        limit: pageSize,
        sortBy,
      });

      // 응답 포맷팅
      const contents = result.hits.map((hit: any) => ({
        id: hit.id,
        title: hit.title,
        description: hit.description,
        fileUrl: hit.file_url,
        fileType: hit.file_type,
        fileSize: formatFileSize(hit.file_size),
        thumbnailUrl: hit.thumbnail_url,
        categoryIds: hit.category_ids,
        categoryNames: hit.category_names,
        uploaderName: hit.uploader_name,
        uploaderRole: hit.member_type,
        tags: hit.tags,
        createdAt: hit.created_at,
        updatedAt: hit.updated_at,
        score: hit._score, // 관련성 점수
      }));

      res.json({
        success: true,
        data: {
          items: contents,
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
          took: result.took, // 검색 소요 시간 (ms)
          filters: {
            query,
            categoryIds: categoryIdsArray,
            memberType,
            tags: tagsArray,
            fromDate,
            toDate,
            sortBy,
          },
        },
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
      let categoryJoin = '';

      // 카테고리 필터 (다중 카테고리 지원)
      if (categoryId) {
        categoryJoin = `
          INNER JOIN content_categories cc_filter ON c.id = cc_filter.content_id
        `;
        whereConditions.push(`cc_filter.category_id = $${paramIndex}`);
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
        `SELECT COUNT(DISTINCT c.id) FROM contents c ${categoryJoin} ${tagJoin} ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // 콘텐츠 목록 조회 (태그 및 다중 카테고리 정보 포함)
      const result = await pool.query(
        `SELECT DISTINCT c.id, c.title, c.description, c.file_url, c.file_name, c.file_type, c.file_size,
                c.thumbnail_url, c.created_at, c.updated_at,
                u.name as uploader_name, u.role as uploader_role,
                cat.name as category_name,
                (SELECT array_agg(t2.name)
                 FROM content_tags ct2
                 INNER JOIN tags t2 ON ct2.tag_id = t2.id
                 WHERE ct2.content_id = c.id) as tags,
                (SELECT array_agg(cat2.name)
                 FROM content_categories cc2
                 INNER JOIN categories cat2 ON cc2.category_id = cat2.id
                 WHERE cc2.content_id = c.id) as category_names,
                (SELECT array_agg(cat3.id)
                 FROM content_categories cc3
                 INNER JOIN categories cat3 ON cc3.category_id = cat3.id
                 WHERE cc3.content_id = c.id) as category_ids
         FROM contents c
         LEFT JOIN users u ON c.uploader_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         ${categoryJoin}
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
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: formatFileSize(row.file_size),
        thumbnailUrl: row.thumbnail_url,
        categoryName: row.category_name, // 하위 호환성 (첫 번째 카테고리)
        categoryNames: row.category_names || [], // 다중 카테고리 이름
        categoryIds: row.category_ids || [], // 다중 카테고리 ID
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
                u.name as uploader_name, u.username as uploader_username, u.role as uploader_role,
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

      // 다중 카테고리 조회
      const categoriesResult = await pool.query(
        `SELECT cat.id, cat.name FROM categories cat
         INNER JOIN content_categories cc ON cat.id = cc.category_id
         WHERE cc.content_id = $1`,
        [id]
      );

      res.json({
        success: true,
        data: {
          id: content.id,
          title: content.title,
          description: content.description,
          fileUrl: content.file_url,
          fileName: content.file_name,
          fileType: content.file_type,
          fileSize: formatFileSize(content.file_size),
          thumbnailUrl: content.thumbnail_url,
          ocrText: content.ocr_text,
          categoryId: content.category_id, // 하위 호환성
          categoryName: content.category_name, // 하위 호환성
          categories: categoriesResult.rows, // 다중 카테고리
          categoryIds: categoriesResult.rows.map((cat: any) => cat.id), // 다중 카테고리 ID
          uploaderId: content.uploader_id,
          uploaderName: content.uploader_name,
          uploaderUsername: content.uploader_username,
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

// PATCH /api/contents/:id - 콘텐츠 업데이트 (태그 수정 등)
router.patch(
  '/:id',
  authorize('ADMIN', 'CLIENT'),
  logActivity('UPDATE_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { title, description, tags } = req.body;

      // 콘텐츠 조회
      const contentResult = await pool.query(
        'SELECT id, uploader_id, editable_until FROM contents WHERE id = $1',
        [id]
      );

      if (contentResult.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      const content = contentResult.rows[0];

      // 권한 확인
      if (req.user!.role !== 'ADMIN' && content.uploader_id !== req.user!.id) {
        throw new AppError(403, '본인이 업로드한 콘텐츠만 수정할 수 있습니다');
      }

      // CLIENT의 경우 editable_until 확인
      if (req.user!.role === 'CLIENT' && content.editable_until) {
        const now = new Date();
        const editableUntil = new Date(content.editable_until);
        if (now > editableUntil) {
          throw new AppError(403, '수정 가능 시간이 만료되었습니다');
        }
      }

      // 콘텐츠 기본 정보 업데이트
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (title) {
        updateFields.push(`title = $${paramIndex}`);
        updateValues.push(title);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateValues.push(description);
        paramIndex++;
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(id);
        await pool.query(
          `UPDATE contents SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );
      }

      // 태그 업데이트
      if (tags && Array.isArray(tags)) {
        // 기존 태그 연결 삭제
        await pool.query('DELETE FROM content_tags WHERE content_id = $1', [id]);

        // 새 태그 추가
        for (const tagName of tags) {
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
            [id, tagId]
          );
        }

        // Elasticsearch 색인 업데이트
        try {
          const updatedContent = await pool.query(
            `SELECT c.*, u.name as uploader_name, u.role as member_type
             FROM contents c
             LEFT JOIN users u ON c.uploader_id = u.id
             WHERE c.id = $1`,
            [id]
          );

          if (updatedContent.rows.length > 0) {
            const contentData = updatedContent.rows[0];

            // 카테고리 이름 조회
            const categoryNamesResult = await pool.query(
              `SELECT cat.name FROM content_categories cc
               INNER JOIN categories cat ON cc.category_id = cat.id
               WHERE cc.content_id = $1`,
              [id]
            );
            const categoryNames = categoryNamesResult.rows.map((row: any) => row.name);

            // 카테고리 ID 조회
            const categoryIdsResult = await pool.query(
              `SELECT category_id FROM content_categories WHERE content_id = $1`,
              [id]
            );
            const categoryIds = categoryIdsResult.rows.map((row: any) => row.category_id);

            await indexContent({
              id: contentData.id,
              title: contentData.title,
              description: contentData.description,
              ocr_text: contentData.ocr_text,
              file_name: contentData.file_name || '',
              file_type: contentData.file_type,
              file_size: contentData.file_size,
              category_ids: categoryIds,
              category_names: categoryNames,
              tags: tags,
              uploader_id: contentData.uploader_id,
              uploader_name: contentData.uploader_name,
              member_type: contentData.member_type,
              created_at: contentData.created_at,
              updated_at: new Date(),
            });
          }
        } catch (esError: any) {
          console.error('[Update] Failed to update Elasticsearch index:', esError.message);
        }
      }

      res.json({
        success: true,
        message: '콘텐츠가 업데이트되었습니다',
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

// PATCH /api/contents/:id/categories - 카테고리 이동 (Admin only)
router.patch(
  '/:id/categories',
  authorize('ADMIN'),
  logActivity('MOVE_CONTENT_CATEGORIES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const { categoryIds } = req.body;

      // categoryIds 검증
      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        throw new AppError(400, '최소 1개의 카테고리를 선택해주세요');
      }

      if (categoryIds.length > 3) {
        throw new AppError(400, '카테고리는 최대 3개까지 선택 가능합니다');
      }

      // 콘텐츠 존재 확인
      const contentResult = await pool.query('SELECT id FROM contents WHERE id = $1', [id]);

      if (contentResult.rows.length === 0) {
        throw new AppError(404, '콘텐츠를 찾을 수 없습니다');
      }

      // 카테고리 존재 여부 검증
      const categoryCheck = await pool.query(
        'SELECT id FROM categories WHERE id = ANY($1)',
        [categoryIds]
      );

      if (categoryCheck.rows.length !== categoryIds.length) {
        throw new AppError(404, '존재하지 않는 카테고리가 포함되어 있습니다');
      }

      // 기존 카테고리 매핑 삭제
      await pool.query('DELETE FROM content_categories WHERE content_id = $1', [id]);

      // 새로운 카테고리 매핑 추가
      for (const categoryId of categoryIds) {
        await pool.query(
          'INSERT INTO content_categories (content_id, category_id) VALUES ($1, $2)',
          [id, categoryId]
        );
      }

      // contents 테이블의 category_id도 업데이트 (하위 호환성)
      await pool.query(
        'UPDATE contents SET category_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [categoryIds[0], id]
      );

      // 카테고리 이름 조회
      const categoryNamesResult = await pool.query(
        'SELECT name FROM categories WHERE id = ANY($1)',
        [categoryIds]
      );
      const categoryNames = categoryNamesResult.rows.map((row: any) => row.name);

      // Elasticsearch 색인 업데이트
      try {
        const contentData = await pool.query(
          `SELECT c.*, u.name as uploader_name, u.role as member_type
           FROM contents c
           LEFT JOIN users u ON c.uploader_id = u.id
           WHERE c.id = $1`,
          [id]
        );

        if (contentData.rows.length > 0) {
          const content = contentData.rows[0];

          // 태그 조회
          const tagsResult = await pool.query(
            `SELECT t.name FROM tags t
             INNER JOIN content_tags ct ON t.id = ct.tag_id
             WHERE ct.content_id = $1`,
            [id]
          );
          const tags = tagsResult.rows.map((row: any) => row.name);

          await indexContent({
            id: content.id,
            title: content.title,
            description: content.description,
            ocr_text: content.ocr_text,
            file_name: content.file_name || '',
            file_type: content.file_type,
            file_size: content.file_size,
            category_ids: categoryIds,
            category_names: categoryNames,
            tags,
            uploader_id: content.uploader_id,
            uploader_name: content.uploader_name,
            member_type: content.member_type,
            created_at: content.created_at,
            updated_at: new Date(),
          });

          console.log(`[Move Categories] Elasticsearch index updated for content: ${id}`);
        }
      } catch (esError: any) {
        console.error('[Move Categories] Failed to update Elasticsearch:', esError.message);
      }

      // 카테고리 캐시 무효화
      const { deleteCachePattern } = await import('../services/cache.service');
      await deleteCachePattern('categories:*');

      res.json({
        success: true,
        message: '카테고리가 변경되었습니다',
        data: {
          contentId: id,
          categoryIds,
          categoryNames,
        },
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

// DELETE /api/contents/:id - 콘텐츠 삭제 또는 카테고리에서 제거
router.delete(
  '/:id',
  authorize('ADMIN', 'CLIENT'),
  logActivity('DELETE_CONTENT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;
      const categoryId = req.query.categoryId as string | undefined;

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

      // categoryId가 제공된 경우: 해당 카테고리에서만 제거
      if (categoryId) {
        // 1. 해당 카테고리에서 콘텐츠 제거
        await pool.query(
          'DELETE FROM content_categories WHERE content_id = $1 AND category_id = $2',
          [id, categoryId]
        );

        // 2. 남은 카테고리 수 확인
        const remainingCategoriesResult = await pool.query(
          'SELECT COUNT(*) as count FROM content_categories WHERE content_id = $1',
          [id]
        );
        const remainingCount = parseInt(remainingCategoriesResult.rows[0].count);

        // 3. 남은 카테고리가 없으면 콘텐츠 완전 삭제
        if (remainingCount === 0) {
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

          // DB에서 완전 삭제
          await pool.query('DELETE FROM contents WHERE id = $1', [id]);

          // Elasticsearch 색인 삭제
          try {
            await deleteContentIndex(id);
            console.log(`[Delete] Content removed from Elasticsearch: ${id}`);
          } catch (esError: any) {
            console.error('[Delete] Failed to remove content from Elasticsearch:', esError.message);
          }

          // 카테고리 캐시 무효화
          const { deleteCachePattern } = await import('../services/cache.service');
          await deleteCachePattern('categories:*');

          res.json({
            success: true,
            message: '콘텐츠가 완전히 삭제되었습니다',
          });
        } else {
          // 카테고리에서만 제거됨
          // 카테고리 캐시 무효화
          const { deleteCachePattern } = await import('../services/cache.service');
          await deleteCachePattern('categories:*');

          res.json({
            success: true,
            message: `카테고리에서 제거되었습니다 (${remainingCount}개 카테고리에 남아있음)`,
          });
        }
      } else {
        // categoryId가 없는 경우: 완전 삭제 (기존 동작)
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

        // DB에서 삭제 (CASCADE로 content_tags, content_categories도 삭제됨)
        await pool.query('DELETE FROM contents WHERE id = $1', [id]);

        // Elasticsearch 색인 삭제
        try {
          await deleteContentIndex(id);
          console.log(`[Delete] Content removed from Elasticsearch: ${id}`);
        } catch (esError: any) {
          console.error('[Delete] Failed to remove content from Elasticsearch:', esError.message);
        }

        // 카테고리 캐시 무효화
        const { deleteCachePattern } = await import('../services/cache.service');
        await deleteCachePattern('categories:*');

        res.json({
          success: true,
          message: '콘텐츠가 삭제되었습니다',
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/contents/preview-tags - 파일 선택 시 태그 미리보기 (OCR + AI 태그 생성)
 * - 파일을 임시로 업로드하여 OCR + AI 태그만 생성
 * - DB에 저장하지 않음 (미리보기 전용)
 * - 사용자가 태그를 편집한 후 최종 업로드 가능
 */
router.post(
  '/preview-tags',
  authenticate,
  authorize('ADMIN', 'CLIENT', 'HOLDING', 'BANK'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadMultiple(req, res, (err) => {
      if (err) {
        console.error('[Preview Tags] Multer error:', err);
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
  logActivity('PREVIEW_TAGS'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const files = req.files as Express.Multer.File[];

      // 파일 검증
      if (!files || files.length === 0) {
        throw new AppError(400, '미리보기할 파일을 선택해주세요');
      }

      const previewResults = [];

      // 각 파일에 대해 OCR + AI 태그 생성
      for (const file of files) {
        const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        let ocrText: string | null = null;
        let tags: string[] = [];
        let thumbnailUrl: string | null = null;

        // 썸네일 생성 (이미지 파일만)
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

        // OCR + AI 태그 생성 (이미지 파일만)
        if (isOcrSupportedFile(file.filename)) {
          try {
            console.log('[Preview] OCR + AI processing file:', fileName);
            const originalPath = file.path;

            // OCR 텍스트 추출 + OpenAI 태그 생성 (크게 보이는 핵심 문구 기반 5개)
            const result = await extractTextAndGenerateTags(originalPath, 5);

            ocrText = result.ocrText || null;
            tags = result.tags || [];

            console.log('[Preview] Generated tags (top 5):', tags);
          } catch (error: any) {
            console.warn('[Preview] OCR/AI failed for file:', fileName, error.message);
            // 실패해도 계속 진행 (빈 태그로)
          }
        }

        previewResults.push({
          fileName,
          fileSize: file.size,
          fileType: getFileType(file.mimetype),
          thumbnailUrl,
          ocrText: ocrText ? ocrText.substring(0, 500) : null, // 미리보기용 500자만
          tags,
          tempFilePath: file.filename, // 최종 업로드 시 사용할 임시 파일명
        });
      }

      res.json({
        success: true,
        message: '태그 미리보기가 생성되었습니다',
        data: previewResults,
      });
    } catch (error) {
      console.error('[Preview Tags] Error:', error);
      next(error);
    }
  }
);

export default router;
