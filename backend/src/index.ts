import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';

dotenv.config();

const app: Application = express();
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

app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (업로드된 파일)
app.use('/uploads', express.static(uploadDir));

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  신한금융 광고관리 플랫폼 API 서버           ║
║  Port: ${PORT}
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Status: Running ✓                           ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
