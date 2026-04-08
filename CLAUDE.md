# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Resummeter는 Google Gemini API를 활용하여 이력서를 채용 공고(JD)와 GitHub 활동 기반으로 최적화해주는 React SPA이다. 한국어 기반 서비스.

## 개발 명령어

```bash
pnpm install         # 의존성 설치
pnpm dev             # 개발 서버 (localhost:3000)
pnpm build           # 프로덕션 빌드
pnpm preview         # 빌드 결과 미리보기
```

린터, 테스트 프레임워크는 없음.

## 환경 변수

`.env.local` 파일에 `GEMINI_API_KEY` 설정 필요. Vite가 `process.env.API_KEY`와 `process.env.GEMINI_API_KEY`로 주입함.

## 아키텍처

- **빌드**: Vite + React 19 + TypeScript. `@/*` path alias는 프로젝트 루트를 가리킴.
- **진입점**: `index.html` → `index.tsx` → `App.tsx`
- **3단계 스텝 플로우** (`AppStep` enum): UPLOAD → ANALYSIS → REVIEW
  - `UploadStep`: 이력서 텍스트, JD, GitHub 레포 목록 입력
  - `AnalysisStep`: 분석 중 로딩 UI
  - `ReviewStep`: 최적화된 이력서와 인사이트 표시
- **Gemini 서비스**: 5개 서비스 파일에 14개 AI 프롬프트
  - `geminiService.ts`: JD분석(Flash), 이력서분석(Pro), 코칭생성(Pro), 에비던스매칭(Flash), 서술형생성(Flash)
  - `atsService.ts`: ATS점수(Flash), 상세점수(Pro)
  - `careerDocService.ts`: 경력기술서(Pro), 커버레터(Pro), 한줄소개(Pro)
  - `interviewService.ts`: 면접질문(Pro), 답변평가(Flash)
  - `skillGapService.ts`: 학습경로(Flash), LinkedIn(Pro)
- **UI 프레임워크**: Radix UI 기반 (`@radix-ui/react-collapsible`, `react-dropdown-menu`, `react-select`, `react-tabs`, `react-progress`) + `sonner` 토스트
- **스타일링**: Tailwind CSS (CDN). 컴포넌트 내 유틸리티 클래스 직접 사용.
- **타입**: `types.ts`에 모든 공유 인터페이스/enum 정의
- **PDF 파싱**: `pdfjs-dist` (이력서 PDF 업로드 지원용)
- **ReviewStep**: 2단 네비게이션 (5그룹: 핵심분석/지원서작성/면접준비/개인브랜딩/부가기능)

## 프롬프트 엔지니어링

모든 14개 Gemini 프롬프트에 적용된 공통 원칙:

### 보안
- **프롬프트 인젝션 방어**: 모든 사용자 입력을 `<user-resume>`, `<user-jd>`, `<user-input>` XML 태그로 격리. `[보안 규칙]` 블록으로 데이터 안의 지시문 무시 지시.

### Grounding & 할루시네이션 방지
- **Grounding 규칙**: 제공된 데이터만 사용, 외부 지식 추론 금지
- **Self-verification (CoVe)**: 코칭/서술형/커버레터에서 생성 후 자기 검증 단계
- **입력 품질 가드**: 이력서 100자 미만, JD 50자 미만일 때 분석 거부

### 이력서 활용
- **신입/경력 자동 분기**: 회사 경력 1년 이상 여부로 자동 판별. 경력직은 회사 경력 우선, 신입은 프로젝트/인턴 우선.
- **과대 해석 금지**: 한 줄로 언급된 내용을 주요 강점으로 부풀리지 않음
- **추론 금지**: "~했을 것이다" 절대 금지, fact 기반만

### HR 실무자 관점
- 채용담당자 7초 스캔 기준 반영 (임팩트, 역할 적합성, 경력 일관성)
- ATS 시맨틱 매칭 (NLP 기반 의미적 유사성 평가)
- NCS 직업기초능력 10개 항목 매핑 (경력기술서)
- 면접 질문 다양화 (4기술+3인성+2상황판단+1심화)

### AI 탐지 대응
- 문장 길이 변화 (perplexity/burstiness)
- 금지 단어: "활용하여", "기반으로", "통해", "바탕으로" 각 1회 이하
- 구체적 동사 사용, 접속사 변화, 개인적 맥락 포함
- 추상적 미사여구/과도한 열정 표현 금지

### 미적용 (향후 과제)
- 프롬프트 토큰 압축 (현재 프롬프트가 장황해지는 추세)
- Context Caching (공통 시스템 프롬프트 분리)
- 업종별 맞춤화 (IT/금융/의료 등 키워드 가중치 차별화)

## 데이터 의존성 매트릭스

| 기능 | 이력서 | JD | GitHub | Instruction |
|------|--------|-----|--------|-------------|
| Gap Map / 코칭 제안 | 사전계산 | 사전계산 | 사전계산 | 사전계산 |
| 이력서 에디터 | ✅ | - | - | - |
| ATS / 상세 점수 | ✅ | ✅ | - | ✅ |
| 서술형 (K-STAR-K / Tech) | ✅ | ✅ | ✅(선택) | ✅ |
| 경력기술서 / 커버레터 | ✅ | ✅ | ✅(선택) | ✅ |
| 모의면접 / 학습경로 | ✅ | ✅ | - | ✅ |
| LinkedIn / 한줄소개 | ✅ | - | - | - |
| GitHub 근거 | - | - | ✅(필수) | ✅ |
| 버전 관리 | ✅ | ✅ | - | - |

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
