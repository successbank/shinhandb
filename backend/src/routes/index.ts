import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import authRoutes from './auth';
import usersRoutes from './users';
import contentsRoutes from './contents';
import projectsRoutes from './projects';
import tagsRoutes from './tags';
import categoriesRoutes from './categories';
import mypageRoutes from './mypage';
import logsRoutes from './logs';
import adminRoutes from './admin';
import externalShareRoutes from './external-share';
import publicShareRoutes from './public-share';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Users routes (Admin only)
router.use('/users', usersRoutes);

// Contents routes (File upload & management)
router.use('/contents', contentsRoutes);

// Projects routes (Project-based upload)
router.use('/projects', projectsRoutes);

// Tags routes (Tag management)
router.use('/tags', tagsRoutes);

// Categories routes (Category management)
router.use('/categories', categoriesRoutes);

// My page routes (User specific features)
router.use('/mypage', mypageRoutes);

// Activity logs routes (Admin only)
router.use('/logs', logsRoutes);

// Admin dashboard routes (Admin only)
router.use('/admin', adminRoutes);

// External share routes (Admin only - 외부공유 관리)
router.use('/admin/external-shares', externalShareRoutes);

// Public share routes (No auth required - 외부 공개 접근)
router.use('/public/share', publicShareRoutes);

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
        projects: '/api/projects',
        categories: '/api/categories',
        tags: '/api/tags',
        mypage: '/api/mypage',
        logs: '/api/logs',
        admin: '/api/admin',
        externalShares: '/api/admin/external-shares',
        publicShare: '/api/public/share/:shareId',
      },
    },
  });
});

export default router;
