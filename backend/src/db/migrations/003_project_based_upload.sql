-- =========================================
-- 003_project_based_upload.sql
-- 프로젝트 기반 업로드 기능 추가
-- =========================================

-- 1. projects 테이블 생성
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  editable_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. projects 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_uploader_id ON projects(uploader_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_editable_until ON projects(editable_until);

-- 3. contents 테이블 확장
ALTER TABLE contents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS file_type_flag VARCHAR(50);

-- 4. file_type_flag CHECK 제약 조건
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_file_type_flag'
  ) THEN
    ALTER TABLE contents ADD CONSTRAINT check_file_type_flag
      CHECK (file_type_flag IS NULL OR file_type_flag IN ('PROPOSAL_DRAFT', 'FINAL_MANUSCRIPT'));
  END IF;
END $$;

-- 5. contents 새 인덱스
CREATE INDEX IF NOT EXISTS idx_contents_project_id ON contents(project_id);
CREATE INDEX IF NOT EXISTS idx_contents_file_type_flag ON contents(file_type_flag);
CREATE INDEX IF NOT EXISTS idx_contents_project_flag ON contents(project_id, file_type_flag);

-- 6. project_categories 테이블 (프로젝트-카테고리 다대다)
CREATE TABLE IF NOT EXISTS project_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_project_categories_project_id ON project_categories(project_id);
CREATE INDEX IF NOT EXISTS idx_project_categories_category_id ON project_categories(category_id);

-- 7. projects updated_at 트리거
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. 통계 정보 수집
ANALYZE projects;
ANALYZE project_categories;
ANALYZE contents;

-- 9. 주석 추가
COMMENT ON TABLE projects IS '프로젝트 정보 (다중 파일 그룹화)';
COMMENT ON TABLE project_categories IS '프로젝트-카테고리 다대다 관계';
COMMENT ON COLUMN contents.project_id IS '소속 프로젝트 ID (NULL: 독립 파일)';
COMMENT ON COLUMN contents.file_type_flag IS '파일 타입 플래그: PROPOSAL_DRAFT (제안 시안), FINAL_MANUSCRIPT (최종 원고), NULL (독립 파일)';
COMMENT ON COLUMN projects.editable_until IS 'CLIENT 수정 가능 시간 제한 (NULL: 무제한 - ADMIN)';
