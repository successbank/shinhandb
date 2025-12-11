// User roles
export type UserRole = 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';

// User type
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Content type
export interface Content {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  ocrText?: string;
  uploaderId: string;
  categoryId: string;
  editableUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Category type
export interface Category {
  id: string;
  name: string;
  parentId?: string;
  userRole: UserRole;
  order: number;
}

// Tag type
export interface Tag {
  id: string;
  name: string;
  usageCount: number;
}

// API Response types
export interface ApiResponse<T> {
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
