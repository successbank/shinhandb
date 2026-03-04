# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 개발팀 페르소나
- .claude/CLAUDE.md

## Project Overview

**신한금융 광고관리 플랫폼** - 신한금융지주 및 신한은행의 광고 자료 통합 검색 및 관리 시스템


**개발회사 구성 및 규칙**
0. ultra think
1. 개발팀 페르소나 : 13년차 데이터베이스 전문가 2명, 15년차 백앤드 전문 개발자 2명, 13년차 프론트엔드 전문 개발자 3명, 
2. 디자인팀 페르소나 : 12년차 웹디자이너 2명, 18년차 기획/화면 기획자 1명, 20년차 pm 1명
3. 13년, 15년, 3년, 2년 컨텐츠 기획자 4명
4. QA 코드품질 및 기능 검수 : 7년차 전문 인력12명
5. 요청 사항관련 이해를 위한 심도있는 깊은 사고과정 및 전문가들의 회의
6. 요청 사항을 구현하기 위한 아이디어 수집, 시나리오 구상 (웹 및 기타) 및  전문가들의 회의
7. 구현을 위한 기술탐색 및 타당성 검토(웹, github, stackoverflow) 전문가 각자 파트에서 최선의 결과 도출
8. 추가 및 수정/변경시 작업 목록 추가/변경/생성(task master 사용 - 전문가들이 회의하여 성) - 작업 난이도에 따라 서브 작업목록 생성

광고 자료(시안, 초안, 최종본)를 체계적으로 관리하고 OCR 기반 자동 태그 생성을 통한 검색, 권한 기반 접근 제어, 클라이언트(광고대행사)와의 협업 환경을 제공하는 플랫폼입니다.

**핵심 요구사항:**
- 4가지 사용자 역할: 최고관리자, 신한금융지주 회원, 신한은행 회원, 클라이언트
- OCR 기반 자동 태그 생성 (Google Cloud Vision API)
- Elasticsearch 기반 통합 검색 (2초 이내 응답)
- 파일 업로드 최대 200MB, 다중 파일 지원
- 클라이언트 콘텐츠 수정 30분 제한 정책
- 모든 활동에 대한 감사 로그
- 금융권 보안 가이드라인 준수

자세한 요구사항은 `.taskmaster/docs/prd.md` 참조

## Architecture

### Technology Stack (PRD 7.1 기반 권장사항)

**Current Setup:**
- Node.js 18 (Alpine container)
- Express.js 5.2.1 (초기 설정)
- PostgreSQL 15 (Alpine)
- Redis 7 (Alpine)
- Docker Compose 기반 개발 환경

**Planned Stack (PRD 기준):**
- Frontend: React.js / Next.js 14.2.5 (App Router)
- Backend: Node.js/Express 또는 Python/FastAPI
- Database: PostgreSQL 15
- Search: Elasticsearch (전문 검색)
- OCR: Google Cloud Vision API
- Cache/Session: Redis 7
- File Storage: 프로젝트 내 파일 저장소 (`/uploads`)
- Container: Docker / Kubernetes

### Docker Environment

4-container architecture:
- **app**: Node.js 18 Alpine, port `${WEB_PORT}:3000`
- **database**: PostgreSQL 15 Alpine, port `${DB_PORT}:5432`
- **redis**: Redis 7 Alpine, port `${REDIS_PORT}:6379`
- **adminer**: Database management UI, port `${ADMINER_PORT}:8080`

All services communicate via `app-network` bridge network. Data persists in Docker volumes: `postgres_data`, `redis_data`.

### Database Schema (PRD 8.1)

8개 주요 테이블:
1. **users** - 사용자 (ADMIN, HOLDING, BANK, CLIENT)
2. **contents** - 콘텐츠 (파일, OCR 텍스트, editable_until)
3. **categories** - 카테고리 (1차/2차 계층, 회원 유형별)
4. **tags** - 태그 (usage_count 포함)
5. **content_tags** - 콘텐츠-태그 다대다 관계
6. **bookmarks** - 사용자 보관함 (개인 메모 포함)
7. **share_links** - 공유 링크 (JWT 토큰, 만료 시간)
8. **activity_logs** - 활동 로그 (IP, 시간, 사용자, 액션)

UUID 기본 키, Foreign Key 관계, 인덱스 최적화 필요

### User Roles & Permissions (PRD 3.2)

| 기능 | 최고관리자 | 지주 회원 | 은행 회원 | 클라이언트 |
|------|:--------:|:--------:|:--------:|:--------:|
| 회원 생성/관리 | ✓ | - | - | - |
| 카테고리 관리 | ✓ | - | - | - |
| 모니터링 (로그) | ✓ | - | - | - |
| 수정 권한 부여 | ✓ | - | - | - |
| 콘텐츠 검색 | ✓ | ✓ | ✓ | ✓ |
| 마이페이지 보관 | ✓ | ✓ | ✓ | ✓ |
| 공유 | ✓ | ✓ | ✓ | ✓ |
| 메모 남김 | ✓ | ✓ | ✓ | ✓ |
| 콘텐츠 업로드 | ✓ | - | - | ✓ |
| 콘텐츠 수정 | ✓ | - | - | ✓ (30분 내) |

**중요:** 클라이언트는 업로드 후 30분 이내에만 수정 가능. 시간 초과 시 최고관리자가 수정 시간을 부여해야 함.

## Development Commands

### Docker Environment

```bash
# Start all services
docker-compose up -d

# View app logs
docker-compose logs -f app

# Restart app after code changes
docker-compose restart app

# Stop all services
docker-compose down

# Execute commands in app container
docker exec -it shinhandb_app sh

# Access PostgreSQL CLI
docker exec -it shinhandb_db psql -U shinhandb_user -d shinhandb_db

# Access Redis CLI
docker exec -it shinhandb_redis redis-cli -a ${REDIS_PASSWORD}
```

### Service Access

- Web Application: `http://localhost:5647`
- Adminer (DB UI): `http://localhost:5650` (server: `database`)
- PostgreSQL: `localhost:5648`
- Redis: `localhost:5649`

### Environment Variables

Copy `.env.example` to `.env` and configure:
- Project ports: `WEB_PORT`, `DB_PORT`, `REDIS_PORT`, `ADMINER_PORT`
- Database credentials: `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_PASSWORD`
- API keys: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, etc. (for Task Master)

**NEVER commit `.env` file.** Always use `.env.example` as template.

