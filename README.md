# 신한금융 광고관리 플랫폼

신한금융지주 및 신한은행의 광고 자료 통합 검색 및 관리 시스템

## 프로젝트 구조

```
shinhandb/
├── frontend/          # Next.js 14.2.5 프론트엔드
│   ├── src/
│   │   ├── app/      # App Router
│   │   ├── components/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── backend/           # Express.js 백엔드 API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── index.ts
│   └── package.json
├── docker/            # Dockerfile 모음
├── docker-compose.yml # Docker Compose 설정
└── .env.example       # 환경 변수 템플릿
```

## 기술 스택

### Frontend
- **Framework**: Next.js 14.2.5 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Linting**: ESLint

### Backend
- **Framework**: Express.js 5.2.1
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7

### DevOps
- **Containerization**: Docker & Docker Compose
- **Development**: Node.js 18 Alpine

## 시작하기

### 1. 환경 변수 설정

`.env.example` 파일을 `.env`로 복사하고 필요한 값을 설정합니다:

```bash
cp .env.example .env
```

### 2. Docker Compose로 실행

```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 3. 서비스 접속

- **Frontend**: http://localhost:5647
- **Backend API**: http://localhost:5648/api
- **PostgreSQL**: localhost:5649
- **Redis**: localhost:5650
- **Adminer (DB 관리)**: http://localhost:5651

### 4. 관리자 계정 로그인

**초기 관리자 계정:**
- **아이디**: `admin`
- **비밀번호**: `1234!@#$`
- **역할**: 최고관리자 (ADMIN)

**주의**: 프로덕션 환경에서는 반드시 비밀번호를 변경하세요.

## 개발 가이드

### Frontend 개발

```bash
cd frontend
npm install
npm run dev        # 개발 서버 실행
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 실행
```

### Backend 개발

```bash
cd backend
npm install
npm run dev        # 개발 서버 실행 (nodemon)
npm run build      # TypeScript 빌드
npm run start      # 프로덕션 실행
npm run lint       # ESLint 실행
npm run lint:fix   # ESLint 자동 수정
```

## 코드 스타일

- **ESLint**: 코드 품질 검사
- **Prettier**: 코드 포맷팅 (.prettierrc 참조)
- **TypeScript**: 타입 안전성

## 주요 기능

1. **사용자 역할 관리**
   - 최고관리자, 신한금융지주 회원, 신한은행 회원, 클라이언트

2. **콘텐츠 관리**
   - 파일 업로드 (최대 200MB)
   - OCR 기반 자동 태그 생성
   - 카테고리 분류

3. **검색 시스템**
   - Elasticsearch 기반 통합 검색
   - 2초 이내 응답

4. **보안**
   - JWT 인증
   - bcrypt 비밀번호 암호화
   - 활동 로그 기록

## 문서

- **PRD**: `.taskmaster/docs/prd.md`
- **Task Master 가이드**: `.taskmaster/CLAUDE.md`
- **CLAUDE.md**: 프로젝트 가이드

## 라이선스

ISC
