import { generateThumbnail } from '../src/utils/thumbnail';
import fs from 'fs/promises';
import path from 'path';

/**
 * 기존 썸네일을 새로운 로직으로 재생성하는 스크립트
 * - fit: 'cover' → 'contain'으로 변경
 * - 크롭 없이 전체 이미지 표시
 */

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

async function regenerateAllThumbnails() {
  console.log('🔄 썸네일 재생성 시작...\n');

  try {
    // 원본 파일 목록 가져오기
    const originalFiles = await fs.readdir(ORIGINALS_DIR);

    console.log(`📁 원본 파일: ${originalFiles.length}개\n`);

    let successCount = 0;
    let failCount = 0;

    for (const filename of originalFiles) {
      const originalPath = path.join(ORIGINALS_DIR, filename);
      const thumbnailPath = path.join(THUMBNAILS_DIR, `thumb_${filename}`);

      try {
        // 파일 정보 확인
        const stats = await fs.stat(originalPath);

        if (!stats.isFile()) {
          console.log(`⏭️  Skip: ${filename} (not a file)`);
          continue;
        }

        // 이미지 파일만 처리 (확장자 확인)
        const ext = path.extname(filename).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        if (!imageExts.includes(ext)) {
          console.log(`⏭️  Skip: ${filename} (not an image)`);
          continue;
        }

        console.log(`🔨 Processing: ${filename}`);

        // 기존 썸네일 삭제 (있으면)
        try {
          await fs.unlink(thumbnailPath);
          console.log(`   ✓ Deleted old thumbnail`);
        } catch (error) {
          // 파일이 없어도 무시
        }

        // 새로운 썸네일 생성
        const success = await generateThumbnail(originalPath, thumbnailPath);

        if (success) {
          successCount++;
          console.log(`   ✅ Generated new thumbnail\n`);
        } else {
          failCount++;
          console.log(`   ❌ Failed to generate thumbnail\n`);
        }

      } catch (error) {
        failCount++;
        console.error(`   ❌ Error: ${error}\n`);
      }
    }

    console.log('\n📊 재생성 완료:');
    console.log(`   ✅ 성공: ${successCount}개`);
    console.log(`   ❌ 실패: ${failCount}개`);
    console.log(`   📁 전체: ${originalFiles.length}개`);

  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
regenerateAllThumbnails()
  .then(() => {
    console.log('\n✅ 모든 작업이 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  });
