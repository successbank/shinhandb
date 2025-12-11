import cors from 'cors';

const allowedOrigins = [
  'http://localhost:5647',
  'http://localhost:3000',
  'http://192.168.1.45:5647',
  process.env.FRONTEND_URL || '',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // 개발 환경에서는 모든 origin 허용
    if (!origin || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
