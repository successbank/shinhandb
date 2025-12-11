export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5647/api',
  env: process.env.NODE_ENV || 'development',
} as const;