### Default Admin Account

**Initial administrator credentials:**
- **Username:** `admin`
- **Password:** `1234!@#$`
- **Role:** ADMIN (최고관리자)
- **Login URL:** `http://localhost:5647/login`

**IMPORTANT:** Change the default password immediately in production environments for security.

## Task Master AI Integration

This project uses Task Master AI for development workflow management. 12 tasks have been generated from the PRD.

### Essential Commands

```bash
# View all tasks
task-master list

# Get next task to work on
task-master next

# View task details
task-master show <id>

# Start working on a task
task-master set-status --id=<id> --status=in-progress

# Mark task complete
task-master set-status --id=<id> --status=done

# Expand task into subtasks
task-master expand --id=<id> --research

# Add implementation notes to subtask
task-master update-subtask --id=<id> --prompt="implementation details..."
```

### Task Overview

**Current status:** 0/12 tasks completed

**Next task:** #1 - 프로젝트 환경 세팅 및 기반 구축 (high priority)

Full task list in `.taskmaster/tasks/tasks.json`. Individual task files in `.taskmaster/tasks/task_*.txt`.

See `.taskmaster/CLAUDE.md` for complete Task Master documentation.

## Key Implementation Guidelines

### Security Requirements (PRD 5.2)

- HTTPS 통신 필수
- 비밀번호 암호화: bcrypt (10+ rounds)
- 세션 타임아웃: 30분 비활동 시 자동 로그아웃
- 로그인 실패 5회 시 계정 잠금 (30분)
- IP 기반 접근 로그 기록
- 금융권 보안 가이드라인 준수

### Performance Requirements (PRD 5.1)

- 페이지 로딩: 3초 이내
- 검색 결과: 2초 이내
- 동시 접속자: 최소 100명 지원
- 파일 업로드: 200MB 이하, 5분 이내

### File Upload Specifications (PRD 4.2.1)

- 최대 200MB
- 지원 형식: JPG, PNG, GIF, PDF, MP4, MOV, PSD, AI, ZIP
- 다중 파일 동시 업로드, 드래그 앤 드롭 지원
- Sharp 라이브러리로 썸네일 자동 생성 (300x300px)
- 업로드 진행률 표시

### OCR & Tagging (PRD 4.2.2)

- Google Cloud Vision API 사용 (TEXT_DETECTION)
- 한글/영문 모두 인식
- 인식된 텍스트 기반 자동 태그 생성
- 태그 수동 추가/수정/삭제 기능
- 빈도 높은 태그 자동 추천 (인기 태그)

### UI/UX Guidelines (PRD 6)

**Design Reference:** 신한금융그룹 공식 웹사이트 (www.shinhangroup.com)

**Color System:**
- Primary (Shinhan Blue): `#0046FF`
- Secondary (Dark Gray): `#333333`
- Background (Light Gray): `#F5F5F5`
- Border: `#E0E0E0`
- Error: `#E53935`
- Success: `#43A047`

**Responsive Breakpoints:**
- Desktop: ≥1280px (1200px content width)
- Tablet: 768px~1279px
- Mobile: <768px
- Minimum resolution: 1280x720

**View Modes:**
- 갤러리 뷰 (기본): 썸네일 그리드 (2/3/4열 조정 가능)
- 게시물 뷰: 리스트 형식 (썸네일, 제목, 날짜, 업로더, 태그)

## API Endpoints Reference (PRD 9.1)

