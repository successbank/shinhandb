#!/bin/bash

# 타임스탬프 생성
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_NAME="shinhandb_full_backup_${TIMESTAMP}"
TEMP_DIR="${BACKUP_DIR}/${BACKUP_NAME}"

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}신한DB 전체 백업 시작${NC}"
echo -e "${BLUE}========================================${NC}"

# 임시 디렉토리 생성
mkdir -p "${TEMP_DIR}"

# 1. PostgreSQL 데이터베이스 백업
echo -e "\n${GREEN}[1/5] PostgreSQL 데이터베이스 백업 중...${NC}"
docker exec shinhandb_db pg_dump -U shinhandb_user -d shinhandb_db --clean --if-exists > "${TEMP_DIR}/database.sql"
if [ $? -eq 0 ]; then
  echo "  ✓ 데이터베이스 백업 완료 ($(du -h "${TEMP_DIR}/database.sql" | cut -f1))"
else
  echo "  ✗ 데이터베이스 백업 실패"
  exit 1
fi

# 2. 백엔드 소스 코드 백업
echo -e "\n${GREEN}[2/5] 백엔드 소스 코드 백업 중...${NC}"
cp -r backend "${TEMP_DIR}/"
# node_modules 제외
rm -rf "${TEMP_DIR}/backend/node_modules"
rm -rf "${TEMP_DIR}/backend/.next"
echo "  ✓ 백엔드 소스 백업 완료"

# 3. 프론트엔드 소스 코드 백업
echo -e "\n${GREEN}[3/5] 프론트엔드 소스 코드 백업 중...${NC}"
cp -r frontend "${TEMP_DIR}/"
# node_modules 제외
rm -rf "${TEMP_DIR}/frontend/node_modules"
rm -rf "${TEMP_DIR}/frontend/.next"
echo "  ✓ 프론트엔드 소스 백업 완료"

# 4. 설정 파일 백업
echo -e "\n${GREEN}[4/5] 설정 파일 백업 중...${NC}"
cp docker-compose.yml "${TEMP_DIR}/"
cp -r docker "${TEMP_DIR}/"
cp .env.example "${TEMP_DIR}/"
# 실제 .env는 민감 정보이므로 선택적으로 백업 (주석 처리 가능)
if [ -f .env ]; then
  cp .env "${TEMP_DIR}/.env.backup"
  echo "  ✓ .env 파일 백업 완료 (.env.backup으로 저장)"
fi
cp CLAUDE.md "${TEMP_DIR}/" 2>/dev/null || true
cp README.md "${TEMP_DIR}/" 2>/dev/null || true
echo "  ✓ 설정 파일 백업 완료"

# 5. 압축
echo -e "\n${GREEN}[5/5] 백업 파일 압축 중...${NC}"
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
if [ $? -eq 0 ]; then
  echo "  ✓ 압축 완료 ($(du -h "${BACKUP_NAME}.tar.gz" | cut -f1))"
  # 임시 디렉토리 삭제
  rm -rf "${BACKUP_NAME}"
  echo "  ✓ 임시 파일 정리 완료"
else
  echo "  ✗ 압축 실패"
  exit 1
fi
cd - > /dev/null

# 백업 완료
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 전체 백업 완료!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "백업 파일: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo -e "파일 크기: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"
echo -e ""
echo -e "백업 내용:"
echo -e "  - PostgreSQL 데이터베이스"
echo -e "  - 백엔드 소스 코드 (backend/)"
echo -e "  - 프론트엔드 소스 코드 (frontend/)"
echo -e "  - Docker 설정 파일"
echo -e "  - 환경 설정 파일 (.env.example, .env.backup)"
echo -e "  - 문서 (CLAUDE.md, README.md)"
echo -e ""
