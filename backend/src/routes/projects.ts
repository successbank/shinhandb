import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, Project, ProjectWithFiles, FileTypeFlag } from '../types';
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
import { indexContent, deleteContentIndex } from '../services/elasticsearch.service';
import { deleteCache, CacheKeys } from '../services/cache.service';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// 모든 프로젝트 API는 인증 필요
router.use(authenticate);

/**
 * POST /api/projects
 * 프로젝트 생성
 */
router.post(
  '/',
  authorize('ADMIN', 'CLIENT'),
  logActivity('CREATE_PROJECT'),
  async (req: AuthRequest, res: Response<ApiResponse<Project>>, next) => {
    try {
      const { title, description, categoryIds } = req.body;

      // 제목 검증
      if (!title || !title.trim()) {
        throw new AppError(400, '프로젝트 제목을 입력해주세요');
      }

      // 제목 길이 검증 (255자 제한)
      if (title.length > 255) {
        throw new AppError(400, '제목은 최대 255자까지 입력 가능합니다');
      }

      // 줄 수 제한 (최대 2줄)
      const lines = title.split('\n').filter((line: string) => line.trim().length > 0);
      if (lines.length > 2) {
        throw new AppError(400, '제목은 최대 2줄까지 가능합니다');
      }

      // 카테고리 처리
      let categoryIdsArray: string[] = [];
      if (categoryIds) {
        categoryIdsArray = Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds);

        // 최대 3개 제한
        if (categoryIdsArray.length > 3) {
          throw new AppError(400, '카테고리는 최대 3개까지 선택 가능합니다');
        }
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

      // CLIENT인 경우 수정 시간 제한 (30분)
      let editableUntil: Date | null = null;
      if (req.user!.role === 'CLIENT') {
        editableUntil = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
      }

      // 프로젝트 생성
      const result = await pool.query(
        `INSERT INTO projects (title, description, uploader_id, editable_until)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, description, uploader_id AS "uploaderId",
                   editable_until AS "editableUntil", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [title.trim(), description?.trim() || null, req.user!.id, editableUntil]
      );

      const project = result.rows[0];

      // 프로젝트-카테고리 다대다 관계 생성
      for (const catId of categoryIdsArray) {
        await pool.query(
          `INSERT INTO project_categories (project_id, category_id)
           VALUES ($1, $2)
           ON CONFLICT (project_id, category_id) DO NOTHING`,
          [project.id, catId]
        );
      }

      // 카테고리 정보 조회
      const categoriesResult = await pool.query(
        `SELECT c.id, c.name
         FROM categories c
         INNER JOIN project_categories pc ON c.id = pc.category_id
         WHERE pc.project_id = $1`,
        [project.id]
      );

      // 카테고리 캐시 무효화 (프로젝트 개수가 변경됨)
      await deleteCache(CacheKeys.categories('all'));
      await deleteCache(CacheKeys.categories('HOLDING'));
      await deleteCache(CacheKeys.categories('BANK'));

      res.status(201).json({
        success: true,
        message: '프로젝트가 생성되었습니다',
        data: {
          ...project,
          categories: categoriesResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/projects/:id/files
 * 프로젝트에 파일 업로드
 */
router.post(
  '/:id/files',
  authorize('ADMIN', 'CLIENT'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadMultiple(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(413, '파일 크기가 10MB를 초과합니다'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError(400, '파일은 최대 10개까지 업로드 가능합니다'));
        }
        return next(new AppError(400, err.message));
      }
      next();
    });
  },
  logActivity('ADD_PROJECT_FILES'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id: projectId } = req.params;
      const files = req.files as Express.Multer.File[];
      const { fileMeta, tags } = req.body;

      // 파일 검증
      if (!files || files.length === 0) {
        throw new AppError(400, '업로드할 파일을 선택해주세요');
      }

      // 프로젝트 존재 및 권한 확인
      const projectResult = await pool.query(
        `SELECT p.*, u.name as uploader_name,
         (SELECT category_id FROM project_categories WHERE project_id = p.id LIMIT 1) as first_category_id
         FROM projects p
         INNER JOIN users u ON p.uploader_id = u.id
         WHERE p.id = $1`,
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 권한 확인: ADMIN 또는 프로젝트 소유자
      if (req.user!.role !== 'ADMIN' && project.uploader_id !== req.user!.id) {
        throw new AppError(403, '이 프로젝트에 파일을 추가할 권한이 없습니다');
      }

      // CLIENT인 경우 수정 시간 제한 확인
      if (req.user!.role === 'CLIENT' && project.editable_until) {
        if (new Date() > new Date(project.editable_until)) {
          throw new AppError(403, '수정 가능 시간이 만료되었습니다');
        }
      }

      // fileMeta 파싱
      let fileMetaArray: Array<{ fileTypeFlag: FileTypeFlag }> = [];
      if (fileMeta) {
        fileMetaArray = typeof fileMeta === 'string' ? JSON.parse(fileMeta) : fileMeta;
      }

      // 파일 수와 fileMeta 수가 일치하는지 확인
      if (fileMetaArray.length !== files.length) {
        throw new AppError(400, '파일 타입 정보가 누락되었습니다');
      }

      // 태그 파싱
      const tagArray = tags
        ? (typeof tags === 'string' ? JSON.parse(tags) : tags)
        : [];

      const uploadedContents = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = fileMetaArray[i];

        // 파일 타입 플래그 검증
        if (!meta.fileTypeFlag || !['PROPOSAL_DRAFT', 'FINAL_MANUSCRIPT'].includes(meta.fileTypeFlag)) {
          throw new AppError(400, `파일 ${i + 1}의 타입이 올바르지 않습니다`);
        }

        // 파일 정보
        const fileUrl = `/uploads/originals/${file.filename}`;
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
        let generatedTags: string[] = [];
        if (isOcrSupportedFile(file.filename)) {
          const originalPath = file.path;
          try {
            const ocrResult = await extractTextAndGenerateTags(originalPath, 5);
            ocrText = ocrResult.ocrText || null;
            generatedTags = ocrResult.tags || [];
            console.log(`[OCR] ${fileName} - 태그 ${generatedTags.length}개 생성`);
          } catch (ocrError) {
            console.error('[OCR] 실패:', ocrError);
          }
        }

        // contents 테이블에 삽입
        const contentResult = await pool.query(
          `INSERT INTO contents
           (title, file_url, file_name, file_type, file_size, thumbnail_url,
            category_id, uploader_id, ocr_text, project_id, file_type_flag)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, title, file_url AS "fileUrl", file_name AS "fileName",
                     file_type AS "fileType", file_size AS "fileSize",
                     thumbnail_url AS "thumbnailUrl", ocr_text AS "ocrText",
                     project_id AS "projectId", file_type_flag AS "fileTypeFlag",
                     created_at AS "createdAt"`,
          [
            project.title, // 프로젝트 제목을 콘텐츠 제목으로 사용
            fileUrl,
            fileName,
            fileType,
            fileSize,
            thumbnailUrl,
            project.first_category_id, // 프로젝트의 첫 번째 카테고리 ID
            req.user!.id,
            ocrText,
            projectId,
            meta.fileTypeFlag,
          ]
        );

        const newContent = contentResult.rows[0];

        // 태그 처리 (수동 + 자동)
        const allTags = [...tagArray, ...generatedTags];
        const uniqueTags = [...new Set(allTags)];

        for (const tagName of uniqueTags) {
          // 태그 생성 또는 usage_count 증가
          const tagResult = await pool.query(
            `INSERT INTO tags (name, usage_count)
             VALUES ($1, 1)
             ON CONFLICT (name)
             DO UPDATE SET usage_count = tags.usage_count + 1
             RETURNING id`,
            [tagName.trim()]
          );

          const tagId = tagResult.rows[0].id;

          // content_tags 다대다 관계 생성
          await pool.query(
            `INSERT INTO content_tags (content_id, tag_id)
             VALUES ($1, $2)
             ON CONFLICT (content_id, tag_id) DO NOTHING`,
            [newContent.id, tagId]
          );
        }

        // Elasticsearch 색인
        try {
          await indexContent({
            id: newContent.id,
            title: newContent.title,
            file_name: newContent.fileName,
            file_type: newContent.fileType,
            file_size: newContent.fileSize,
            ocr_text: newContent.ocrText || '',
            tags: uniqueTags,
            uploader_id: req.user!.id,
            uploader_name: req.user!.name,
            member_type: req.user!.role,
            created_at: newContent.createdAt,
            updated_at: newContent.createdAt,
            project_id: projectId,
            project_title: project.title,
            file_type_flag: meta.fileTypeFlag,
          });
        } catch (esError) {
          console.error('[Elasticsearch] 색인 실패:', esError);
        }

        uploadedContents.push({
          ...newContent,
          generatedTags,
          allTags: uniqueTags,
        });
      }

      res.status(201).json({
        success: true,
        message: `${files.length}개의 파일이 업로드되었습니다`,
        data: uploadedContents,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects
 * 프로젝트 목록 조회
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response<ApiResponse<any>>, next) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        categoryId,
        search,
        startDate,
        endDate,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const pageSizeNum = parseInt(pageSize as string, 10);
      const offset = (pageNum - 1) * pageSizeNum;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // 카테고리 필터 (EXISTS 사용하여 JOIN 제거)
      if (categoryId) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM project_categories pc
          WHERE pc.project_id = p.id AND pc.category_id = $${paramIndex++}
        )`);
        queryParams.push(categoryId);
      }

      // 검색어 필터 (프로젝트 제목 또는 태그 검색)
      if (search) {
        whereConditions.push(`(
          p.title ILIKE $${paramIndex} OR
          EXISTS (
            SELECT 1 FROM contents c
            INNER JOIN content_tags ct ON c.id = ct.content_id
            INNER JOIN tags t ON ct.tag_id = t.id
            WHERE c.project_id = p.id AND t.name ILIKE $${paramIndex}
          )
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // 날짜 범위 필터
      if (startDate) {
        whereConditions.push(`p.created_at >= $${paramIndex++}`);
        queryParams.push(startDate);
      }
      if (endDate) {
        whereConditions.push(`p.created_at <= $${paramIndex++}`);
        queryParams.push(endDate);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // 총 개수 조회
      const countQuery = `
        SELECT COUNT(*) as total
        FROM projects p
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total, 10);

      // 프로젝트 목록 조회
      const projectsQuery = `
        SELECT
          p.id,
          p.title,
          p.description,
          p.uploader_id AS "uploaderId",
          u.name AS "uploaderName",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          -- 파일 개수
          (SELECT COUNT(*) FROM contents WHERE project_id = p.id) AS total_files,
          (SELECT COUNT(*) FROM contents WHERE project_id = p.id AND file_type_flag = 'PROPOSAL_DRAFT') AS proposal_files,
          (SELECT COUNT(*) FROM contents WHERE project_id = p.id AND file_type_flag = 'FINAL_MANUSCRIPT') AS final_files,
          -- 썸네일 (최종 원고 이미지 우선, 없으면 시안)
          COALESCE(
            (SELECT thumbnail_url FROM contents
             WHERE project_id = p.id
               AND thumbnail_url IS NOT NULL
               AND file_type_flag = 'FINAL_MANUSCRIPT'
             ORDER BY created_at ASC LIMIT 1),
            (SELECT thumbnail_url FROM contents
             WHERE project_id = p.id
               AND thumbnail_url IS NOT NULL
               AND file_type_flag = 'PROPOSAL_DRAFT'
             ORDER BY created_at ASC LIMIT 1)
          ) AS thumbnail_url,
          -- 카테고리 배열
          (SELECT array_agg(json_build_object('id', c.id, 'name', c.name))
           FROM categories c
           INNER JOIN project_categories pc2 ON c.id = pc2.category_id
           WHERE pc2.project_id = p.id) AS categories
        FROM projects p
        INNER JOIN users u ON p.uploader_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC, p.id
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(pageSizeNum, offset);

      const projectsResult = await pool.query(projectsQuery, queryParams);

      const projects = projectsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        uploaderId: row.uploaderId,
        uploaderName: row.uploaderName,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        fileCount: {
          total: parseInt(row.total_files, 10),
          proposal: parseInt(row.proposal_files, 10),
          final: parseInt(row.final_files, 10),
        },
        thumbnailUrl: row.thumbnail_url,
        categories: row.categories || [],
      }));

      res.json({
        success: true,
        data: {
          projects: projects,
          pagination: {
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: Math.ceil(total / pageSizeNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/:id
 * 프로젝트 상세 조회
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response<ApiResponse<ProjectWithFiles>>, next) => {
    try {
      const { id } = req.params;

      // 프로젝트 정보 조회
      const projectResult = await pool.query(
        `SELECT p.*, u.name as uploader_name
         FROM projects p
         INNER JOIN users u ON p.uploader_id = u.id
         WHERE p.id = $1`,
        [id]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 카테고리 조회
      const categoriesResult = await pool.query(
        `SELECT c.id, c.name
         FROM categories c
         INNER JOIN project_categories pc ON c.id = pc.category_id
         WHERE pc.project_id = $1`,
        [id]
      );

      // 파일 목록 조회 (타입별 분리)
      // 정렬: FINAL_MANUSCRIPT가 먼저 오도록 DESC 정렬
      const filesResult = await pool.query(
        `SELECT
          c.id,
          c.title,
          c.file_url AS "fileUrl",
          c.file_name AS "fileName",
          c.file_type AS "fileType",
          c.file_size AS "fileSize",
          c.thumbnail_url AS "thumbnailUrl",
          c.ocr_text AS "ocrText",
          c.file_type_flag AS "fileTypeFlag",
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          -- 태그 배열
          (SELECT array_agg(t.name)
           FROM tags t
           INNER JOIN content_tags ct ON t.id = ct.tag_id
           WHERE ct.content_id = c.id) AS tags
         FROM contents c
         WHERE c.project_id = $1
         ORDER BY c.file_type_flag DESC, c.created_at ASC`,
        [id]
      );

      // 파일 타입별 그룹화
      const proposalDrafts = filesResult.rows.filter(
        (f) => f.fileTypeFlag === 'PROPOSAL_DRAFT'
      );
      const finalManuscripts = filesResult.rows.filter(
        (f) => f.fileTypeFlag === 'FINAL_MANUSCRIPT'
      );

      // 전체 태그 수집
      const allTags = filesResult.rows
        .flatMap((f) => f.tags || [])
        .filter((tag, index, self) => self.indexOf(tag) === index);

      const projectWithFiles: ProjectWithFiles = {
        id: project.id,
        title: project.title,
        description: project.description,
        uploaderId: project.uploader_id,
        uploaderName: project.uploader_name,
        editableUntil: project.editable_until,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        files: {
          proposalDrafts,
          finalManuscripts,
        },
        categories: categoriesResult.rows,
        tags: allTags,
        fileCount: {
          total: filesResult.rows.length,
          proposal: proposalDrafts.length,
          final: finalManuscripts.length,
        },
        thumbnailUrl:
          filesResult.rows.find((f) => f.thumbnailUrl && f.fileTypeFlag === 'FINAL_MANUSCRIPT')?.thumbnailUrl ||
          filesResult.rows.find((f) => f.thumbnailUrl && f.fileTypeFlag === 'PROPOSAL_DRAFT')?.thumbnailUrl ||
          undefined,
      };

      res.json({
        success: true,
        data: projectWithFiles,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/projects/:id
 * 프로젝트 정보 수정
 */
router.patch(
  '/:id',
  authorize('ADMIN', 'CLIENT'),
  logActivity('UPDATE_PROJECT'),
  async (req: AuthRequest, res: Response<ApiResponse<Project>>, next) => {
    try {
      const { id } = req.params;
      const { title, description, categoryIds } = req.body;

      // 프로젝트 존재 및 권한 확인
      const projectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 권한 확인: ADMIN 또는 프로젝트 소유자
      if (req.user!.role !== 'ADMIN' && project.uploader_id !== req.user!.id) {
        throw new AppError(403, '이 프로젝트를 수정할 권한이 없습니다');
      }

      // CLIENT인 경우 수정 시간 제한 확인
      if (req.user!.role === 'CLIENT' && project.editable_until) {
        if (new Date() > new Date(project.editable_until)) {
          throw new AppError(403, '수정 가능 시간이 만료되었습니다');
        }
      }

      // 제목 검증 (업데이트 시)
      if (title) {
        if (!title.trim()) {
          throw new AppError(400, '프로젝트 제목을 입력해주세요');
        }

        // 제목 길이 검증 (255자 제한)
        if (title.length > 255) {
          throw new AppError(400, '제목은 최대 255자까지 입력 가능합니다');
        }

        // 줄 수 제한 (최대 2줄)
        const lines = title.split('\n').filter((line: string) => line.trim().length > 0);
        if (lines.length > 2) {
          throw new AppError(400, '제목은 최대 2줄까지 가능합니다');
        }
      }

      // 프로젝트 정보 업데이트
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (title) {
        updateFields.push(`title = $${paramIndex++}`);
        updateParams.push(title.trim());
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateParams.push(description?.trim() || null);
      }

      if (updateFields.length > 0) {
        updateParams.push(id);
        const updateQuery = `
          UPDATE projects
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING id, title, description, uploader_id AS "uploaderId",
                    editable_until AS "editableUntil", created_at AS "createdAt",
                    updated_at AS "updatedAt"
        `;
        const result = await pool.query(updateQuery, updateParams);
        project.title = result.rows[0].title;
        project.description = result.rows[0].description;
      }

      // 카테고리 업데이트
      if (categoryIds) {
        const categoryIdsArray = Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds);

        if (categoryIdsArray.length > 3) {
          throw new AppError(400, '카테고리는 최대 3개까지 선택 가능합니다');
        }

        // 기존 카테고리 삭제
        await pool.query('DELETE FROM project_categories WHERE project_id = $1', [id]);

        // 새 카테고리 추가
        for (const catId of categoryIdsArray) {
          await pool.query(
            `INSERT INTO project_categories (project_id, category_id)
             VALUES ($1, $2)`,
            [id, catId]
          );
        }

        // 카테고리 캐시 무효화 (카테고리 변경으로 프로젝트 개수 변경 가능)
        await deleteCache(CacheKeys.categories('all'));
        await deleteCache(CacheKeys.categories('HOLDING'));
        await deleteCache(CacheKeys.categories('BANK'));
      }

      res.json({
        success: true,
        message: '프로젝트가 수정되었습니다',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/projects/:id
 * 프로젝트 삭제 (연결된 파일들도 함께 삭제)
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'CLIENT'),
  logActivity('DELETE_PROJECT'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { id } = req.params;

      // 프로젝트 존재 및 권한 확인
      const projectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 권한 확인: ADMIN 또는 프로젝트 소유자
      if (req.user!.role !== 'ADMIN' && project.uploader_id !== req.user!.id) {
        throw new AppError(403, '이 프로젝트를 삭제할 권한이 없습니다');
      }

      // 프로젝트에 속한 파일 목록 조회
      const filesResult = await pool.query(
        'SELECT id, file_url, thumbnail_url FROM contents WHERE project_id = $1',
        [id]
      );

      // 물리적 파일 삭제
      for (const file of filesResult.rows) {
        try {
          // 원본 파일 삭제
          if (file.file_url) {
            const originalPath = path.join(__dirname, '../../', file.file_url);
            await fs.unlink(originalPath);
          }

          // 썸네일 삭제
          if (file.thumbnail_url) {
            const thumbPath = path.join(__dirname, '../../', file.thumbnail_url);
            await fs.unlink(thumbPath);
          }

          // Elasticsearch 색인 삭제
          await deleteContentIndex(file.id);
        } catch (fileError) {
          console.error(`[파일 삭제 실패] ${file.id}:`, fileError);
        }
      }

      // 프로젝트 삭제 (CASCADE로 연결된 데이터도 자동 삭제)
      await pool.query('DELETE FROM projects WHERE id = $1', [id]);

      // 카테고리 캐시 무효화 (프로젝트 개수가 감소함)
      await deleteCache(CacheKeys.categories('all'));
      await deleteCache(CacheKeys.categories('HOLDING'));
      await deleteCache(CacheKeys.categories('BANK'));

      res.json({
        success: true,
        message: '프로젝트가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/projects/:projectId/files/:fileId
 * 파일 타입 변경 (제안 시안 ↔ 최종 원고)
 */
router.patch(
  '/:projectId/files/:fileId',
  authorize('ADMIN', 'CLIENT'),
  logActivity('UPDATE_FILE_TYPE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { projectId, fileId } = req.params;
      const { fileTypeFlag } = req.body;

      // 파일 타입 검증
      if (!fileTypeFlag || !['PROPOSAL_DRAFT', 'FINAL_MANUSCRIPT'].includes(fileTypeFlag)) {
        throw new AppError(400, '유효한 파일 타입을 입력해주세요 (PROPOSAL_DRAFT, FINAL_MANUSCRIPT)');
      }

      // 프로젝트 존재 및 권한 확인
      const projectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 권한 확인: ADMIN 또는 프로젝트 소유자
      if (req.user!.role !== 'ADMIN' && project.uploader_id !== req.user!.id) {
        throw new AppError(403, '이 프로젝트의 파일을 수정할 권한이 없습니다');
      }

      // CLIENT인 경우 수정 시간 제한 확인
      if (req.user!.role === 'CLIENT' && project.editable_until) {
        if (new Date() > new Date(project.editable_until)) {
          throw new AppError(403, '수정 가능 시간이 만료되었습니다');
        }
      }

      // 파일 존재 및 프로젝트 소속 확인
      const fileResult = await pool.query(
        'SELECT * FROM contents WHERE id = $1 AND project_id = $2',
        [fileId, projectId]
      );

      if (fileResult.rows.length === 0) {
        throw new AppError(404, '파일을 찾을 수 없습니다');
      }

      const file = fileResult.rows[0];

      // 파일 타입 업데이트
      const updateResult = await pool.query(
        `UPDATE contents
         SET file_type_flag = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, file_type_flag AS "fileTypeFlag", updated_at AS "updatedAt"`,
        [fileTypeFlag, fileId]
      );

      // Elasticsearch 색인 업데이트
      try {
        await indexContent({
          id: file.id,
          title: file.title,
          file_name: file.file_name,
          file_type: file.file_type,
          file_size: file.file_size,
          ocr_text: file.ocr_text || '',
          tags: [], // 태그는 별도 조회 필요하지만 생략
          uploader_id: file.uploader_id,
          uploader_name: req.user!.name,
          member_type: req.user!.role,
          created_at: file.created_at,
          updated_at: new Date(),
          project_id: projectId,
          project_title: project.title,
          file_type_flag: fileTypeFlag,
        });
      } catch (esError) {
        console.error('[Elasticsearch] 색인 업데이트 실패:', esError);
      }

      res.json({
        success: true,
        message: '파일 타입이 변경되었습니다',
        data: updateResult.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/projects/:projectId/files/:fileId
 * 개별 파일 삭제
 */
router.delete(
  '/:projectId/files/:fileId',
  authorize('ADMIN', 'CLIENT'),
  logActivity('DELETE_FILE'),
  async (req: AuthRequest, res: Response<ApiResponse>, next) => {
    try {
      const { projectId, fileId } = req.params;

      // 프로젝트 존재 및 권한 확인
      const projectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        throw new AppError(404, '프로젝트를 찾을 수 없습니다');
      }

      const project = projectResult.rows[0];

      // 권한 확인: ADMIN 또는 프로젝트 소유자
      if (req.user!.role !== 'ADMIN' && project.uploader_id !== req.user!.id) {
        throw new AppError(403, '이 프로젝트의 파일을 삭제할 권한이 없습니다');
      }

      // CLIENT인 경우 수정 시간 제한 확인
      if (req.user!.role === 'CLIENT' && project.editable_until) {
        if (new Date() > new Date(project.editable_until)) {
          throw new AppError(403, '수정 가능 시간이 만료되었습니다');
        }
      }

      // 파일 존재 및 프로젝트 소속 확인
      const fileResult = await pool.query(
        'SELECT * FROM contents WHERE id = $1 AND project_id = $2',
        [fileId, projectId]
      );

      if (fileResult.rows.length === 0) {
        throw new AppError(404, '파일을 찾을 수 없습니다');
      }

      const file = fileResult.rows[0];

      // 물리적 파일 삭제
      try {
        // 원본 파일 삭제
        if (file.file_url) {
          const originalPath = path.join(__dirname, '../../', file.file_url);
          await fs.unlink(originalPath);
        }

        // 썸네일 삭제
        if (file.thumbnail_url) {
          const thumbPath = path.join(__dirname, '../../', file.thumbnail_url);
          await fs.unlink(thumbPath);
        }
      } catch (fileError) {
        console.error(`[파일 삭제 실패] ${file.id}:`, fileError);
      }

      // Elasticsearch 색인 삭제
      try {
        await deleteContentIndex(file.id);
      } catch (esError) {
        console.error('[Elasticsearch] 색인 삭제 실패:', esError);
      }

      // 데이터베이스에서 삭제
      await pool.query('DELETE FROM contents WHERE id = $1', [fileId]);

      res.json({
        success: true,
        message: '파일이 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
