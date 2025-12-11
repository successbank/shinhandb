import { Request } from 'express';

export type UserRole = 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';

export interface User {
  id: string;
  email: string;
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
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
