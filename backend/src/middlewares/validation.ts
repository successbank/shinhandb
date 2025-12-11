import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { AppError } from './errorHandler';

/**
 * 입력 데이터 검증 미들웨어
 */

/**
 * 이메일 형식 검증
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 비밀번호 강도 검증
 * - 최소 8자
 * - 영문, 숫자, 특수문자 중 2가지 이상 포함 권장
 */
export const validatePassword = (password: string): boolean => {
  if (password.length < 8) {
    return false;
  }

  // 영문, 숫자, 특수문자 체크
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  // 2가지 이상 포함되어야 함
  const typeCount = [hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
  return typeCount >= 2;
};

/**
 * 사용자 역할 검증
 */
export const validateUserRole = (role: string): role is UserRole => {
  const validRoles: UserRole[] = ['ADMIN', 'HOLDING', 'BANK', 'CLIENT'];
  return validRoles.includes(role as UserRole);
};

/**
 * 사용자 생성 데이터 검증 미들웨어
 */
export const validateUserCreation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, role, password } = req.body;

    // 필수 항목 검증
    if (!email || !name || !role) {
      throw new AppError(400, '필수 항목을 모두 입력해주세요 (email, name, role)');
    }

    // 이메일 형식 검증
    if (!validateEmail(email)) {
      throw new AppError(400, '올바른 이메일 형식이 아닙니다');
    }

    // 역할 검증
    if (!validateUserRole(role)) {
      throw new AppError(400, '유효하지 않은 역할입니다 (ADMIN, HOLDING, BANK, CLIENT)');
    }

    // 비밀번호가 제공된 경우 검증
    if (password && !validatePassword(password)) {
      throw new AppError(
        400,
        '비밀번호는 최소 8자 이상이며, 영문/숫자/특수문자 중 2가지 이상을 포함해야 합니다'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 수정 데이터 검증 미들웨어
 */
export const validateUserUpdate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role } = req.body;

    // 이메일이 제공된 경우 형식 검증
    if (email && !validateEmail(email)) {
      throw new AppError(400, '올바른 이메일 형식이 아닙니다');
    }

    // 역할이 제공된 경우 검증
    if (role && !validateUserRole(role)) {
      throw new AppError(400, '유효하지 않은 역할입니다 (ADMIN, HOLDING, BANK, CLIENT)');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * UUID 형식 검증
 */
export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * UUID 파라미터 검증 미들웨어
 */
export const validateUUIDParam = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const uuid = req.params[paramName];

      if (!uuid || !validateUUID(uuid)) {
        throw new AppError(400, `유효하지 않은 ${paramName} 형식입니다`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 페이지네이션 파라미터 검증 및 변환
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  try {
    let page = parseInt(req.query.page as string) || 1;
    let pageSize = parseInt(req.query.pageSize as string) || 20;

    // 페이지 번호는 1 이상
    if (page < 1) {
      page = 1;
    }

    // 페이지 크기는 1-100 사이
    if (pageSize < 1) {
      pageSize = 1;
    } else if (pageSize > 100) {
      pageSize = 100;
    }

    // 검증된 값을 req.query에 다시 할당
    req.query.page = page.toString();
    req.query.pageSize = pageSize.toString();

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 파일 업로드 크기 검증 (200MB 제한)
 */
export const validateFileSize = (maxSizeMB: number = 200) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentLength = req.headers['content-length'];

      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
          throw new AppError(413, `파일 크기는 최대 ${maxSizeMB}MB까지 업로드 가능합니다`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
