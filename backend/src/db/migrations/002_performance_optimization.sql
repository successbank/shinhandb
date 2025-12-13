-- 성능 최적화를 위한 추가 인덱스 및 스키마 개선

-- 1. 복합 인덱스 추가 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_contents_category_created
ON contents(category_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contents_uploader_created
ON contents(uploader_id, created_at DESC);

-- 2. 전문 검색 성능 향상을 위한 GIN 인덱스 개선
CREATE INDEX IF NOT EXISTS idx_contents_title_search
ON contents USING gin(to_tsvector('korean', title));

CREATE INDEX IF NOT EXISTS idx_contents_description_search
ON contents USING gin(to_tsvector('korean', COALESCE(description, '')));

-- 3. 북마크 조회 최적화
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created
ON bookmarks(user_id, created_at DESC);

-- 4. content_categories 다중 카테고리 테이블 (아직 없는 경우 생성)
CREATE TABLE IF NOT EXISTS content_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_content_categories_content_id ON content_categories(content_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_category_id ON content_categories(category_id);

-- 5. 활동 로그 파티셔닝을 위한 준비 (월별로 분할 가능)
-- 일단 인덱스만 추가하고, 향후 파티셔닝 적용 가능
CREATE INDEX IF NOT EXISTS idx_activity_logs_date_user
ON activity_logs(DATE(created_at), user_id);

-- 6. 태그 사용 빈도 기반 인덱스 (이미 있지만 확인)
CREATE INDEX IF NOT EXISTS idx_tags_usage_count_desc ON tags(usage_count DESC);

-- 7. Materialized View: 카테고리별 콘텐츠 수 (캐싱용)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_content_count AS
SELECT
    c.id as category_id,
    c.name as category_name,
    c.user_role,
    c.parent_id,
    COUNT(DISTINCT cc.content_id) as content_count
FROM categories c
LEFT JOIN content_categories cc ON c.id = cc.category_id
GROUP BY c.id, c.name, c.user_role, c.parent_id;

-- Materialized View 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_content_category_id
ON mv_category_content_count(category_id);

-- Materialized View 갱신 함수
CREATE OR REPLACE FUNCTION refresh_category_content_count()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_content_count;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Materialized View 자동 갱신 트리거
DROP TRIGGER IF EXISTS trigger_refresh_category_count ON content_categories;
CREATE TRIGGER trigger_refresh_category_count
AFTER INSERT OR DELETE ON content_categories
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_category_content_count();

-- 8. 통계 정보 수집 (쿼리 플래너 최적화)
ANALYZE contents;
ANALYZE categories;
ANALYZE tags;
ANALYZE content_tags;
ANALYZE content_categories;
ANALYZE bookmarks;
ANALYZE activity_logs;

-- 9. 자동 VACUUM 설정 최적화 (테이블별)
ALTER TABLE contents SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE activity_logs SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

-- 10. 사용하지 않는 태그 정리 함수
CREATE OR REPLACE FUNCTION cleanup_unused_tags()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- usage_count가 0이고, content_tags에 연결이 없는 태그 삭제
    DELETE FROM tags
    WHERE id NOT IN (
        SELECT DISTINCT tag_id FROM content_tags
    ) AND usage_count = 0;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 정리 작업을 주기적으로 실행할 수 있는 함수
-- (cron job이나 pg_cron extension으로 실행 가능)

COMMENT ON MATERIALIZED VIEW mv_category_content_count IS
'카테고리별 콘텐츠 수 캐싱 - content_categories 변경 시 자동 갱신';

COMMENT ON FUNCTION cleanup_unused_tags() IS
'사용되지 않는 태그 정리 - 주기적으로 실행 권장';
