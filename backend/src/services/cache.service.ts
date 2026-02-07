/**
 * Redis 캐싱 서비스
 * - 자주 조회되는 데이터 캐싱
 * - 검색 결과 캐싱
 * - TTL 기반 자동 만료
 */

import { Redis } from 'ioredis';

// Redis 클라이언트 초기화
// REDIS_URL 파싱 또는 개별 환경 변수 사용
let redisConfig: any = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: 0,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: false,
};

// 개별 환경변수 우선 사용 (db/index.ts 패턴과 동일)
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
  console.log('[Redis] Using individual env vars for connection');
} else if (process.env.REDIS_URL) {
  // REDIS_URL은 폴백으로만 사용
  const redisUrl = process.env.REDIS_URL;
  console.log('[Redis] Using REDIS_URL for connection');

  const match = redisUrl.match(/redis:\/\/:([^@]+)@([^:]+):(\d+)/);
  if (match) {
    redisConfig.password = match[1];
    redisConfig.host = match[2];
    redisConfig.port = parseInt(match[3]);
  } else {
    console.warn('[Redis] Failed to parse REDIS_URL, using defaults:', redisUrl);
  }
}

console.log(`[Redis] Connecting to ${redisConfig.host}:${redisConfig.port} (auth: ${redisConfig.password ? 'yes' : 'no'})`);

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

/**
 * 캐시 키 네임스페이스
 */
export const CacheKeys = {
  // 카테고리 목록 (역할별)
  categories: (userRole: string) => `categories:${userRole}`,

  // 카테고리별 콘텐츠 수
  categoryCounts: () => `category_counts`,

  // 인기 태그 (상위 N개)
  popularTags: (limit: number) => `popular_tags:${limit}`,

  // 검색 결과 (쿼리 해시 기반)
  searchResults: (queryHash: string) => `search:${queryHash}`,

  // 콘텐츠 상세
  contentDetail: (id: string) => `content:${id}`,

  // 사용자 북마크 목록
  userBookmarks: (userId: string) => `bookmarks:${userId}`,

  // 통계 데이터
  stats: (type: string) => `stats:${type}`,
};

/**
 * TTL (Time To Live) 설정 (초 단위)
 */
export const CacheTTL = {
  categories: 3600, // 1시간 (카테고리는 자주 변경되지 않음)
  categoryCounts: 300, // 5분
  popularTags: 600, // 10분
  searchResults: 180, // 3분 (검색 결과는 빠르게 변경될 수 있음)
  contentDetail: 600, // 10분
  userBookmarks: 300, // 5분
  stats: 1800, // 30분
};

/**
 * 데이터 캐싱
 */
export const setCache = async (
  key: string,
  value: any,
  ttl: number = 300
): Promise<boolean> => {
  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
    return true;
  } catch (error: any) {
    console.error('[Cache] Set error:', error.message);
    return false;
  }
};

/**
 * 캐시 조회
 */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached) as T;
  } catch (error: any) {
    console.error('[Cache] Get error:', error.message);
    return null;
  }
};

/**
 * 캐시 삭제
 */
export const deleteCache = async (key: string): Promise<boolean> => {
  try {
    await redis.del(key);
    return true;
  } catch (error: any) {
    console.error('[Cache] Delete error:', error.message);
    return false;
  }
};

/**
 * 패턴 기반 캐시 일괄 삭제
 * 예: 'search:*' - 모든 검색 결과 캐시 삭제
 */
export const deleteCachePattern = async (pattern: string): Promise<number> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    await redis.del(...keys);
    return keys.length;
  } catch (error: any) {
    console.error('[Cache] Delete pattern error:', error.message);
    return 0;
  }
};

/**
 * 캐시 존재 여부 확인
 */
export const existsCache = async (key: string): Promise<boolean> => {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error: any) {
    console.error('[Cache] Exists error:', error.message);
    return false;
  }
};

/**
 * 여러 키 한번에 조회 (MGET)
 */