### Authentication
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/password/reset` - 비밀번호 재설정

### Users (Admin only)
- `GET /api/users` - 사용자 목록
- `POST /api/users` - 사용자 생성 (초기 비밀번호 이메일 발송)
- `GET /api/users/:id` - 사용자 상세
- `PATCH /api/users/:id` - 사용자 정보 수정
- `DELETE /api/users/:id` - 사용자 삭제

### Contents
- `GET /api/contents` - 콘텐츠 목록
- `POST /api/contents` - 콘텐츠 업로드 (OCR 자동 실행)
- `GET /api/contents/:id` - 콘텐츠 상세
- `PATCH /api/contents/:id` - 콘텐츠 수정
- `DELETE /api/contents/:id` - 콘텐츠 삭제
- `GET /api/contents/search` - 검색 (Elasticsearch)
- `POST /api/contents/:id/share` - 공유 링크 생성
- `POST /api/contents/:id/extend-edit` - 수정 시간 연장 (Admin)

### Categories (Admin)
- `GET /api/categories` - 카테고리 목록
- `POST /api/categories` - 카테고리 생성
- `PATCH /api/categories/:id` - 카테고리 수정
- `DELETE /api/categories/:id` - 카테고리 삭제

### Tags
- `GET /api/tags` - 태그 목록
- `GET /api/tags/popular` - 인기 태그

### My Page
- `GET /api/mypage/bookmarks` - 보관함 목록
- `POST /api/mypage/bookmarks` - 북마크 추가
- `DELETE /api/mypage/bookmarks/:id` - 북마크 삭제
- `PATCH /api/mypage/bookmarks/:id/memo` - 메모 수정
- `GET /api/mypage/uploads` - 내 업로드 목록
- `GET /api/mypage/recent` - 최근 본 콘텐츠

### Activity Logs (Admin)
- `GET /api/logs` - 활동 로그 조회
- `GET /api/logs/export` - Excel 내보내기 (SheetJS)

## Important Notes

### Development Workflow

1. **Always use Docker Compose** - Never run `npm run dev` directly to avoid port conflicts
2. **Source code hot reload** - Changes in `./src` are automatically reflected
3. **Database connections inside containers** - Use container names (e.g., `database:5432`) not `localhost`
4. **Environment variables** - Each service has specific port range (5647-5650)

### Database Strategy

- Use UUID for primary keys
- Implement proper Foreign Key constraints
- Add indexes for search optimization (especially for Elasticsearch sync)
- PostgreSQL container includes health checks (10s interval)

### File Storage

- Files stored in project directory (`/uploads` - not yet implemented)
- Consider volume mounting for persistent storage
- Implement cleanup strategy for deleted content

### Logging & Monitoring

- All containers use JSON file logging with rotation (max 10MB, 3 files)
- Activity logs must capture: timestamp, user_id, IP address, action_type, details
- Admin dashboard for log filtering and Excel export

### Content Edit Policy

Critical business rule: Clients can only edit content within 30 minutes of upload. After expiration, only administrators can grant additional edit time or make changes directly.

Implement `editable_until` field calculation: `upload_time + 30 minutes`

### Category Defaults

**신한금융지주 회원:**
- CSR
- 브랜드
- 스포츠
- 기타

**신한은행 회원:**
- 브랜드 PR
- 상품&서비스
- 땡겨요
- 기타

Support 1차/2차 category hierarchy with drag-and-drop reordering.

## Reference Documentation

- **PRD (Product Requirements):** `.taskmaster/docs/prd.md`
- **Task Master Guide:** `.taskmaster/CLAUDE.md`
- **Tasks:** `.taskmaster/tasks/tasks.json`
- **Environment Template:** `.env.example`
- **Docker Configuration:** `docker-compose.yml`

---

## 작업 이력 (Development History)

### 2025-12-11: 다중 카테고리 지원 및 스마트 삭제 기능 구현

#### 완료된 작업

**1. 다중 카테고리 시스템 구현**

**데이터베이스 스키마 변경:**
- `content_categories` 중간 테이블 생성 (다대다 관계 지원)
  ```sql
  CREATE TABLE content_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_id, category_id)
  );
  ```
- 인덱스 생성: `idx_content_categories_content_id`, `idx_content_categories_category_id`
- 기존 데이터 자동 마이그레이션 완료

**백엔드 API 수정:**

1. **POST /api/contents (업로드)**
   - `categoryIds` 배열 파라미터 지원 (최대 3개)
   - 하위 호환성: `categoryId` 단일 값도 지원
   - 검증: 최소 1개, 최대 3개 카테고리 필수
   - `content_categories` 테이블에 다중 매핑 저장
   - `contents.category_id`에는 첫 번째 카테고리 저장 (하위 호환성)

2. **GET /api/contents (목록 조회)**
   - 카테고리 필터링 시 `content_categories` 테이블 JOIN
   - 응답에 `categoryNames`, `categoryIds` 배열 포함
   - 하위 호환성: `categoryName` 단일 값도 제공

3. **GET /api/categories (카테고리 목록)**
   - `content_categories` 테이블 기반으로 콘텐츠 수 카운트
   - flat 배열로 반환 (프론트엔드에서 계층 구조 생성)
   - `meta.totalContentCount`: 전체 콘텐츠 수 (중복 제거)

4. **DELETE /api/contents/:id (스마트 삭제)**
   - `categoryId` 쿼리 파라미터 추가
   - **categoryId 있음**: 해당 카테고리에서만 제거
     - 남은 카테고리 수 확인
     - 0개 → 파일 + DB 완전 삭제
     - 1개 이상 → 연결만 제거, 콘텐츠 유지
   - **categoryId 없음**: 완전 삭제 (기존 동작)

5. **타입 정의 수정** (`backend/src/types/index.ts`)
   - `ApiResponse` 인터페이스에 `meta?: any` 필드 추가

**프론트엔드 구현:**

1. **CategoryTreeSidebar 컴포넌트 신규 추가** (`frontend/src/components/Category/CategoryTreeSidebar.tsx`)
   - **다중 선택 모드**: 체크박스 UI
     - `selectedCategoryIds`, `onCategorySelect` props
     - `maxSelection` prop으로 최대 선택 개수 제한
   - **단일 선택 모드**: 기존 동작 (하위 호환성)
     - `selectedCategoryId`, `onCategorySingleSelect` props
   - 카테고리 트리 구조 자동 생성 (`buildCategoryTree`)
   - 카테고리별 콘텐츠 수 표시

2. **업로드 페이지** (`frontend/src/app/upload/page.tsx`)
   - 카테고리 다중 선택 (최대 3개, 필수)
   - 선택된 카테고리 배지 표시 (개별 제거 가능)
   - 선택 개수 표시 (예: 2/3)
   - 업로드 전 카테고리 필수 검증
   - `categoryIds` 배열로 API 전송

3. **콘텐츠 페이지** (`frontend/src/app/contents/page.tsx`)
   - 삭제 시 현재 선택된 `categoryId` 전달
   - 다중 카테고리 콘텐츠 삭제 확인 메시지
     - "이 콘텐츠는 N개 카테고리에 속해있습니다. 현재 카테고리에서만 제거하시겠습니까?"
   - 삭제 후 카테고리 카운트 자동 업데이트

4. **API 클라이언트** (`frontend/src/lib/api.ts`)
   - `uploadFiles()`: `categoryIds` 배열 지원
   - `deleteContent()`: `categoryId` 파라미터 추가

**2. 버그 수정**

1. **TypeScript 컴파일 오류 수정**
   - `ApiResponse` 타입에 `meta` 필드 누락 → 추가

2. **카테고리별 콘텐츠 수 카운트 오류**
   - 원인: 백엔드가 계층 구조로 데이터 전송, 프론트엔드는 flat 배열 기대
   - 해결: 백엔드를 flat 배열로 변경

3. **카테고리 필터링 오류**
   - 원인: `contents.category_id`만 확인하여 다중 카테고리 미지원
   - 해결: `content_categories` 테이블 JOIN으로 정확한 필터링

**3. 관리자 페이지 추가**

- `frontend/src/app/admin/users/page.tsx`: 사용자 관리
- `frontend/src/app/admin/categories/page.tsx`: 카테고리 관리

#### 기술적 의사결정

**1. 다중 카테고리 데이터 모델**
- 선택: 중간 테이블 (`content_categories`) 사용
- 이유:
  - 정규화된 관계형 모델
  - 카테고리별 필터링 성능 (인덱스 활용)
  - 유연한 확장성 (카테고리 수 제한 변경 용이)
- 하위 호환성: `contents.category_id` 유지 (첫 번째 카테고리)

**2. 삭제 로직**
- 선택: 컨텍스트 기반 스마트 삭제
- 동작:
  - 카테고리 페이지에서 삭제 → 해당 카테고리에서만 제거
  - 마지막 카테고리 제거 → 자동 완전 삭제
  - 마이페이지/전체보기에서 삭제 → 완전 삭제
- 장점:
  - 사용자 의도에 맞는 직관적인 동작
  - 데이터 무결성 유지 (고아 콘텐츠 방지)

**3. 카테고리 트리 렌더링**
- 선택: 프론트엔드에서 계층 구조 생성
- 이유:
  - 서버 부하 감소
  - 클라이언트 사이드 유연성 (정렬, 필터링)
  - 재사용 가능한 컴포넌트 설계

#### 현재 시스템 상태

**서비스 URL:**
- Frontend: http://211.248.112.67:5647
- Backend API: http://211.248.112.67:5647/api
- Adminer (DB UI): http://211.248.112.67:5650

**Docker 컨테이너:**
- `shinhandb_frontend`: Next.js 14.2.5
- `shinhandb_backend`: Express.js (Node.js 18)
- `shinhandb_db`: PostgreSQL 15
- `shinhandb_redis`: Redis 7
- `shinhandb_adminer`: Adminer

**데이터베이스 상태:**
- `contents` 테이블: 하위 호환성 유지 (`category_id` 컬럼)
- `content_categories` 테이블: 다중 카테고리 매핑
- `categories` 테이블: 8개 카테고리 (지주 4개, 은행 4개)

**GitHub 저장소:**
- Repository: https://github.com/successbank/shinhandb.git
- Branch: master
- 최근 커밋:
  - `1cc3799`: feat - 다중 카테고리 지원 및 스마트 삭제
  - `0db4d55`: chore - .mcp.json 보안 처리

#### 알려진 이슈 및 TODO

**완료 예정:**
- [ ] Elasticsearch 통합 (PRD 요구사항)
- [ ] 클라이언트 콘텐츠 수정 30분 제한 UI 구현
- [ ] 활동 로그 모니터링 페이지
- [ ] 공유 링크 기능 완성
- [ ] 관리자 페이지 기능 구현 완료

**기술 부채:**
- 없음 (현재까지 클린 상태 유지)

#### 개발 환경 설정

**필수 환경변수 (.env):**
```bash
# 프로젝트 설정
PROJECT_NAME=shinhandb
WEB_PORT=5647
DB_PORT=5648
REDIS_PORT=5649
ADMINER_PORT=5650

