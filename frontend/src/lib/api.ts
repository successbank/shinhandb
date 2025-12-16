/**
 * API 클라이언트 함수
 */

const API_BASE_URL = '/api';

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
    categoryId?: string; // 하위 호환성
    categoryIds?: string[]; // 다중 카테고리
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
    if (metadata.categoryIds && metadata.categoryIds.length > 0) {
      formData.append('categoryIds', JSON.stringify(metadata.categoryIds));
    } else if (metadata.categoryId) {
      // 하위 호환성
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
 * 파일 선택 시 태그 미리보기 API (OCR + AI 태그 생성)
 * - 파일을 업로드하여 OCR + AI 태그만 생성
 * - DB에 저장하지 않음 (미리보기 전용)
 */
export const previewTags = async (
  files: File[]
): Promise<{
  success: boolean;
  data: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    thumbnailUrl: string | null;
    ocrText: string | null;
    tags: string[];
    tempFilePath: string;
  }>;
}> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/contents/preview-tags`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '태그 미리보기 생성 실패');
  }

  return response.json();
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
export const login = async (username: string, password: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
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

/**
 * 현재 사용자 정보 가져오기
 */
export const getCurrentUser = async (): Promise<any> => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('로그인이 필요합니다');

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('사용자 정보 조회 실패');
  }

  return response.json();
};

/**
 * API 요청 헬퍼 함수
 */
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'API 요청 실패');
  }

  return response.json();
};

// Categories API
export const categoriesApi = {
  getCategories: (memberType?: string) =>
    apiRequest(`/categories${memberType ? `?memberType=${memberType}` : ''}`),
  getList: (memberType?: string) =>
    apiRequest(`/categories${memberType ? `?memberType=${memberType}` : ''}`),
  createCategory: (data: any) =>
    apiRequest('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) =>
    apiRequest(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    apiRequest(`/categories/${id}`, { method: 'DELETE' }),
};

// Tags API
export const tagsApi = {
  getTags: (params?: { search?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest(`/tags${query ? `?${query}` : ''}`);
  },
  getPopularTags: (limit?: number) =>
    apiRequest(`/tags/popular${limit ? `?limit=${limit}` : ''}`),
};

// MyPage API
export const mypageApi = {
  getBookmarks: (params?: { page?: number; pageSize?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest(`/mypage/bookmarks${query ? `?${query}` : ''}`);
  },
  addBookmark: (contentId: string, memo?: string) =>
    apiRequest('/mypage/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ contentId, memo }),
    }),
  deleteBookmark: (id: string) =>
    apiRequest(`/mypage/bookmarks/${id}`, { method: 'DELETE' }),
  updateBookmarkMemo: (id: string, memo: string) =>
    apiRequest(`/mypage/bookmarks/${id}/memo`, {
      method: 'PATCH',
      body: JSON.stringify({ memo }),
    }),
  getUploads: (params?: { page?: number; pageSize?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest(`/mypage/uploads${query ? `?${query}` : ''}`);
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest('/mypage/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// Users API (Admin only)
export const usersApi = {
  getUsers: (params?: {
    page?: number;
    pageSize?: number;
    role?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest(`/users${query ? `?${query}` : ''}`);
  },
  getUser: (id: string) => apiRequest(`/users/${id}`),
  createUser: (data: any) =>
    apiRequest('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    apiRequest(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, sendEmail: boolean = true) =>
    apiRequest(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ sendEmail }),
    }),
  activateUser: (id: string) =>
    apiRequest(`/users/${id}/activate`, { method: 'POST' }),
  getUserActivities: (id: string) => apiRequest(`/users/${id}/activities`),
};

// Logs API (Admin only)
export const logsApi = {
  getLogs: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest(`/logs${query ? `?${query}` : ''}`);
  },
};

// Content management API
export const contentApi = {
  updateContent: (id: string, data: any) =>
    apiRequest(`/contents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContent: (id: string, categoryId?: string) => {
    const url = categoryId
      ? `/contents/${id}?categoryId=${encodeURIComponent(categoryId)}`
      : `/contents/${id}`;
    return apiRequest(url, { method: 'DELETE' });
  },
  shareContent: (id: string, expiresIn?: number) =>
    apiRequest(`/contents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn }),
    }),
  extendEdit: (id: string, hours: number) =>
    apiRequest(`/contents/${id}/extend-edit`, {
      method: 'POST',
      body: JSON.stringify({ hours }),
    }),
  moveCategories: (id: string, categoryIds: string[]) =>
    apiRequest(`/contents/${id}/categories`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryIds }),
    }),
};

/**
 * 프로젝트 API
 */
export const projectsApi = {
  // 프로젝트 생성
  create: (data: {
    title: string;
    description?: string;
    categoryIds: string[];
  }) =>
    apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 프로젝트 목록 조회
  getList: (params?: {
    page?: number;
    pageSize?: number;
    categoryId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const url = searchParams.toString()
      ? `/projects?${searchParams.toString()}`
      : '/projects';
    return apiRequest(url);
  },

  // 프로젝트 상세 조회
  getDetail: (id: string) => apiRequest(`/projects/${id}`),

  // 프로젝트 파일 업로드 (진행률 포함)
  uploadFiles: (
    projectId: string,
    files: File[],
    fileMeta: Array<{ fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT' }>,
    tags?: string[],
    options?: UploadOptions
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // FormData 생성
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('fileMeta', JSON.stringify(fileMeta));
      if (tags && tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
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

      // 요청 전송
      const token = localStorage.getItem('token');
      xhr.open('POST', `${API_BASE_URL}/projects/${projectId}/files`, true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },

  // 프로젝트 정보 수정
  update: (id: string, data: {
    title?: string;
    description?: string;
    categoryIds?: string[];
  }) =>
    apiRequest(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 프로젝트 삭제
  delete: (id: string) =>
    apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    }),

  // 파일 타입 변경 (제안 시안 ↔ 최종 원고)
  updateFileType: (projectId: string, fileId: string, fileTypeFlag: 'PROPOSAL_DRAFT' | 'FINAL_MANUSCRIPT') =>
    apiRequest(`/projects/${projectId}/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fileTypeFlag }),
    }),

  // 개별 파일 삭제
  deleteFile: (projectId: string, fileId: string) =>
    apiRequest(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
    }),
};
