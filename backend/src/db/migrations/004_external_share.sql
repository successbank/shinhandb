-- =========================================
-- 004_external_share.sql
-- 외부공유 기능 추가
-- =========================================

-- 1. external_shares 테이블 (외부공유 메인)
CREATE TABLE IF NOT EXISTS external_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id VARCHAR(12) UNIQUE NOT NULL,           -- URL용 고유 ID (예: abc123xyz)
    password_hash VARCHAR(255) NOT NULL,            -- bcrypt 해시 (평문 절대 저장 금지!)
    is_active BOOLEAN DEFAULT TRUE,                 -- 활성화 여부
    expires_at TIMESTAMPTZ,                         -- 만료일시 (NULL: 무제한)
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 통계 필드 (선택)
    view_count INTEGER DEFAULT 0,                   -- 조회수
    last_accessed_at TIMESTAMPTZ                    -- 마지막 접근 시간
);

-- 2. share_contents 테이블 (공유-프로젝트 매핑)
CREATE TABLE IF NOT EXISTS share_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id UUID NOT NULL REFERENCES external_shares(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- ⚠️ projects 참조!
    category VARCHAR(10) NOT NULL CHECK (category IN ('holding', 'bank')),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2099),
    quarter VARCHAR(2) NOT NULL CHECK (quarter IN ('1Q', '2Q', '3Q', '4Q')),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 중복 방지 (같은 공유에 같은 프로젝트를 같은 분기에 2번 추가 방지)
    UNIQUE(share_id, project_id, category, year, quarter)
);

-- 3. share_access_logs 테이블 (접근 로그 - 보안)
CREATE TABLE IF NOT EXISTS share_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id UUID NOT NULL REFERENCES external_shares(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,                       -- IP 주소
    user_agent TEXT,                                -- User-Agent 헤더
    success BOOLEAN NOT NULL,                       -- 인증 성공 여부
    attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 인덱스 (성능 최적화)
-- =========================================

-- external_shares 인덱스
CREATE INDEX IF NOT EXISTS idx_external_shares_share_id ON external_shares(share_id);
CREATE INDEX IF NOT EXISTS idx_external_shares_active ON external_shares(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_external_shares_expires ON external_shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_shares_created_by ON external_shares(created_by);

-- share_contents 인덱스
CREATE INDEX IF NOT EXISTS idx_share_contents_share_id ON share_contents(share_id);
CREATE INDEX IF NOT EXISTS idx_share_contents_project_id ON share_contents(project_id);
CREATE INDEX IF NOT EXISTS idx_share_contents_category_year ON share_contents(category, year, quarter);
CREATE INDEX IF NOT EXISTS idx_share_contents_composite ON share_contents(share_id, category, year);

-- share_access_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_share_access_logs_share_id ON share_access_logs(share_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_ip ON share_access_logs(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_attempted_at ON share_access_logs(attempted_at DESC);

-- =========================================
-- 트리거 (updated_at 자동 갱신)
-- =========================================

CREATE TRIGGER update_external_shares_updated_at
    BEFORE UPDATE ON external_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 통계 정보 수집
-- =========================================

ANALYZE external_shares;
ANALYZE share_contents;
ANALYZE share_access_logs;

-- =========================================
-- 주석 (문서화)
-- =========================================

COMMENT ON TABLE external_shares IS '외부공유 URL 관리 테이블';
COMMENT ON TABLE share_contents IS '공유-프로젝트 매핑 테이블 (분기별 구성)';
COMMENT ON TABLE share_access_logs IS '외부공유 접근 로그 (보안 감사)';

COMMENT ON COLUMN external_shares.share_id IS 'URL용 고유 ID (예: abc123xyz) - nanoid(12) 생성';
COMMENT ON COLUMN external_shares.password_hash IS 'bcrypt 해시값 (평문 절대 저장 금지)';
COMMENT ON COLUMN external_shares.is_active IS '공유 활성화 상태 (비활성화 시 접근 차단)';
COMMENT ON COLUMN external_shares.expires_at IS '만료 일시 (NULL: 무제한, 값 있음: 해당 시간 이후 자동 비활성화)';
COMMENT ON COLUMN external_shares.view_count IS '총 조회수 (성공한 접근만 카운트)';
COMMENT ON COLUMN external_shares.last_accessed_at IS '마지막 성공 접근 시간';

COMMENT ON COLUMN share_contents.project_id IS '공유할 프로젝트 ID (⚠️ contents 아님!)';
COMMENT ON COLUMN share_contents.category IS '카테고리 구분: holding (신한금융지주) / bank (신한은행)';
COMMENT ON COLUMN share_contents.year IS '연도 (2025, 2026 등)';
COMMENT ON COLUMN share_contents.quarter IS '분기 (1Q, 2Q, 3Q, 4Q)';
COMMENT ON COLUMN share_contents.display_order IS '같은 분기 내 표시 순서';

COMMENT ON COLUMN share_access_logs.ip_address IS '접근자 IP 주소 (Rate Limiting 용도)';
COMMENT ON COLUMN share_access_logs.user_agent IS 'User-Agent 헤더 (디바이스 분석 용도)';
COMMENT ON COLUMN share_access_logs.success IS '비밀번호 인증 성공 여부 (false: 실패, true: 성공)';
COMMENT ON COLUMN share_access_logs.attempted_at IS '접근 시도 시간';
