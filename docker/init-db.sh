#!/bin/bash
set -e

# ===================================
# PostgreSQL 데이터베이스 초기화 스크립트
# ===================================
# 이 스크립트는 PostgreSQL 컨테이너 시작 시 자동 실행됩니다.
# 데이터베이스가 비어있으면 백업 파일에서 복원합니다.

echo "🔍 Checking database initialization status..."

# 데이터베이스가 존재하는지 확인
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt' 2>/dev/null | grep -q 'public'; then
    echo "✅ Database already initialized. Skipping restoration."
    exit 0
fi

echo "📦 Database is empty. Restoring from backup..."

# 백업 파일이 존재하는지 확인
BACKUP_FILE="/docker-entrypoint-initdb.d/shinhandb_init.sql"

if [ -f "$BACKUP_FILE" ]; then
    echo "📥 Restoring database from: $BACKUP_FILE"

    # SQL 파일 실행
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$BACKUP_FILE"

    echo "✅ Database restoration completed successfully!"

    # 테이블 목록 출력
    echo "📊 Database tables:"
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'

    # 데이터 개수 확인
    echo "📈 Data count:"
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        SELECT
            'Users' as table_name, COUNT(*) as count FROM users
        UNION ALL
        SELECT 'Projects', COUNT(*) FROM projects
        UNION ALL
        SELECT 'Categories', COUNT(*) FROM categories
        UNION ALL
        SELECT 'External Shares', COUNT(*) FROM external_shares;
    "
else
    echo "⚠️  Warning: Backup file not found at $BACKUP_FILE"
    echo "⚠️  Database will remain empty. Please restore manually."
fi

echo "✅ Database initialization script completed."
