/**
 * API 클라이언트 함수
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5648/api';

/**
 * 파일 업로드 진행률 콜백 타입
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * 파일 업로드 API (진행률 포함)
 */
export const uploadFiles = (
  files: File[],
  metadata: {
    title: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
  },
  options?: UploadOptions
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // FormData 생성
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('title', metadata.title);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }
    if (metadata.categoryId) {
      formData.append('categoryId', metadata.categoryId);
    }
    if (metadata.tags && metadata.tags.length > 0) {
      formData.append('tags', JSON.stringify(metadata.tags));
    }

    // 진행률 이벤트
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        options?.onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percentage,
        });
      }
    });

    // 완료 이벤트
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          options?.onSuccess?.(response);
          resolve(response);
        } catch (error) {
          const parseError = new Error('응답 파싱 실패');
          options?.onError?.(parseError);
          reject(parseError);
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          const error = new Error(errorResponse.message || '업로드 실패');
          options?.onError?.(error);
          reject(error);
        } catch {
          const error = new Error(`업로드 실패 (${xhr.status})`);
          options?.onError?.(error);
          reject(error);
        }
      }
    });

    // 에러 이벤트
    xhr.addEventListener('error', () => {
      const error = new Error('네트워크 오류가 발생했습니다');
      options?.onError?.(error);
      reject(error);
    });

    // 취소 이벤트
    xhr.addEventListener('abort', () => {
      const error = new Error('업로드가 취소되었습니다');
      options?.onError?.(error);
      reject(error);
    });

    // 요청 시작
    xhr.open('POST', `${API_BASE_URL}/contents`);

    // 인증 토큰 추가 (localStorage에서 가져오기)
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.send(formData);
  });
};

/**
 * 콘텐츠 목록 조회 API
 */
export const getContents = async (params?: {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  search?: string;
}): Promise<any> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params?.search) queryParams.append('search', params.search);

  const url = `${API_BASE_URL}/contents?${queryParams.toString()}`;

  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '콘텐츠 목록 조회 실패');
  }

  return response.json();
};

/**
 * 콘텐츠 상세 조회 API
 */
export const getContentById = async (id: string): Promise<any> => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/contents/${id}`, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '콘텐츠 조회 실패');
  }

  return response.json();
};

/**
 * 로그인 API
 */
export const login = async (email: string, password: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '로그인 실패');
  }

  const data = await response.json();

  // 토큰 저장
  if (data.data?.token) {
    localStorage.setItem('token', data.data.token);
  }

  return data;
};

/**
 * 로그아웃 API
 */
export const logout = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } finally {
    localStorage.removeItem('token');
  }
};