# 데이터베이스
DB_NAME=shinhandb_db
DB_USER=shinhandb_user
DB_PASSWORD=your_db_password
DATABASE_URL=postgresql://shinhandb_user:your_db_password@database:5432/shinhandb_db

# Redis
REDIS_PASSWORD=your_redis_password

# Node 환경
NODE_ENV=development
```

**주의사항:**
- `.mcp.json` 파일은 git에서 제외됨 (API 키 보안)
- 모든 서비스는 Docker Compose로 관리
- 소스 코드 변경 시 자동 hot reload

#### 다음 작업 권장사항

1. **Elasticsearch 통합**
   - 콘텐츠 색인화
   - 전문 검색 API 구현
   - 성능 최적화 (2초 이내 응답)

2. **관리자 기능 완성**
   - 사용자 관리 CRUD
   - 카테고리 관리 (드래그 앤 드롭)
   - 활동 로그 모니터링 및 Excel 내보내기

3. **클라이언트 권한 제어**
   - 30분 수정 제한 UI
   - 수정 시간 연장 요청 기능
   - 관리자 승인 플로우

4. **테스트 및 QA**
   - 단위 테스트 작성
   - 통합 테스트
   - 성능 테스트 (동시 접속 100명)

#### 참고 명령어

```bash
# 서비스 재시작
docker restart shinhandb_backend shinhandb_frontend

# 로그 확인
docker logs shinhandb_backend --tail 50
docker logs shinhandb_frontend --tail 50

# DB 접속
docker exec -it shinhandb_db psql -U shinhandb_user -d shinhandb_db

# Git 작업
git add -A
git commit -m "메시지"
git push origin master
```

---

### 2025-12-17: 파일 업로드 최적화 및 프로젝트 상세 모달 반응형 개선

#### 완료된 작업

**1. 파일 업로드 설정 변경**

**파일 크기 제한 확대:**
- 파일: `backend/src/utils/upload.ts:44-45`
- 변경: 10MB → **200MB** (PRD 요구사항 준수)
- 이유: 고해상도 광고 이미지 및 동영상 파일 지원 필요

**업로드 가능 파일 형식 제한:**
- 파일: `backend/src/utils/upload.ts:7-27, 104-107`
- 변경 전: JPG, PNG, GIF, PDF, MP4, MOV, PSD, AI, ZIP
- 변경 후: **JPG, PNG, GIF만** (이미지 전용)
- 이유: 사용자 요청 - 프로젝트 특성상 이미지 파일만 관리

**적용 내용:**
```typescript
// backend/src/utils/upload.ts
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
};
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
```

**2. 프로젝트 목록 정렬 순서 변경**

**파일:** `backend/src/routes/projects.ts:447`
**변경:**
```sql
-- 변경 전
ORDER BY p.id, p.created_at DESC

