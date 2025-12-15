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

// 파일 타입 플래그 (제안 시안 / 최종 원고)
export type FileTypeFlag = 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT';

// 프로젝트 인터페이스
export interface Project {
  id: string;
  title: string;
  description?: string;
  uploaderId: string;
  uploaderName?: string;
  editableUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 콘텐츠 인터페이스 (기존에 없다면 추가, 있다면 확장)
export interface Content {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnailUrl?: string;
  ocrText?: string;
  categoryId: string;
  categoryName?: string;
  categoryIds?: string[];
  categoryNames?: string[];
  uploaderId: string;
  uploaderName?: string;
  projectId?: string; // 소속 프로젝트 ID (nullable)
  fileTypeFlag?: FileTypeFlag; // 파일 타입 플래그 (nullable)
  editableUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 파일이 포함된 프로젝트 인터페이스
export interface ProjectWithFiles extends Project {
  files: {
    proposalDrafts: Content[];
    finalManuscripts: Content[];
  };
  categories: Array<{ id: string; name: string }>;
  tags: string[];
  fileCount: {
    total: number;
    proposal: number;
    final: number;
  };
  thumbnailUrl?: string;
}

// 카테고리 인터페이스 (기존에 없다면 추가)
export interface Category {
  id: string;
  name: string;
  userRole?: UserRole;
  parentId?: string;
  contentCount?: number;
}
