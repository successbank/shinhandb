import { Request } from 'express';

export type UserRole = 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';

export interface User {
  id: string;
  username: string;
  name: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: any; // 메타데이터 (예: 전체 콘텐츠 수, 페이지네이션 정보 등)
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
