# 🤖 OCR 기능 설정 가이드

## 📋 개요

신한금융 광고관리 플랫폼은 **OpenAI GPT-4 Vision**을 사용하여:
- ✅ 이미지에서 한글/영문 텍스트 자동 추출 (OCR)
- ✅ AI 기반 지능형 태그 자동 생성
- ✅ 검색 최적화

**한 번의 API 호출**로 두 가지 기능을 동시에 처리하여 **비용 효율적**입니다.

---

## 🔑 1단계: OpenAI API Key 발급

### 1-1. OpenAI Platform 접속
- URL: https://platform.openai.com/
- Google/Microsoft 계정으로 로그인 가능

### 1-2. API Key 생성
1. 상단 메뉴에서 **API keys** 클릭
2. **Create new secret key** 버튼 클릭
3. Key 이름 입력 (예: `shinhandb-ocr`)
4. **Create secret key** 클릭
5. **API Key 복사** (⚠️ 한 번만 표시됨!)
   - 형식: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 1-3. 요금제 확인
- **Pay-as-you-go** (사용량만큼 과금)
- 이미지 OCR + 태그 생성: 약 **$0.01/이미지**
- 신용카드 등록 필요 (최소 $5 충전)

---

## ⚙️ 2단계: 백엔드 설정

### 2-1. .env 파일 수정

파일 경로: `/data/successbank/projects/shinhandb/backend/.env`

```bash
# OpenAI API (for OCR + Intelligent Tag Generation)
# GPT-4 Vision을 사용하여 이미지에서 텍스트 추출 및 자동 태그 생성
# API Key 발급: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE
```

**⚠️ 중요**: `your_openai_api_key_here`를 실제 발급받은 API Key로 교체하세요!

### 2-2. 백엔드 재시작

```bash
# Docker 컨테이너 재시작
docker restart shinhandb_backend

# 로그 확인 (OCR 작동 확인)
docker logs shinhandb_backend --tail 50 -f
```

---

## ✅ 3단계: 테스트

### 3-1. 이미지 업로드 테스트

1. http://211.248.112.67:5647/upload 접속
2. 텍스트가 포함된 이미지 업로드 (예: 신한은행 광고)
3. 카테고리 선택 (최소 1개)
4. 제목 입력 후 **업로드** 클릭

### 3-2. 성공 확인 방법

업로드 성공 후 아래 정보가 표시되면 OCR 작동 중:

```
🤖 AI가 생성한 태그:
- 신한은행
- 적금
- 금융상품
- 브랜드 캠페인
...

전체 태그 (X개):
[수동 태그 + AI 태그]

추출된 텍스트 보기 ▼
[OCR로 추출한 텍스트]
```

### 3-3. 백엔드 로그 확인

```bash
docker logs shinhandb_backend --tail 100 | grep "OCR"
```

**성공 로그 예시:**
```
[OCR + AI] Processing file: abc123.jpg
[OCR + AI] Text extracted: 신한은행 특별 적금 ...
[OCR + AI] Tags generated: [ '신한은행', '적금', '금융상품', '브랜드 캠페인' ]
```

**실패 로그 예시:**
```
[OCR] Error: OpenAI API 인증 실패. OPENAI_API_KEY를 확인하세요.
```

---

## 🔍 문제 해결

### ❌ "OpenAI API 인증 실패"

**원인**: API Key가 올바르지 않거나 설정되지 않음

**해결**:
1. `.env` 파일에서 `OPENAI_API_KEY` 확인
2. API Key 형식 확인: `sk-proj-`로 시작
3. 백엔드 재시작: `docker restart shinhandb_backend`

### ❌ "OpenAI API 요청 한도 초과"

**원인**: 요금제 한도 초과 또는 크레딧 부족

**해결**:
1. OpenAI Platform에서 Usage 확인
2. 크레딧 충전 (Billing 메뉴)

### ❌ "No text detected"

**원인**: 이미지에 텍스트가 없거나 인식 불가

**해결**:
- 정상 동작 (텍스트 없는 이미지)
- 태그는 수동으로 추가 가능

### ❌ API Key가 없는 경우

**임시 해결책**: 업로드는 정상 작동하지만 자동 태그 생성 안 됨
- 수동으로 태그 입력 가능
- OCR 기능은 비활성화되지만 시스템은 정상 작동

---

## 💰 비용 관리

### 예상 비용 (2024년 12월 기준)

- **GPT-4o-mini Vision**: $0.01/이미지 (평균)
- 월 1,000장 업로드 시: 약 **$10**
- 월 10,000장 업로드 시: 약 **$100**

### 비용 절감 팁

1. **테스트 환경**: API Key 없이 수동 태그만 사용
2. **프로덕션**: 실제 업로드 시에만 API 사용
3. **사용량 모니터링**: OpenAI Platform에서 Usage 추적

---

## 📊 기술 스펙

### 사용 모델
- **GPT-4o-mini** (Vision 기능 포함)
- 한글/영문 고급 인식
- 맥락 기반 태그 생성

### 처리 흐름
```
이미지 업로드
    ↓
Base64 인코딩
    ↓
OpenAI GPT-4 Vision API 호출
    ↓
[동시 처리]
├─ OCR: 텍스트 추출
└─ AI: 태그 생성 (최대 10개)
    ↓
DB 저장 (contents, tags, content_tags)
    ↓
Elasticsearch 색인
```

### Fallback 전략
- OpenAI API 실패 시 → 기본 키워드 추출 로직
- 완전 실패 시 → 업로드는 계속 진행 (태그 없음)

---

## 🔐 보안 주의사항

### API Key 보호
- ✅ `.env` 파일은 **절대 Git에 커밋 금지**
- ✅ `.gitignore`에 `.env` 추가됨
- ✅ 서버 환경변수로 관리 권장

### 프로덕션 배포 시
```bash
# 환경변수로 직접 설정 (Docker Compose)
environment:
  - OPENAI_API_KEY=${OPENAI_API_KEY}

# 또는 .env 파일 권한 제한
chmod 600 backend/.env
```

---

## 📞 지원

### 공식 문서
- OpenAI API 문서: https://platform.openai.com/docs
- GPT-4 Vision 가이드: https://platform.openai.com/docs/guides/vision

### 문제 발생 시
1. 백엔드 로그 확인: `docker logs shinhandb_backend`
2. OpenAI Status 확인: https://status.openai.com/
3. API Key 재생성 시도

---

## ✨ 추가 기능 (향후 개선)

- [ ] OCR 신뢰도 점수 표시
- [ ] 사용자 피드백 기반 태그 학습
- [ ] 다국어 지원 (일본어, 중국어 등)
- [ ] 배치 처리로 비용 최적화

---

**마지막 업데이트**: 2024-12-14
**작성자**: Claude Code Development Team