export const getCacheMultiple = async <T = any>(
  keys: string[]
): Promise<(T | null)[]> => {
  try {
    if (keys.length === 0) return [];

    const values = await redis.mget(...keys);
    return values.map((v) => (v ? JSON.parse(v) : null));
  } catch (error: any) {
    console.error('[Cache] MGET error:', error.message);
    return keys.map(() => null);
  }
};

/**
 * 여러 키 한번에 저장 (MSET)
 */
export const setCacheMultiple = async (
  items: Array<{ key: string; value: any; ttl?: number }>
): Promise<boolean> => {
  try {
    const pipeline = redis.pipeline();

    items.forEach(({ key, value, ttl = 300 }) => {
      const serialized = JSON.stringify(value);
      pipeline.setex(key, ttl, serialized);
    });

    await pipeline.exec();
    return true;
  } catch (error: any) {
    console.error('[Cache] MSET error:', error.message);
    return false;
  }
};

/**
 * 카운터 증가 (조회수, 다운로드 수 등)
 */
export const incrementCounter = async (
  key: string,
  amount: number = 1
): Promise<number> => {
  try {
    return await redis.incrby(key, amount);
  } catch (error: any) {
    console.error('[Cache] Increment error:', error.message);
    return 0;
  }
};

/**
 * Sorted Set에 아이템 추가 (랭킹, 인기도 등)
 */
export const addToSortedSet = async (
  key: string,
  score: number,
  member: string
): Promise<boolean> => {
  try {
    await redis.zadd(key, score, member);
    return true;
  } catch (error: any) {
    console.error('[Cache] ZADD error:', error.message);
    return false;
  }
};

/**
 * Sorted Set에서 상위 N개 조회
 */
export const getTopFromSortedSet = async (
  key: string,
  count: number
): Promise<Array<{ member: string; score: number }>> => {
  try {
    // ZREVRANGE로 점수 높은 순으로 조회
    const results = await redis.zrevrange(key, 0, count - 1, 'WITHSCORES');

    const items: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      items.push({
        member: results[i],
        score: parseFloat(results[i + 1]),
      });
    }

    return items;
  } catch (error: any) {
    console.error('[Cache] ZREVRANGE error:', error.message);
    return [];
  }
};

/**
 * 캐시 통계 조회
 */
export const getCacheStats = async (): Promise<{
  keys: number;
  memory: string;
  hits: number;
  misses: number;
  hitRate: string;
}> => {
  try {
    const info = await redis.info('stats');
    const dbSize = await redis.dbsize();
    const memoryInfo = await redis.info('memory');

    // 파싱
    const statsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);
    const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);

    const hits = statsMatch ? parseInt(statsMatch[1]) : 0;
    const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';

    return {
      keys: dbSize,
      memory: memoryMatch ? memoryMatch[1].trim() : 'N/A',
      hits,
      misses,
      hitRate: `${hitRate}%`,
    };
  } catch (error: any) {
    console.error('[Cache] Stats error:', error.message);
    return {
      keys: 0,
      memory: 'N/A',
      hits: 0,
      misses: 0,
      hitRate: '0.00%',
    };
  }
};

/**
 * 모든 캐시 삭제 (주의: 개발 환경에서만 사용)
 */
export const flushAllCache = async (): Promise<boolean> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Cache] FLUSHALL is disabled in production');
      return false;
    }

    await redis.flushdb();
    console.log('[Cache] All cache cleared');
    return true;
  } catch (error: any) {
    console.error('[Cache] FLUSHALL error:', error.message);
    return false;
  }
};

// Redis 클라이언트 export (필요시 직접 사용)
export { redis };

export default {
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  existsCache,
  getCacheMultiple,
  setCacheMultiple,
  incrementCounter,
  addToSortedSet,
  getTopFromSortedSet,
  getCacheStats,
  flushAllCache,
  CacheKeys,
  CacheTTL,
};