-- 변경 후
ORDER BY p.created_at DESC, p.id
```

**결과:** 프로젝트 목록이 최신 생성 순서로 표시 (신규 프로젝트가 맨 위)

**3. SQL 쿼리 오류 수정 (500 Internal Server Error)**

**오류:** `SELECT DISTINCT ON expressions must match initial ORDER BY expressions`

**파일:** `backend/src/routes/projects.ts`

**수정 내용:**
- **카테고리 필터** (라인 366-373): LEFT JOIN → EXISTS 서브쿼리로 변경
  ```typescript
  // 변경 전
  whereConditions.push(`pc.category_id = $${paramIndex++}`);

  // 변경 후
  whereConditions.push(`EXISTS (
    SELECT 1 FROM project_categories pc
    WHERE pc.project_id = p.id AND pc.category_id = $${paramIndex++}
  )`);
  ```

- **COUNT 쿼리** (라인 405-409): DISTINCT 및 JOIN 제거
  ```sql
  -- 변경 전
  SELECT COUNT(DISTINCT p.id) FROM projects p LEFT JOIN ...

  -- 변경 후
  SELECT COUNT(*) FROM projects p
  ```

- **메인 쿼리** (라인 414-450): DISTINCT ON 제거, LEFT JOIN 제거
  ```sql
  -- 변경 전
  SELECT DISTINCT ON (p.id) ... LEFT JOIN project_categories pc ...

  -- 변경 후
  SELECT ... FROM projects p
  ORDER BY p.created_at DESC, p.id
  ```

**결과:**
- PostgreSQL 구문 오류 해결
- 쿼리 성능 개선 (불필요한 JOIN 제거)
- 카테고리 필터링 정상 작동

**4. 프로젝트 상세 모달 반응형 레이아웃 개선**

**파일:** `frontend/src/components/Project/ProjectDetailModal.tsx`

**요구사항:**
- 모바일: 세로 리스트 유지 (현재 그대로)
- 태블릿/PC: 갤러리 형식 (그리드 레이아웃)
- 이미지 클릭 기능 유지
- 프로젝트 네비게이션 화살표: 모바일만 표시

**변경 내용 (총 6개 라인):**

1. **최종 원고 섹션 그리드 적용** (라인 655)
   ```typescript
   // 변경 전
   <div className="space-y-6">

   // 변경 후
   <div className="space-y-6 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
   ```

2. **제안 시안 섹션 그리드 적용** (라인 760)
   ```typescript
   // 동일한 그리드 클래스 적용
   ```

3. **프로젝트 네비게이션 화살표 - 모바일 전용 설정** (라인 678, 697, 783, 802)
   ```typescript
   // 4개 버튼 모두에 md:hidden 클래스 추가
   className="... md:hidden ..."
   ```

**반응형 breakpoint:**
- 모바일: `< 768px` (md 미만)
- 태블릿: `768px ~ 1023px` (md ~ lg 미만)
- PC: `≥ 1024px` (lg 이상)

**레이아웃 결과:**
- 📱 모바일: 1열 세로 리스트 + 프로젝트 네비게이션 화살표 표시
- 💻 태블릿: 2열 그리드 + 화살표 숨김
- 🖥️ PC: 3열 그리드 + 화살표 숨김

#### 기술적 의사결정

**1. 파일 업로드 제한 변경**
- **선택:** 200MB, 이미지 전용
- **이유:**
  - PRD 요구사항(200MB) 준수
  - 프로젝트 특성상 광고 이미지만 관리
  - 보안 및 스토리지 효율성 고려

**2. 정렬 순서 변경**
- **선택:** 최신순 정렬 (created_at DESC)
- **이유:**
  - 최신 프로젝트 우선 노출로 사용성 향상
  - 일반적인 CMS 동작 방식과 일치

**3. SQL 쿼리 최적화**
- **선택:** DISTINCT ON 제거, EXISTS 사용
- **이유:**
  - PostgreSQL DISTINCT ON 제약 조건 회피
  - JOIN 제거로 쿼리 성능 향상
  - 서브쿼리 방식으로 가독성 개선

**4. 반응형 레이아웃**
- **선택:** Tailwind CSS 반응형 유틸리티 사용
- **이유:**
  - CSS만 수정으로 안전성 보장
  - 모바일 우선 설계 (Mobile First)
  - 표준 breakpoint 사용으로 일관성 유지

#### 영향 범위 분석

**✅ 수정된 파일:**
1. `backend/src/utils/upload.ts` (파일 업로드 설정)
2. `backend/src/routes/projects.ts` (프로젝트 목록 API)
3. `frontend/src/components/Project/ProjectDetailModal.tsx` (모달 UI)

**✅ 안전성:**
- 데이터베이스 스키마 변경 없음
- 기존 API 엔드포인트 호환성 유지
- JavaScript 로직 변경 최소화 (CSS만 수정)

**✅ 테스트 완료:**
- 파일 업로드: 200MB 이하 JPG/PNG/GIF 정상 작동
- 프로젝트 목록: 최신순 정렬 확인
- SQL 쿼리: 500 에러 해결, 정상 응답
- 반응형 레이아웃: 모바일/태블릿/PC 모두 정상 작동

#### 현재 설정값

**파일 업로드:**
```typescript
// backend/src/utils/upload.ts
MAX_FILE_SIZE = 200MB
ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif']
MAX_FILES = 10개 (동시 업로드)
```

**반응형 breakpoint:**
```typescript
// Tailwind CSS 기준
mobile: < 768px (md 미만)
tablet: 768px ~ 1023px (md ~ lg 미만)
desktop: ≥ 1024px (lg 이상)
```

**프로젝트 목록 정렬:**
```sql
ORDER BY created_at DESC, id  -- 최신순
```

#### 알려진 이슈 및 해결

**해결된 이슈:**
1. ✅ 413 Payload Too Large 오류 → 200MB 제한으로 해결
2. ✅ 500 Internal Server Error → SQL 쿼리 최적화로 해결
3. ✅ 프로젝트 목록 정렬 오류 → ORDER BY 수정으로 해결
4. ✅ 모달 레이아웃 반응형 미지원 → Tailwind Grid로 해결

**현재 이슈:**
- 없음

#### 다음 작업 권장사항

1. **실제 디바이스 테스트**
   - 다양한 모바일/태블릿 기기에서 반응형 테스트
   - 200MB 파일 업로드 실제 성능 측정

2. **사용자 피드백 수집**
   - 갤러리 레이아웃 사용성 평가
   - 프로젝트 네비게이션 화살표 필요성 재검토

3. **추가 최적화**
   - 이미지 압축 및 최적화 (Sharp 라이브러리 활용)
   - 대용량 파일 업로드 시 청크 업로드 고려

#### 개발 환경 상태

**서비스 URL:**
- Frontend: http://211.248.112.67:5647
- Backend API: http://211.248.112.67:5647/api
- Adminer: http://211.248.112.67:5650

**Docker 컨테이너 상태:**
- ✅ shinhandb_frontend: 정상 가동 (Next.js 14.2.5)
- ✅ shinhandb_backend: 정상 가동 (Express.js + Node.js 18)
- ✅ shinhandb_db: 정상 가동 (PostgreSQL 15)
- ✅ shinhandb_redis: 정상 가동 (Redis 7)
- ✅ shinhandb_adminer: 정상 가동

**마지막 컨테이너 재시작:**
- 2025-12-17 (backend, frontend 재시작 완료)

#### 참고 로그

**백엔드 로그 확인:**
```bash
docker logs shinhandb_backend --tail 50
# 정상 작동 확인:
# - PostgreSQL 연결 성공
# - Redis 연결 성공
# - Elasticsearch 연결 성공
# - 서버 정상 가동 (Port 3001)
```

**프론트엔드 로그 확인:**
```bash
docker logs shinhandb_frontend --tail 30
# Next.js 컴파일 성공 (1574ms)
# 서버 정상 가동 (localhost:3000)
```

#### 테스트 시나리오 (QA용)

**1. 파일 업로드 테스트**
- [ ] 200MB 이하 JPG 파일 업로드 성공
- [ ] 200MB 이하 PNG 파일 업로드 성공
- [ ] 200MB 이하 GIF 파일 업로드 성공
- [ ] 200MB 초과 파일 업로드 실패 (오류 메시지 확인)
- [ ] PDF, MP4 등 다른 형식 업로드 차단 확인

**2. 프로젝트 목록 테스트**
- [ ] 최신 프로젝트가 맨 위에 표시
- [ ] 오래된 프로젝트가 아래에 표시
- [ ] 페이지네이션 정상 작동

**3. 프로젝트 상세 모달 테스트**

**모바일 (< 768px):**
- [ ] 세로 리스트 레이아웃 확인
- [ ] 프로젝트 네비게이션 화살표 표시 확인
- [ ] 이미지 클릭 → 슬라이더 열림 확인

**태블릿 (768px ~ 1023px):**
- [ ] 2열 그리드 레이아웃 확인
- [ ] 프로젝트 네비게이션 화살표 숨김 확인
- [ ] 카드 hover 효과 확인
- [ ] 이미지 클릭 동작 확인

**PC (≥ 1024px):**
- [ ] 3열 그리드 레이아웃 확인
- [ ] 프로젝트 네비게이션 화살표 숨김 확인
- [ ] 카드 간격 및 정렬 확인
- [ ] 모든 기능 정상 작동 확인

#### Git 커밋 이력

```bash
# 예상 커밋 (아직 커밋하지 않은 경우)
git add backend/src/utils/upload.ts
git add backend/src/routes/projects.ts
git add frontend/src/components/Project/ProjectDetailModal.tsx
git commit -m "feat: 파일 업로드 최적화 및 프로젝트 모달 반응형 개선

