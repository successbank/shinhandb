import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// DATABASE_URL에 특수문자(!@#$ 등)가 포함된 경우 URL 파싱 실패 방지
// 개별 환경변수가 있으면 우선 사용, 없으면 DATABASE_URL 사용
function buildPoolConfig(): PoolConfig {
  const base: PoolConfig = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  if (process.env.DB_HOST) {
    // 개별 환경변수 사용 (특수문자 문제 없음)
    return {
      ...base,
      host: process.env.DB_HOST || 'database',
      port: parseInt(process.env.DB_PORT_INTERNAL || '5432', 10),
      database: process.env.DB_NAME || 'shinhandb_db',
      user: process.env.DB_USER || 'shinhandb_user',
      password: process.env.DB_PASSWORD || '',
    };
  }

  // DATABASE_URL 사용
  return {
    ...base,
    connectionString: process.env.DATABASE_URL,
  };
}

const poolConfig = buildPoolConfig();
console.log('[DB] Connection mode:', process.env.DB_HOST ? 'individual params' : 'DATABASE_URL');

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('✓ PostgreSQL 데이터베이스 연결 성공');
});

// 시작 시 DB 연결 테스트
pool.query('SELECT 1').then(() => {
  console.log('✓ PostgreSQL 초기 연결 테스트 성공');
}).catch((err) => {
  console.error('✗ PostgreSQL 초기 연결 테스트 실패:', err.message);
});

pool.on('error', (err) => {
  console.error('PostgreSQL 연결 에러:', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};
