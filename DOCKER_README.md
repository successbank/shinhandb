# 🐳 신한금융 광고관리 플랫폼 - Docker 배포 가이드

> **버전:** 1.0.0
> **최종 업데이트:** 2026-01-04
> **작성팀:** 13년차 DB 전문가 2명, 15년차 백엔드 개발자 2명, 13년차 프론트엔드 개발자 3명

---

## 📋 목차

1. [개요](#개요)
2. [시스템 요구사항](#시스템-요구사항)
3. [빠른 시작 (Quick Start)](#빠른-시작-quick-start)
4. [상세 배포 가이드](#상세-배포-가이드)
5. [환경 변수 설정](#환경-변수-설정)
6. [서비스 관리](#서비스-관리)
7. [데이터베이스 관리](#데이터베이스-관리)
8. [모니터링 및 로그](#모니터링-및-로그)
9. [백업 및 복원](#백업-및-복원)
10. [트러블슈팅](#트러블슈팅)
11. [보안 권장사항](#보안-권장사항)
12. [성능 최적화](#성능-최적화)

---

## 개요

### 프로젝트 소개

**신한금융 광고관리 플랫폼**은 신한금융지주 및 신한은행의 광고 자료를 통합 관리하고, OCR 기반 자동 태그 생성과 Elasticsearch 기반 전문 검색을 제공하는 엔터프라이즈급 웹 애플리케이션입니다.

### Docker 아키텍처

본 프로젝트는 **6개의 컨테이너**로 구성된 마이크로서비스 아키�ecture를 채택하고 있습니다:

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network (Bridge)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Frontend │  │ Backend  │  │ Database │  │  Redis   │   │
│  │ Next.js  │◄─┤ Express  │◄─┤PostgreSQL│  │  Cache   │   │
│  │  :3000   │  │  :3001   │  │  :5432   │  │  :6379   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ▲             │              ▲              ▲         │
│       │             │              │              │         │
│       │             └──────────────┼──────────────┘         │
│       │                            │                        │
│  ┌──────────┐              ┌──────────────┐                │
│  │ Adminer  │              │Elasticsearch │                │
│  │   UI     │              │    :9200     │                │
│  │  :8080   │              └──────────────┘                │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

### 주요 기능

- ✅ **멀티 스테이지 빌드**: 최소화된 프로덕션 이미지 (보안 강화)
- ✅ **자동 데이터베이스 초기화**: 84개 프로젝트, 4명 사용자, 8개 카테고리 포함
- ✅ **헬스체크**: 모든 서비스 자동 모니터링 및 재시작
- ✅ **퍼시스턴트 볼륨**: 데이터 영구 보존 (PostgreSQL, Redis, Elasticsearch, Uploads)
- ✅ **로그 로테이션**: 자동 로그 관리 (최대 50MB × 5파일)
- ✅ **Non-root 사용자**: 보안 강화 (UID/GID 1001)

---

## 시스템 요구사항

### 하드웨어 권장사항

| 구분 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| **CPU** | 2 Core | 4 Core |
| **RAM** | 4GB | 8GB |
| **디스크** | 20GB (SSD 권장) | 50GB (NVMe SSD) |
| **네트워크** | 100Mbps | 1Gbps |

### 소프트웨어 요구사항

- **Docker**: 20.10.0 이상
- **Docker Compose**: 2.0.0 이상
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+), macOS 11+, Windows 10+ (WSL2)

### 포트 사용

| 서비스 | 포트 | 용도 |
|--------|------|------|
| Frontend | 5647 | Next.js 웹 애플리케이션 |
| Backend | 5648 | Express.js API 서버 |
| Database | 5649 | PostgreSQL (외부 접속용) |
| Redis | 5650 | Redis (외부 접속용) |
| Adminer | 5651 | 데이터베이스 관리 UI |
| Elasticsearch | 5652 | Elasticsearch API |

⚠️ **주의**: 위 포트가 이미 사용 중이 아닌지 확인하세요.

```bash
# 포트 충돌 확인
netstat -tuln | grep -E '5647|5648|5649|5650|5651|5652'
```

---

## 빠른 시작 (Quick Start)

### 1. 프로젝트 다운로드

```bash
# Git 저장소 클론
git clone https://github.com/successbank/shinhandb.git
cd shinhandb

# 또는 Docker 이미지 아카이브 사용
# tar -xzf shinhandb_docker_image.tar.gz
# cd shinhandb
```

### 2. 환경 변수 설정

```bash
# 프로덕션 환경 변수 템플릿 복사
cp .env.production .env

# 환경 변수 편집 (비밀번호 변경 필수!)
nano .env
```

**반드시 변경해야 할 항목:**

```bash
DB_PASSWORD=CHANGE_THIS_PASSWORD_IN_PRODUCTION
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD
ELASTICSEARCH_PASSWORD=CHANGE_THIS_ES_PASSWORD
JWT_SECRET=CHANGE_THIS_TO_RANDOM_64_CHAR_STRING
```

### 3. Docker 이미지 빌드

```bash
# 프로덕션 이미지 빌드 (5~10분 소요)
docker-compose -f docker-compose.prod.yml build

# 빌드 진행 상황 확인
docker images | grep shinhandb
```

### 4. 서비스 시작

```bash
# 모든 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 서비스 상태 확인
docker-compose -f docker-compose.prod.yml ps
```

### 5. 접속 확인

- **웹 애플리케이션**: http://localhost:5647
- **API 서버**: http://localhost:5648
- **Adminer (DB UI)**: http://localhost:5651
- **Elasticsearch**: http://localhost:5652

### 6. 기본 관리자 로그인

- **URL**: http://localhost:5647/login
- **아이디**: `admin`
- **비밀번호**: `1234!@#$`

⚠️ **보안**: 첫 로그인 후 반드시 비밀번호를 변경하세요!

---

## 상세 배포 가이드

### Step 1: Docker 설치

#### Ubuntu/Debian

```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 재로그인 후 확인
docker --version
docker-compose --version
```

#### CentOS/RHEL

```bash
# Docker 설치
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: 프로젝트 구조 확인

```bash
shinhandb/
├── frontend/                 # Next.js 14 프론트엔드
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── next.config.js
├── backend/                  # Express.js 백엔드
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── docker/                   # Dockerfile 모음
│   ├── Dockerfile.frontend.dev      # 개발용 프론트엔드
│   ├── Dockerfile.frontend.prod     # 프로덕션용 프론트엔드
│   ├── Dockerfile.backend.dev       # 개발용 백엔드
│   ├── Dockerfile.backend.prod      # 프로덕션용 백엔드
│   └── init-db.sh                   # DB 초기화 스크립트
├── backups/                  # 데이터베이스 백업
│   └── shinhandb_20260104.sql       # 초기 데이터
├── docker-compose.yml        # 개발용 Compose
├── docker-compose.prod.yml   # 프로덕션용 Compose
├── .env.production           # 환경 변수 템플릿
└── DOCKER_README.md          # 이 문서
```

### Step 3: 환경 변수 상세 설정

```bash
# .env 파일 생성
cp .env.production .env
```

**환경 변수 설명:**

```bash
# ===================================
# 프로젝트 기본 설정
# ===================================
PROJECT_NAME=shinhandb              # 컨테이너 이름 prefix

# ===================================
# 서비스 포트 (충돌 방지)
# ===================================
FRONTEND_PORT=5647                  # Next.js 웹 애플리케이션
BACKEND_PORT=5648                   # Express.js API 서버
DB_PORT=5649                        # PostgreSQL 외부 접속
REDIS_PORT=5650                     # Redis 외부 접속
ADMINER_PORT=5651                   # Adminer 관리 UI
ELASTICSEARCH_PORT=5652             # Elasticsearch API

# ===================================
# 데이터베이스 (PostgreSQL 15)
# ===================================
DB_NAME=shinhandb_db
DB_USER=shinhandb_user
DB_PASSWORD=your_strong_password_here_32chars_minimum

# 내부 연결 URL (컨테이너 간 통신)
DATABASE_URL=postgresql://shinhandb_user:your_strong_password_here@database:5432/shinhandb_db

# ===================================
# 캐시 및 세션 (Redis 7)
# ===================================
REDIS_PASSWORD=your_redis_password_here_16chars_minimum

# ===================================
# 검색 엔진 (Elasticsearch 8)
# ===================================
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_PASSWORD=your_es_password_here_16chars_minimum

# ===================================
# JWT 인증 (64자 이상 권장)
# ===================================
# 생성 방법: openssl rand -hex 32
JWT_SECRET=your_random_64_character_secret_key_here

# ===================================
# 프론트엔드 URL (CORS 설정용)
# ===================================
FRONTEND_URL=http://localhost:5647

# ===================================
# OpenAI API (OCR 및 태그 자동 생성)
# ===================================
OPENAI_API_KEY=sk-your_openai_api_key_here

# ===================================
# 런타임 환경
# ===================================
NODE_ENV=production
```

**보안 강화 팁:**

```bash
# 랜덤 비밀번호 생성 (Linux/macOS)
# PostgreSQL 비밀번호 (32자)
openssl rand -base64 32

# Redis 비밀번호 (16자)
openssl rand -base64 16

# JWT Secret (64자)
openssl rand -hex 32
```

### Step 4: Docker 이미지 빌드

#### 전체 빌드 (권장)

```bash
# 캐시 없이 완전히 새로 빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 진행 상황 확인
docker-compose -f docker-compose.prod.yml build --progress=plain
```

#### 개별 서비스 빌드

```bash
# Frontend만 빌드
docker-compose -f docker-compose.prod.yml build frontend

# Backend만 빌드
docker-compose -f docker-compose.prod.yml build backend
```

#### 빌드 결과 확인

```bash
# 이미지 목록 확인
docker images | grep shinhandb

# 예상 출력:
# shinhandb-frontend    latest    abc123    2 minutes ago    200MB
# shinhandb-backend     latest    def456    3 minutes ago    150MB
```

### Step 5: 서비스 시작

```bash
# 백그라운드에서 모든 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 로그 출력하며 시작 (디버깅용)
docker-compose -f docker-compose.prod.yml up

# 특정 서비스만 시작
docker-compose -f docker-compose.prod.yml up -d database redis
```

### Step 6: 서비스 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 예상 출력:
# NAME                        STATUS              PORTS
# shinhandb_frontend_prod     Up (healthy)        0.0.0.0:5647->3000/tcp
# shinhandb_backend_prod      Up (healthy)        0.0.0.0:5648->3001/tcp
# shinhandb_db_prod           Up (healthy)        0.0.0.0:5649->5432/tcp
# shinhandb_redis_prod        Up                  0.0.0.0:5650->6379/tcp
# shinhandb_elasticsearch_prod Up (healthy)        0.0.0.0:5652->9200/tcp
# shinhandb_adminer_prod      Up                  0.0.0.0:5651->8080/tcp

# 헬스체크 상태 확인
docker inspect shinhandb_backend_prod | grep -A 10 Health

# 리소스 사용량 확인
docker stats --no-stream
```

---

## 환경 변수 설정

### 프로덕션 환경 변수

프로덕션 배포 시 반드시 확인해야 할 환경 변수:

| 변수명 | 기본값 | 설명 | 필수 |
|--------|--------|------|------|
| `PROJECT_NAME` | shinhandb | 컨테이너 이름 prefix | ✅ |
| `DB_PASSWORD` | (없음) | PostgreSQL 비밀번호 (32자 이상) | ✅ |
| `REDIS_PASSWORD` | (없음) | Redis 비밀번호 (16자 이상) | ✅ |
| `JWT_SECRET` | (없음) | JWT 서명 키 (64자 이상) | ✅ |
| `ELASTICSEARCH_PASSWORD` | (없음) | Elasticsearch 비밀번호 | ✅ |
| `OPENAI_API_KEY` | (없음) | OpenAI API 키 (OCR용) | ❌ |
| `FRONTEND_PORT` | 5647 | 프론트엔드 포트 | ❌ |
| `BACKEND_PORT` | 5648 | 백엔드 포트 | ❌ |

### 환경 변수 우선순위

1. **Docker Compose 실행 시 inline**: `DB_PASSWORD=secret docker-compose up`
2. **`.env` 파일**: `docker-compose.prod.yml`과 같은 디렉토리
3. **`docker-compose.prod.yml` 파일 내 `environment`**
4. **시스템 환경 변수**: `export DB_PASSWORD=secret`

---

## 서비스 관리

### 시작, 중지, 재시작

```bash
# 모든 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 모든 서비스 중지
docker-compose -f docker-compose.prod.yml stop

# 모든 서비스 중지 및 컨테이너 삭제
docker-compose -f docker-compose.prod.yml down

# 모든 서비스 재시작
docker-compose -f docker-compose.prod.yml restart

# 특정 서비스만 재시작
docker-compose -f docker-compose.prod.yml restart backend
```

### 서비스 스케일링

```bash
# Backend 서비스를 3개로 스케일링
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# ⚠️ 주의: 포트 충돌 방지를 위해 포트 범위 설정 필요
```

### 컨테이너 내부 접속

```bash
# Backend 컨테이너 쉘 접속
docker exec -it shinhandb_backend_prod sh

# PostgreSQL CLI 접속
docker exec -it shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db

# Redis CLI 접속
docker exec -it shinhandb_redis_prod redis-cli -a your_redis_password

# 파일 복사 (호스트 → 컨테이너)
docker cp local_file.txt shinhandb_backend_prod:/app/

# 파일 복사 (컨테이너 → 호스트)
docker cp shinhandb_backend_prod:/app/logs/app.log ./
```

---

## 데이터베이스 관리

### 자동 초기화

Docker 컨테이너 최초 시작 시 다음 데이터가 자동으로 로드됩니다:

- **84개 프로젝트** (광고 자료)
- **4명 사용자** (admin, 지주 회원, 은행 회원, 클라이언트)
- **8개 카테고리** (지주 4개, 은행 4개)
- **1개 외부공유**

**초기화 스크립트 위치:**
- SQL 덤프: `backups/shinhandb_20260104.sql`
- 실행 스크립트: `docker/init-db.sh`

**초기화 로그 확인:**

```bash
docker logs shinhandb_db_prod | grep -A 20 "Database initialization"
```

### 수동 데이터베이스 복원

```bash
# 1. 컨테이너 내부 접속
docker exec -it shinhandb_db_prod sh

# 2. SQL 파일 복원
psql -U shinhandb_user -d shinhandb_db -f /docker-entrypoint-initdb.d/shinhandb_init.sql

# 또는 호스트에서 직접 실행
docker exec -i shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db < backups/shinhandb_20260104.sql
```

### 데이터베이스 스키마 확인

```bash
# 테이블 목록
docker exec shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db -c '\dt'

# 특정 테이블 구조
docker exec shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db -c '\d users'

# 데이터 개수 확인
docker exec shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db -c "
SELECT
  'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'External Shares', COUNT(*) FROM external_shares;
"
```

### Adminer를 통한 GUI 관리

1. 브라우저에서 http://localhost:5651 접속
2. 로그인 정보 입력:
   - **시스템**: PostgreSQL
   - **서버**: `database`
   - **사용자**: `shinhandb_user`
   - **비밀번호**: `.env` 파일의 `DB_PASSWORD` 값
   - **데이터베이스**: `shinhandb_db`

---

## 모니터링 및 로그

### 실시간 로그 확인

```bash
# 모든 서비스 로그 (실시간)
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.prod.yml logs -f backend

# 최근 100줄만 확인
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# 타임스탬프 포함
docker-compose -f docker-compose.prod.yml logs -f -t backend
```

### 로그 파일 위치

Docker는 JSON 파일 드라이버로 로그를 저장합니다:

```bash
# 로그 파일 위치 확인
docker inspect shinhandb_backend_prod | grep LogPath

# 로그 파일 직접 확인
sudo tail -f $(docker inspect --format='{{.LogPath}}' shinhandb_backend_prod)
```

**로그 로테이션 설정:**
- 최대 파일 크기: 50MB
- 최대 파일 개수: 5개
- 자동 삭제: 오래된 로그부터

### 헬스체크 모니터링

```bash
# 모든 컨테이너 헬스 상태
docker ps --format "table {{.Names}}\t{{.Status}}"

# 특정 서비스 헬스 로그
docker inspect shinhandb_backend_prod | jq '.[0].State.Health'

# 헬스체크 실패 시 자동 재시작 확인
docker events --filter 'container=shinhandb_backend_prod' --filter 'event=health_status'
```

### 리소스 사용량 모니터링

```bash
# 실시간 리소스 사용량
docker stats

# 특정 컨테이너만 확인
docker stats shinhandb_backend_prod shinhandb_db_prod

# CSV 형식으로 출력
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
```

---

## 백업 및 복원

### 데이터베이스 백업

#### 전체 백업 (스키마 + 데이터)

```bash
# 현재 날짜로 백업
docker exec shinhandb_db_prod pg_dump -U shinhandb_user -d shinhandb_db --clean --if-exists > backups/shinhandb_$(date +%Y%m%d_%H%M%S).sql

# 압축 백업
docker exec shinhandb_db_prod pg_dump -U shinhandb_user -d shinhandb_db --clean --if-exists | gzip > backups/shinhandb_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### 스키마만 백업

```bash
docker exec shinhandb_db_prod pg_dump -U shinhandb_user -d shinhandb_db --schema-only > backups/schema_$(date +%Y%m%d).sql
```

#### 데이터만 백업

```bash
docker exec shinhandb_db_prod pg_dump -U shinhandb_user -d shinhandb_db --data-only > backups/data_$(date +%Y%m%d).sql
```

### 데이터베이스 복원

```bash
# SQL 파일에서 복원
docker exec -i shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db < backups/shinhandb_20260104.sql

# 압축 파일에서 복원
gunzip -c backups/shinhandb_20260104.sql.gz | docker exec -i shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db
```

### 볼륨 백업 (전체 시스템)

```bash
# 볼륨 목록 확인
docker volume ls | grep shinhandb

# PostgreSQL 볼륨 백업
docker run --rm \
  -v shinhandb_postgres_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz /data

# Redis 볼륨 백업
docker run --rm \
  -v shinhandb_redis_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/redis_data_$(date +%Y%m%d).tar.gz /data

# Uploads 백업
docker run --rm \
  -v shinhandb_uploads_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /data
```

### 볼륨 복원

```bash
# PostgreSQL 볼륨 복원
docker run --rm \
  -v shinhandb_postgres_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres_data_20260104.tar.gz --strip 1"
```

### 자동 백업 스크립트 (Cron)

```bash
# 백업 스크립트 생성
cat > /usr/local/bin/shinhandb-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/data/successbank/projects/shinhandb/backups
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL 백업
docker exec shinhandb_db_prod pg_dump -U shinhandb_user -d shinhandb_db --clean --if-exists | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
EOF

# 실행 권한 부여
chmod +x /usr/local/bin/shinhandb-backup.sh

# Cron 등록 (매일 새벽 2시)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/shinhandb-backup.sh >> /var/log/shinhandb-backup.log 2>&1") | crontab -
```

---

## 트러블슈팅

### 일반적인 문제 해결

#### 1. 컨테이너가 시작되지 않음

**증상:**
```bash
docker-compose -f docker-compose.prod.yml ps
# STATUS: Restarting (1) 5 seconds ago
```

**해결 방법:**

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs backend

# 일반적인 원인:
# - 환경 변수 누락 (.env 파일 확인)
# - 데이터베이스 연결 실패 (DATABASE_URL 확인)
# - 포트 충돌 (netstat으로 확인)

# 포트 충돌 확인
sudo netstat -tuln | grep -E '5647|5648|5649|5650|5651|5652'

# 충돌 시 .env 파일에서 포트 변경
```

#### 2. 데이터베이스 연결 오류

**증상:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**해결 방법:**

```bash
# 1. 데이터베이스 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps database

# 2. 헬스체크 확인
docker inspect shinhandb_db_prod | grep -A 10 Health

# 3. DATABASE_URL 확인 (.env 파일)
# ❌ 잘못된 예: postgresql://shinhandb_user:password@localhost:5432/shinhandb_db
# ✅ 올바른 예: postgresql://shinhandb_user:password@database:5432/shinhandb_db

# 4. PostgreSQL 로그 확인
docker logs shinhandb_db_prod
```

#### 3. Redis 연결 오류

**증상:**
```
Error: Redis connection to redis:6379 failed - NOAUTH Authentication required
```

**해결 방법:**

```bash
# 1. REDIS_PASSWORD 확인 (.env 파일)
grep REDIS_PASSWORD .env

# 2. Redis 연결 테스트
docker exec shinhandb_redis_prod redis-cli -a your_redis_password ping
# 예상 출력: PONG

# 3. Redis 로그 확인
docker logs shinhandb_redis_prod
```

#### 4. Elasticsearch 연결 오류

**증상:**
```
Error: No living connections
```

**해결 방법:**

```bash
# 1. Elasticsearch 헬스체크
curl http://localhost:5652/_cluster/health?pretty

# 2. 컨테이너 메모리 확인 (최소 512MB 필요)
docker stats shinhandb_elasticsearch_prod

# 3. 메모리 부족 시 힙 크기 조정 (docker-compose.prod.yml)
# ES_JAVA_OPTS=-Xms256m -Xmx256m  (최소 사양)

# 4. Elasticsearch 로그 확인
docker logs shinhandb_elasticsearch_prod | tail -100
```

#### 5. 프론트엔드 빌드 실패

**증상:**
```
Error: NEXT_BUILD_DISABLED
```

**해결 방법:**

```bash
# 1. Next.js 설정 확인 (frontend/next.config.js)
# output: 'standalone' 옵션 확인

# 2. 빌드 로그 확인
docker-compose -f docker-compose.prod.yml build frontend --progress=plain

# 3. 캐시 삭제 후 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache frontend
```

### 성능 문제 해결

#### 1. 응답 속도 느림

```bash
# 1. 리소스 사용량 확인
docker stats

# CPU 사용률 90% 이상: 컨테이너 스케일링 필요
# 메모리 부족: Docker 메모리 제한 증가

# 2. 데이터베이스 쿼리 성능 확인
docker exec shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
"

# 3. Redis 캐시 히트율 확인
docker exec shinhandb_redis_prod redis-cli -a your_redis_password INFO stats | grep keyspace
```

#### 2. 디스크 용량 부족

```bash
# Docker 디스크 사용량 확인
docker system df

# 미사용 데이터 정리
docker system prune -a --volumes

# 로그 파일 정리
docker-compose -f docker-compose.prod.yml logs --tail=0
```

### 긴급 복구 절차

#### 데이터베이스 손상 시

```bash
# 1. 서비스 중지
docker-compose -f docker-compose.prod.yml stop

# 2. 최근 백업에서 복원
docker exec -i shinhandb_db_prod psql -U shinhandb_user -d shinhandb_db < backups/latest_backup.sql

# 3. 서비스 재시작
docker-compose -f docker-compose.prod.yml start
```

#### 전체 시스템 재구축

```bash
# 1. 모든 컨테이너 및 볼륨 삭제 (⚠️ 데이터 손실 주의!)
docker-compose -f docker-compose.prod.yml down -v

# 2. 이미지 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. 서비스 시작 (자동으로 초기 데이터 로드)
docker-compose -f docker-compose.prod.yml up -d
```

---

## 보안 권장사항

### 1. 비밀번호 정책

- **PostgreSQL**: 32자 이상, 대소문자+숫자+특수문자 조합
- **Redis**: 16자 이상, 랜덤 문자열
- **JWT Secret**: 64자 이상, hex 인코딩된 랜덤 문자열

```bash
# 강력한 비밀번호 생성
openssl rand -base64 32  # PostgreSQL
openssl rand -base64 16  # Redis
openssl rand -hex 32     # JWT Secret
```

### 2. 네트워크 격리

```bash
# 외부 접속 차단 (프로덕션 환경)
# docker-compose.prod.yml에서 ports 섹션 제거 또는 127.0.0.1 바인딩

# 예시:
ports:
  - "127.0.0.1:5649:5432"  # localhost만 접속 가능
```

### 3. HTTPS 설정 (Nginx/Traefik 사용)

```bash
# Nginx Reverse Proxy 예시
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://localhost:5647;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:5648;
    }
}
```

### 4. 정기 보안 업데이트

```bash
# Docker 이미지 업데이트
docker-compose -f docker-compose.prod.yml pull

# 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 재시작
docker-compose -f docker-compose.prod.yml up -d
```

### 5. 접근 제어

```bash
# .env 파일 권한 설정
chmod 600 .env

# Docker 소켓 권한 설정
sudo chmod 660 /var/run/docker.sock

# 백업 파일 암호화
gpg --symmetric --cipher-algo AES256 backups/shinhandb_20260104.sql
```

---

## 성능 최적화

### 1. PostgreSQL 튜닝

```sql
-- docker-compose.prod.yml에 추가
environment:
  - POSTGRES_INITDB_ARGS=--data-checksums --encoding=UTF-8
  - POSTGRES_MAX_CONNECTIONS=100
  - POSTGRES_SHARED_BUFFERS=256MB
  - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
  - POSTGRES_MAINTENANCE_WORK_MEM=64MB
  - POSTGRES_WORK_MEM=4MB
```

### 2. Redis 최적화

```bash
# docker-compose.prod.yml의 Redis 설정
command: >
  redis-server
  --requirepass ${REDIS_PASSWORD}
  --maxmemory 512mb
  --maxmemory-policy allkeys-lru
  --save 900 1 --save 300 10 --save 60 10000
  --appendonly yes
  --appendfsync everysec
```

### 3. Next.js 빌드 최적화

```javascript
// frontend/next.config.js
module.exports = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
};
```

### 4. 리소스 제한 설정

```yaml
# docker-compose.prod.yml에 추가
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## 운영 체크리스트

### 배포 전 체크리스트

- [ ] `.env` 파일 생성 및 모든 비밀번호 변경
- [ ] `JWT_SECRET` 64자 이상 랜덤 문자열 설정
- [ ] 포트 충돌 확인 (`netstat -tuln | grep 5647`)
- [ ] Docker 및 Docker Compose 버전 확인
- [ ] 디스크 용량 확인 (최소 20GB 이상)
- [ ] 메모리 확인 (최소 4GB 이상)
- [ ] 백업 디렉토리 생성 (`mkdir -p backups`)
- [ ] `docker/init-db.sh` 실행 권한 부여 (`chmod +x`)

### 배포 후 체크리스트

- [ ] 모든 컨테이너 상태 확인 (`docker-compose ps`)
- [ ] 헬스체크 통과 확인 (모두 `healthy` 상태)
- [ ] 웹 애플리케이션 접속 확인 (http://localhost:5647)
- [ ] 관리자 로그인 확인 (admin / 1234!@#$)
- [ ] 관리자 비밀번호 변경
- [ ] 데이터베이스 초기 데이터 확인 (Adminer)
- [ ] 백업 스크립트 실행 확인
- [ ] Cron 자동 백업 등록 확인
- [ ] 로그 로테이션 동작 확인

### 일일 운영 체크리스트

- [ ] 서비스 상태 확인 (`docker-compose ps`)
- [ ] 리소스 사용량 확인 (`docker stats`)
- [ ] 에러 로그 확인 (`docker-compose logs --tail=100`)
- [ ] 디스크 용량 확인 (`df -h`)
- [ ] 백업 파일 존재 확인 (`ls -lh backups/`)

---

## 지원 및 문의

### 개발팀 연락처

- **프로젝트 관리자**: successbank
- **GitHub**: https://github.com/successbank/shinhandb
- **이슈 트래커**: https://github.com/successbank/shinhandb/issues

### 문서 버전 관리

- **버전**: 1.0.0
- **작성일**: 2026-01-04
- **작성자**: 13년차 DB 전문가 2명, 15년차 백엔드 개발자 2명, 13년차 프론트엔드 개발자 3명
- **검수**: 7년차 QA 전문 인력 12명

### 라이선스

본 프로젝트는 신한금융그룹의 저작권으로 보호되며, 무단 복제 및 배포를 금지합니다.

---

## 부록

### A. Docker 명령어 치트시트

```bash
# 이미지 관리
docker images                           # 이미지 목록
docker rmi <image_id>                   # 이미지 삭제
docker image prune                      # 미사용 이미지 삭제

# 컨테이너 관리
docker ps                               # 실행 중인 컨테이너
docker ps -a                            # 모든 컨테이너
docker rm <container_id>                # 컨테이너 삭제
docker container prune                  # 중지된 컨테이너 삭제

# 볼륨 관리
docker volume ls                        # 볼륨 목록
docker volume inspect <volume_name>     # 볼륨 상세 정보
docker volume prune                     # 미사용 볼륨 삭제

# 네트워크 관리
docker network ls                       # 네트워크 목록
docker network inspect <network_name>   # 네트워크 상세 정보

# 시스템 정리
docker system df                        # 디스크 사용량
docker system prune -a --volumes        # 모든 미사용 데이터 삭제
```

### B. PostgreSQL 유용한 쿼리

```sql
-- 데이터베이스 크기
SELECT pg_size_pretty(pg_database_size('shinhandb_db'));

-- 테이블 크기
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 활성 연결 확인
SELECT * FROM pg_stat_activity WHERE datname = 'shinhandb_db';

-- 인덱스 사용률
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### C. Elasticsearch 유용한 API

```bash
# 클러스터 헬스
curl http://localhost:5652/_cluster/health?pretty

# 인덱스 목록
curl http://localhost:5652/_cat/indices?v

# 인덱스 크기
curl http://localhost:5652/_cat/indices?v&h=index,store.size

# 문서 검색
curl -X GET "http://localhost:5652/contents/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "query": {
    "match_all": {}
  }
}
'
```

---

**END OF DOCUMENT**

**마지막 업데이트**: 2026-01-04
**버전**: 1.0.0
**문서 상태**: Production Ready

이 문서는 신한금융 광고관리 플랫폼의 Docker 배포를 위한 공식 가이드입니다.