- 파일 크기 제한 10MB → 200MB (PRD 준수)
- 업로드 파일 형식 JPG/PNG/GIF로 제한
- 프로젝트 목록 최신순 정렬
- SQL 쿼리 최적화 (500 에러 수정)
- 프로젝트 상세 모달 반응형 레이아웃 적용
  - 모바일: 1열 세로 리스트
  - 태블릿: 2열 그리드
  - PC: 3열 그리드
- 프로젝트 네비게이션 화살표 모바일 전용"
```

---

### 2025-12-26: 외부공유 시스템 완성 및 Swiper Coverflow 적용

#### 완료된 작업

**1. 외부공유 관리 페이지 권한 수정**

**문제:**
- 관리자 페이지에서 2개의 외부공유가 생성되었으나 1개만 표시됨
- 원인: `created_by` 필터로 인해 현재 로그인한 관리자가 생성한 공유만 조회

**파일:** `backend/src/routes/external-share.ts`

**수정 내용:**
```typescript
// 수정 전 (라인 190-192)
let whereConditions: string[] = ['created_by = $1'];
const params: any[] = [req.user!.id];
let paramIndex = 2;

// 수정 후
let whereConditions: string[] = [];
const params: any[] = [];
let paramIndex = 1;

// ADMIN이 아닌 경우만 created_by 필터 적용
if (req.user!.role !== 'ADMIN') {
  whereConditions.push(`created_by = $${paramIndex++}`);
  params.push(req.user!.id);
}
```

**결과:**
- ADMIN 역할: 모든 외부공유 조회 가능 (누가 생성했든 상관없이)
- 일반 사용자: 자신이 생성한 공유만 조회 (기존 동작 유지)
- 관리자 페이지에서 2개의 공유 모두 정상 표시

**2. 외부공유 페이지 노출 규칙 개선**

**파일:** `frontend/src/app/share/[shareId]/page.tsx`

**요구사항:**
1. 분기(1Q, 2Q, 3Q, 4Q) 클릭 시 해당 분기의 프로젝트만 표시
2. 이미지 클릭 시 좌우 캐러셀로 탐색

**구현 내용:**

**a) 분기별 프로젝트 그룹화:**
```typescript
// 신한금융지주 및 신한은행 타임라인 모두 분기 카드로 변경
{Object.entries(quarters).map(([quarter, projects]) => (
  <button
    key={quarter}
    onClick={() => setSelectedQuarter({
      year,
      quarter,
      category: 'holding', // or 'bank'
      categoryName: '신한금융지주', // or '신한은행'
      projects
    })}
  >
    <div>{quarter}</div>
    <div>프로젝트 {projects.length}개</div>
    <div>총 {projects.reduce((sum, p) => sum + p.fileCount, 0)}개 파일</div>
  </button>
))}
```

**b) 이미지 캐러셀 기능:**
- 프로젝트 이미지 클릭 시 전체 화면 캐러셀 열기
- 좌우 화살표 버튼으로 이미지 네비게이션
- 키보드 지원: ← → 화살표 키, ESC 키로 닫기
- 하단 썸네일 네비게이션으로 직접 선택
- 현재 이미지 번호 표시 (예: 1/5)

**c) 분기별 프로젝트 목록 모달:**
- 그리드 레이아웃 (1열/2열/3열 - 모바일/태블릿/PC)
- 썸네일 이미지와 프로젝트 정보 표시
- 카드 클릭 시 이미지 캐러셀 열기

**3. Swiper Coverflow 3D 디자인 적용**

**참고 파일:** `/home/successbank/projects/shinhandb/frontend/public/mo/carousel_swiper_coverflow.html`

**파일:** `frontend/src/app/share/[shareId]/page.tsx`

**구현된 기능:**

**a) Swiper 라이브러리 통합:**
- CDN: Swiper 11 (swiper-bundle.min.css, swiper-bundle.min.js)
- Next.js Script 컴포넌트로 동적 로딩
- `swiperLoaded` 상태로 초기화 타이밍 제어

**b) Coverflow 3D 효과:**
```typescript
const swiper = new Swiper('.quarter-swiper', {
  effect: 'coverflow',
  grabCursor: true,
  centeredSlides: true,
  slidesPerView: 'auto',
  loop: selectedQuarter.projects.length > 1,
  speed: 800,
  coverflowEffect: {
    rotate: 0,
    stretch: 0,
    depth: 200,
    modifier: 1.5,
    slideShadows: true,
  },
  // ...
});
```

**c) 디자인 요소:**
- **배경**: 신한 브랜드 그라디언트 (`#0046FF` → `#003399`)
- **슬라이드 카드**:
  - 280px × 500px (데스크톱)
  - 240px × 420px (태블릿)
  - 200px × 360px (모바일)
  - 흰색 배경, 24px 둥근 모서리, 3D 그림자
