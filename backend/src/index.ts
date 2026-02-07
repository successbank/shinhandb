import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';
import { checkConnection, initializeContentIndex } from './services/elasticsearch.service';

dotenv.config();

const app: Application = express();
app.set('trust proxy', true); // Traefik 리버스 프록시 뒤에서 실제 클라이언트 IP 추출
const PORT = process.env.PORT || 3001;

// 업로드 디렉토리 생성 (서버 시작 시)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const originalsDir = path.join(uploadDir, 'originals');
const thumbnailsDir = path.join(uploadDir, 'thumbnails');

[uploadDir, originalsDir, thumbnailsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Server] Created directory: ${dir}`);
  }
});

// 압축 미들웨어 (gzip) - 응답 크기 50% 이상 감소
app.use(compression({
  filter: (req: Request, res: Response) => {
    // 이미지 파일은 압축하지 않음 (이미 압축됨)
    if (req.path.startsWith('/uploads/')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // 압축 레벨 (1-9, 6이 기본값)
  threshold: 1024, // 1KB 이상일 때만 압축
}));

app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' })); // JSON 크기 제한 증가
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공 (업로드된 파일)
app.use('/uploads', express.static(uploadDir));

app.use('/api', routes);

app.use(errorHandler);

// Elasticsearch 초기화 및 서버 시작
async function startServer() {
  try {
    // Elasticsearch 연결 확인
    const esConnected = await checkConnection();
    if (esConnected) {
      // 콘텐츠 인덱스 초기화
      await initializeContentIndex();
    } else {
      console.warn('[Server] Elasticsearch not available - search features will be limited');
    }
  } catch (error) {
    console.error('[Server] Elasticsearch initialization failed:', error);
    console.warn('[Server] Continuing without Elasticsearch - search features will be limited');
  }

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  신한금융 광고관리 플랫폼 API 서버           ║
║  Port: ${PORT}
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Elasticsearch: ${process.env.ELASTICSEARCH_URL || 'N/A'}
║  Status: Running ✓                           ║
╚══════════════════════════════════════════════╝
    `);
  });
}

startServer();

export default app;
