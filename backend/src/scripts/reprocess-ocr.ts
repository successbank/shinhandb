/**
 * 기존 콘텐츠 OCR + AI 태그 재처리 스크립트
 * - 이미 업로드된 이미지 콘텐츠에 대해 OCR 재실행
 * - AI 기반 자동 태그 생성
 * - 데이터베이스 및 Elasticsearch 업데이트
 */

import { pool } from '../db';
import { extractTextAndGenerateTags, isOcrSupportedFile } from '../services/ocr';
import { indexContent } from '../services/elasticsearch.service';
import path from 'path';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

interface Content {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploader_id: string;
  uploader_name: string;
  uploader_role: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  OCR + AI 태그 재처리 스크립트              ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    // 1. 이미지 콘텐츠 목록 조회
    console.log('[1/4] 이미지 콘텐츠 조회 중...');
    const result = await pool.query<Content>(
      `SELECT c.id, c.title, c.description, c.file_url, c.file_name, c.file_type, c.file_size,
              c.created_at, c.updated_at,
              u.id as uploader_id, u.name as uploader_name, u.role as uploader_role
       FROM contents c
       LEFT JOIN users u ON c.uploader_id = u.id
       WHERE c.file_type = 'image'
       ORDER BY c.created_at DESC`
    );

    const contents = result.rows;
    console.log(`✅ 총 ${contents.length}개의 이미지 콘텐츠 발견\n`);

    if (contents.length === 0) {
      console.log('⚠️  처리할 콘텐츠가 없습니다.');
      return;
    }

    // 2. 각 콘텐츠에 대해 OCR + AI 태그 생성
    console.log('[2/4] OCR + AI 태그 생성 중...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      const progress = `[${i + 1}/${contents.length}]`;

      console.log(`${progress} 처리 중: ${content.title}`);
      console.log(`  파일: ${content.file_name}`);

      // OCR 지원 파일 확인
      const fileName = content.file_url.split('/').pop() || '';
      if (!isOcrSupportedFile(fileName)) {
        console.log(`  ⏭️  OCR 미지원 형식, 스킵\n`);
        skipCount++;
        continue;
      }

      try {
        // 파일 경로 구성 (Docker 컨테이너 내부 경로)
        const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
        const filePath = path.join(uploadDir, 'originals', fileName);

        // OCR + AI 태그 생성
        console.log(`  🤖 OpenAI Vision 처리 중...`);
        const { ocrText, tags } = await extractTextAndGenerateTags(filePath, 10);

        if (!ocrText && tags.length === 0) {
          console.log(`  ⚠️  텍스트 추출 실패 (텍스트 없음)\n`);
          skipCount++;
          continue;
        }

        // OCR 텍스트 DB 업데이트
        await pool.query(
          `UPDATE contents SET ocr_text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [ocrText, content.id]
        );

        console.log(`  📝 OCR 텍스트: ${ocrText.substring(0, 50)}...`);

        // 태그 저장
        if (tags.length > 0) {
          console.log(`  🏷️  AI 태그 (${tags.length}개): ${tags.join(', ')}`);

          for (const tagName of tags) {
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
              `INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [content.id, tagId]
            );
          }
        } else {
          console.log(`  🏷️  AI 태그: (없음)`);
        }

        // Elasticsearch 재색인
        try {
          // 카테고리 정보 조회
          const categoriesResult = await pool.query(
            `SELECT cat.id, cat.name FROM content_categories cc
             INNER JOIN categories cat ON cc.category_id = cat.id
             WHERE cc.content_id = $1`,
            [content.id]
          );
          const categoryIds = categoriesResult.rows.map((row: any) => row.id);
          const categoryNames = categoriesResult.rows.map((row: any) => row.name);

          // 모든 태그 조회 (새로 추가된 것 포함)
          const allTagsResult = await pool.query(
            `SELECT t.name FROM content_tags ct
             INNER JOIN tags t ON ct.tag_id = t.id
             WHERE ct.content_id = $1`,
            [content.id]
          );
          const allTags = allTagsResult.rows.map((row: any) => row.name);

          await indexContent({
            id: content.id,
            title: content.title,
            description: content.description,
            ocr_text: ocrText,
            file_name: content.file_name || '',
            file_type: content.file_type,
            file_size: content.file_size,
            category_ids: categoryIds,
            category_names: categoryNames,
            tags: allTags,
            uploader_id: content.uploader_id,
            uploader_name: content.uploader_name,
            member_type: content.uploader_role,
            created_at: content.created_at,
            updated_at: new Date(),
          });

          console.log(`  🔍 Elasticsearch 색인 완료`);
        } catch (esError: any) {
          console.error(`  ⚠️  Elasticsearch 색인 실패:`, esError.message);
        }

        successCount++;
        console.log(`  ✅ 완료\n`);

        // API Rate Limit 방지를 위한 딜레이 (OpenAI API)
        if (i < contents.length - 1) {
          console.log(`  ⏳ 다음 처리까지 2초 대기 (API Rate Limit 방지)...\n`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`  ❌ 오류: ${error.message}\n`);
        errorCount++;
      }
    }

    // 3. 결과 요약
    console.log('\n[3/4] 처리 완료 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`총 콘텐츠:    ${contents.length}개`);
    console.log(`✅ 성공:      ${successCount}개`);
    console.log(`⏭️  스킵:      ${skipCount}개`);
    console.log(`❌ 실패:      ${errorCount}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4. 통계 조회
    console.log('[4/4] 최종 통계 조회 중...\n');

    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM contents WHERE file_type = 'image') as total_images,
        (SELECT COUNT(*) FROM contents WHERE file_type = 'image' AND ocr_text IS NOT NULL AND ocr_text != '') as ocr_processed,
        (SELECT COUNT(*) FROM tags) as total_tags,
        (SELECT COUNT(DISTINCT content_id) FROM content_tags) as contents_with_tags
    `);

    const stats = statsResult.rows[0];
    console.log('📊 최종 통계');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`전체 이미지:         ${stats.total_images}개`);
    console.log(`OCR 처리됨:          ${stats.ocr_processed}개 (${Math.round((stats.ocr_processed / stats.total_images) * 100)}%)`);
    console.log(`전체 태그:           ${stats.total_tags}개`);
    console.log(`태그 보유 콘텐츠:    ${stats.contents_with_tags}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ OCR + AI 태그 재처리 완료!\n');
  } catch (error: any) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  } finally {
    // DB 연결 종료
    await pool.end();
  }
}

// 스크립트 실행
main();