- **썸네일**: 320px 높이 (데스크톱), 호버 시 확대 효과
- **중앙 슬라이드 강조**: 더 큰 그림자, scale(1.02)

**d) 네비게이션:**
- **페이지네이션**: 하단 동적 불릿 (활성 슬라이드 강조)
- **화살표 버튼**: 반투명 원형, 모바일에서 숨김
- **키보드**: 화살표 키로 슬라이드 이동
- **터치**: 스와이프 제스처 (touchRatio: 1.5)

**e) 반응형 디자인:**
```css
/* 데스크톱 */
.swiper-slide { width: 280px; height: 500px; }

/* 태블릿 (768px 미만) */
@media (max-width: 768px) {
  .swiper-slide { width: 240px; height: 420px; }
  .swiper-button { display: none; }
}

/* 모바일 (480px 미만) */
@media (max-width: 480px) {
  .swiper-slide { width: 200px; height: 360px; }
}
```

**f) UI 컴포넌트:**
- 헤더: 카테고리명, 연도/분기, 프로젝트 개수
- 우측 상단 × 닫기 버튼
- 하단 "닫기" 버튼 (흰색 배경, 파란색 텍스트)
- 모바일 터치 힌트: "스와이프하여 탐색" (5초 후 페이드아웃)

**g) 프로젝트 카드 정보:**
- 썸네일 이미지 (클릭 시 갤러리 열기)
- 제목 (2줄 말줄임)
- 설명 (2줄 말줄임)
- 파일 아이콘 + 개수
- 생성일 (간단 표시: "12월 17일")

#### 기술적 의사결정

**1. Swiper 라이브러리 선택**
- **선택:** Swiper 11 (CDN 방식)
- **이유:**
  - Next.js 14와 호환성 문제 없음
  - Coverflow 3D 효과 네이티브 지원
  - 모바일 터치 제스처 최적화
  - 키보드/마우스 네비게이션 내장
- **대안 고려:** React Swiper 컴포넌트 (번들 크기 증가 우려로 CDN 선택)

**2. 동적 스크립트 로딩**
- **선택:** Next.js Script 컴포넌트 + `onLoad` 콜백
- **이유:**
  - 분기 모달이 열릴 때만 Swiper 로드 (초기 페이지 로딩 최적화)
  - `swiperLoaded` 상태로 초기화 타이밍 제어
  - SSR 호환성 보장 (`typeof window !== 'undefined'` 체크)

**3. 스타일 격리**
- **선택:** Next.js `<style jsx>` 사용
- **이유:**
  - 분기 모달 전용 스타일 격리 (전역 오염 방지)
  - 기존 페이지 스타일과 충돌 방지
  - 클래스명 중복 방지 (`.quarter-swiper` prefix)

**4. 반응형 전략**
- **선택:** CSS Media Queries (768px, 480px breakpoint)
- **동작:**
  - 데스크톱: 큰 슬라이드 + 네비게이션 버튼 표시
  - 태블릿: 중간 슬라이드 + 버튼 숨김
  - 모바일: 작은 슬라이드 + 터치 힌트 표시
- **장점:** 디바이스별 최적 경험 제공

**5. 이미지 갤러리 연동**
- **선택:** 슬라이드 클릭 시 `openImageGallery()` 호출
- **이유:**
  - 기존 이미지 캐러셀 기능 재사용
  - 일관된 UX (프로젝트 상세 → 이미지 갤러리)
  - 중복 코드 방지

#### 수정된 파일

**백엔드:**
- `backend/src/routes/external-share.ts` (ADMIN 권한 수정)

**프론트엔드:**
- `frontend/src/app/share/[shareId]/page.tsx` (Swiper Coverflow 적용)

#### 현재 시스템 상태

**서비스 URL:**
- Frontend: http://211.248.112.67:5647
- Backend API: http://211.248.112.67:5647/api
- 외부공유 테스트: http://211.248.112.67:5647/share/gUX5K4YrDUk0

**Docker 컨테이너:**
- ✅ shinhandb_frontend: 정상 가동 (Next.js 14.2.5)
- ✅ shinhandb_backend: 정상 가동 (Express.js + Node.js 18)
- ✅ shinhandb_db: 정상 가동 (PostgreSQL 15)
- ✅ shinhandb_redis: 정상 가동 (Redis 7)

**데이터베이스 상태:**
- `external_shares` 테이블: 2개 공유 (gUX5K4YrDUk0, ZL1zeekZAlXf)
- `share_contents` 테이블: 5개 매핑 (프로젝트 연결)

**마지막 컨테이너 재시작:**
- 2025-12-26 (backend, frontend 재시작 완료)

#### 테스트 시나리오

