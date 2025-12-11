FROM node:18-alpine AS base

# 개발 단계
FROM base AS dev
WORKDIR /app

# 개발 환경 설정
ENV NODE_ENV=development

# 패키지 설치를 위한 파일만 먼저 복사 (캐시 최적화)
COPY package*.json ./

# 의존성 설치
RUN npm ci || npm install

# 소스코드는 볼륨 마운트로 처리
EXPOSE 3000

# 개발 서버 실행
CMD ["npm", "run", "dev"]

# 프로덕션 빌드 단계
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

# 비루트 사용자 생성
RUN addgroup -g 1001 nodejs && \
    adduser -S nodejs -u 1001

# 패키지 파일 복사 및 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --only=production

# 애플리케이션 코드 복사
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

CMD ["node", "index.js"]
