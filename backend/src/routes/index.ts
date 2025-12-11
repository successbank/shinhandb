import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';

const router = Router();

router.get('/health', (req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    message: '신한금융 광고관리 플랫폼 API 서버가 정상 작동 중입니다.',
    data: {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    },
  });
});

router.get('/', (req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    message: 'Welcome to Shinhan Ad Management API',
    data: {
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        users: '/api/users',
        contents: '/api/contents',
        categories: '/api/categories',
        tags: '/api/tags',
        mypage: '/api/mypage',
        logs: '/api/logs',
      },
    },
  });
});

export default router;