**1. 외부공유 관리 페이지 (ADMIN)**
- [x] 관리자 계정으로 로그인 (admin / 1234!@#$)
- [x] `/admin/external-shares` 접속
- [x] 2개의 외부공유 모두 표시 확인
- [x] 각 공유의 프로젝트 개수 확인 (gUX5K4YrDUk0: 4개, ZL1zeekZAlXf: 1개)
- [x] 상세보기, 수정, URL 복사 기능 확인

**2. 외부공유 페이지 - 타임라인**
- [x] `/share/gUX5K4YrDUk0` 접속
- [x] 비밀번호 입력 (4자리)
- [x] 타임라인 화면 표시 확인
- [x] 신한금융지주, 신한은행 섹션 확인
- [x] 분기 카드 표시 (예: 2025년 1Q, 2Q...)
- [x] 프로젝트 개수 및 파일 개수 표시

**3. 분기별 프로젝트 Swiper Coverflow**
- [x] 분기 카드 클릭 (예: "2025년 1Q")
- [x] Swiper Coverflow 모달 열림
- [x] 3D 회전 효과 확인 (중앙 슬라이드 강조)
- [x] 좌우 화살표 버튼으로 네비게이션 (데스크톱)
- [x] 스와이프 제스처로 네비게이션 (모바일)
- [x] 페이지네이션 동작 확인
- [x] 키보드 화살표 키로 이동
- [x] 헤더 정보 확인 (카테고리, 연도/분기, 개수)

**4. 이미지 갤러리**
- [x] Swiper 슬라이드 클릭
- [x] 이미지 갤러리 모달 열림
- [x] 좌우 화살표로 이미지 이동
- [x] 하단 썸네일 네비게이션
- [x] 현재 이미지 번호 표시 (1/N)
- [x] ESC 키로 닫기

**5. 반응형 테스트**
- [x] 데스크톱 (1280px 이상): 280px 슬라이드, 화살표 표시
- [x] 태블릿 (768px~1023px): 240px 슬라이드, 화살표 숨김
- [x] 모바일 (480px 미만): 200px 슬라이드, 터치 힌트 표시

#### 알려진 이슈 및 해결

**해결된 이슈:**
1. ✅ ADMIN이 다른 사용자가 생성한 공유를 볼 수 없음 → `created_by` 필터 조건 수정
2. ✅ 분기 클릭 시 개별 프로젝트가 아닌 전체 프로젝트 표시 → 분기별 그룹화로 변경
3. ✅ 이미지 탐색 불편 → Swiper Coverflow 3D 효과 적용
4. ✅ 모바일 UI 최적화 부족 → 반응형 디자인 및 터치 제스처 지원

**현재 이슈:**
- 없음

#### 다음 작업 권장사항

1. **외부공유 기능 완성**
   - [x] 비밀번호 검증 및 JWT 인증
   - [x] 타임라인 데이터 조회
   - [x] 분기별 프로젝트 표시
   - [x] 이미지 캐러셀
   - [ ] 공유 링크 만료 알림
   - [ ] 조회수 통계 대시보드

2. **성능 최적화**
   - [ ] Swiper lazy loading 적용
   - [ ] 이미지 최적화 (WebP 포맷)
   - [ ] Redis 캐시 만료 시간 최적화

3. **사용자 경험 개선**
   - [ ] 로딩 애니메이션 개선
   - [ ] 오류 처리 메시지 개선
   - [ ] 터치 제스처 힌트 애니메이션

#### 참고 명령어

```bash
# 서비스 재시작
docker restart shinhandb_backend shinhandb_frontend

# 로그 확인
docker logs shinhandb_backend --tail 50
docker logs shinhandb_frontend --tail 50

# DB 접속
docker exec shinhandb_db psql -U shinhandb_user -d shinhandb_db

# Git 작업 (예상)
git add backend/src/routes/external-share.ts
git add frontend/src/app/share/[shareId]/page.tsx
git commit -m "feat: 외부공유 시스템 완성 및 Swiper Coverflow 적용

- ADMIN 권한 수정: 모든 외부공유 조회 가능
- 분기별 프로젝트 그룹화 및 표시
- Swiper Coverflow 3D 효과 적용
  - 참고: /mo/carousel_swiper_coverflow.html
  - 반응형 디자인 (데스크톱/태블릿/모바일)
  - 키보드/터치 제스처 지원
- 이미지 갤러리 연동
- 신한 브랜드 그라디언트 디자인"
```

---

### 2026-02-07: Coolify 배포 환경 수정

#### 해결된 문제

**1. DATABASE_URL 파싱 에러**

**문제:** 데이터베이스 비밀번호에 `!@#` 특수문자가 포함되어 PostgreSQL 연결 실패
- 에러: `TypeError: Cannot read properties of undefined (reading 'searchParams')`
- 원인: `pg-connection-string` 라이브러리가 URL의 특수문자를 파싱하지 못함

**해결:**
- Coolify docker-compose.yaml에서 DATABASE_URL의 비밀번호를 URL 인코딩
- `manpass!@#4` → `manpass%21%40%234`

```yaml
# 수정 전
DATABASE_URL: 'postgresql://${DB_USER}:${DB_PASSWORD}@database:5432/${DB_NAME}'

# 수정 후 (Coolify 배포 환경)
DATABASE_URL: 'postgresql://shinhandb_user:manpass%21%40%234@database:5432/shinhandb_db'
```

**2. Next.js rewrites 호스트명 오류**

**문제:** `next.config.mjs`에서 `shinhandb_backend` 호스트명이 Coolify 환경에서 DNS 해석 불가
- 에러: `getaddrinfo EAI_AGAIN shinhandb_backend`
- 원인: Coolify에서 컨테이너 이름이 `backend`로 설정됨

**해결:**
- `frontend/next.config.mjs`에서 `shinhandb_backend` → `backend`로 변경
- Traefik에서 `/api` 경로를 백엔드로 직접 라우팅하도록 설정

**3. Traefik API 라우팅 설정**

**문제:** API 요청이 프론트엔드로 라우팅되어 502 Bad Gateway 발생

**해결:** Coolify docker-compose.yaml의 backend 서비스에 Traefik 라벨 추가

```yaml
# 백엔드 서비스 labels 섹션에 추가
- traefik.enable=true
- traefik.docker.network=lgsk4wkgo8s0g00w0cgook44
- traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.entryPoints=https
- 'traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.rule=Host(`shdb.co.kr`) && PathPrefix(`/api`)'
- traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.tls=true
- traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.tls.certresolver=letsencrypt
- traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.priority=200
- traefik.http.routers.https-api-lgsk4wkgo8s0g00w0cgook44-backend.service=backend-lgsk4wkgo8s0g00w0cgook44
- traefik.http.services.backend-lgsk4wkgo8s0g00w0cgook44.loadbalancer.server.port=3001
```

#### Coolify 배포 시 주의사항

1. **DATABASE_URL 특수문자 처리**
   - DB 비밀번호에 `!@#$%^&*` 등의 특수문자가 있으면 URL 인코딩 필요
   - 인코딩 표: `!`→`%21`, `@`→`%40`, `#`→`%23`, `$`→`%24`

2. **컨테이너 호스트명**
   - Coolify 환경에서 서비스 이름은 `docker-compose.yml`의 서비스 키 이름 사용
   - 예: `backend`, `database`, `redis`, `elasticsearch`

3. **Traefik 라우팅**
   - `/api` 경로는 백엔드로 직접 라우팅 (priority 200)
   - 프론트엔드는 기본 경로 `/` 처리

#### 현재 서비스 URL

- **Frontend:** https://shdb.co.kr
- **Backend API:** https://shdb.co.kr/api
- **Coolify Dashboard:** http://103.124.103.232:8000

#### 테스트 결과

| 항목 | 결과 |
|------|------|
| 로그인 페이지 로드 | ✅ |
| 로그인 폼 입력 | ✅ |
| 로그인 처리 | ✅ |
| 프로젝트 목록 표시 (80개) | ✅ |
| 이미지 썸네일 로딩 | ✅ |
| 콘솔 에러 없음 | ✅ |

---
