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

테스트: `pnpm test` (Vitest). 린터는 없음.

## 환경 변수

`.env.local` 파일에 `GEMINI_API_KEY` 설정 필요. Vite가 `process.env.API_KEY`와 `process.env.GEMINI_API_KEY`로 주입함.

## 아키텍처

- **빌드**: Vite + React 19 + TypeScript. `@/*` path alias는 프로젝트 루트를 가리킴.
- **진입점**: `index.html` → `index.tsx` → `App.tsx`
- **3단계 스텝 플로우** (`AppStep` enum): UPLOAD → ANALYSIS → REVIEW
  - `UploadStep`: 이력서 텍스트, JD, GitHub 레포 목록 입력
  - `AnalysisStep`: 분석 중 로딩 UI
  - `ReviewStep`: 최적화된 이력서와 인사이트 표시
- **Gemini 서비스**: 기능별로 분리된 ~19개 AI 프롬프트 함수 (리팩토링 후 `services/` 단일 디렉터리는 제거됨)
  - `core/analysis/`: JD분석(`jdAnalysis.ts`), 이력서분석(`resumeAnalysis.ts`), 코칭생성(`coaching.ts`), 에비던스매칭/해석(`evidenceBank.ts`)
  - `core/research/`: 회사·직무 리서치(`companyResearch.ts`, Google Search grounding)
  - `features/*/service.ts`: ats-score(ATS/상세점수), career-statement(경력기술서), cover-letter(커버레터), about-statement(한줄소개), interview(면접질문/답변평가), skill-gap(학습경로), linkedin, narrative(서술형), practitioner(실무자시선), gap-analysis(역량갭)
  - `shared/api/geminiClient.ts`: 중앙 `getAI()`, 모델 티어, 세션 Context Caching 인프라
- **UI 프레임워크**: Radix UI 기반 (`@radix-ui/react-collapsible`, `react-dropdown-menu`, `react-select`, `react-tabs`, `react-progress`) + `sonner` 토스트
- **스타일링**: Tailwind CSS v3 (로컬 PostCSS). `app.css`에 커스텀 유틸리티 클래스 정의. `tailwind.config.ts`에 테마 설정.
- **shadcn/ui**: 초기화 완료 (`components.json`, `lib/utils.ts`). `cn()` 유틸리티 사용 가능. `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge` 설치됨.
- **타입**: `types.ts`에 모든 공유 인터페이스/enum 정의
- **PDF 파싱**: `pdfjs-dist` (이력서 PDF 업로드 지원용)
- **ReviewStep**: 2단 네비게이션 (5그룹: 핵심분석/지원서작성/면접준비/개인브랜딩/부가기능). 서술형 결과 → 이력서 삽입 기능.
- **이력서 템플릿**: `data/templates.ts`에 8종 (IT/금융/제조/공공 × 신입/경력). UploadStep에서 선택.
- **합격 사례 DB**: `data/examples.ts`에 13건 업종별 합격 자소서 패턴. ExampleBrowserView로 조회.
- **분석 로그**: `shared/lib/analytics.ts`에 17개 이벤트 타입. localStorage 저장, 향후 Amplitude/Posthog 연동 가능.
- **회사 컨텍스트**: `core/research/companyResearch.ts`. Gemini Google Search grounding으로 회사 정보 자동 수집. `CompanyContext` 타입.
- **역량 갭 분석**: `features/gap-analysis/service.ts`. 이력서 vs JD+회사컨텍스트 역량 매칭/갭 정밀 분석. `GapAnalysisView` 컴포넌트.
- **Scoring Engine**: `core/scoring/scoringEngine.ts`. 규칙 기반 100점 감점 모델. LLM은 분석만, 점수는 엔진이 계산.
  - 1단계: Hard Requirement (경력/학력) — JD 필수/우대 구분 반영
  - 2단계: gapMap 카테고리별 감점 — JD importance로 가중치 동적 조절 (0.5~1.0)
  - 3단계: 도메인 키워드 시맨틱 매칭 — `keywordAliases`로 동의어/관련 기술 매칭
  - 레벨: strong_match(90+) / conditional(70+) / weak(50+) / not_recommended(<50) / data_insufficient
  - `ScoreDashboard` 컴포넌트: 레벨 라벨, 감점 breakdown bar, penalty 상세

## 프롬프트 엔지니어링

모든 Gemini 프롬프트(~19개)에 적용된 공통 원칙:

### 보안
- **프롬프트 인젝션 방어**: 모든 사용자 입력을 `<user-resume>`, `<user-jd>`, `<user-input>` XML 태그로 격리. `[보안 규칙]` 블록으로 데이터 안의 지시문 무시 지시.

### Grounding & 할루시네이션 방지
- **Grounding 규칙**: 제공된 데이터만 사용, 외부 지식 추론 금지
- **Self-verification (CoVe)**: 모든 프롬프트에 자기검증 체크리스트 적용. ATS/상세점수/실무자시선/LinkedIn에 추가 (04-11)
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

### 프롬프트 토큰 압축 (적용 완료)
- `shared/prompt/promptBlocks.ts`: 공통 블록(보안, 그라운딩, 이력서 우선순위, AI탐지, HR관점, JD포맷 `formatInstruction`/`formatInstructionCriteria`) 상수/헬퍼로 추출
- `shared/api/geminiClient.ts`: 중앙화된 `getAI()`, 세션별 Context Caching 인프라 (`ai.caches.create`)
- 모든 프롬프트에서 반복 블록 제거 → `systemInstruction` 파라미터로 분리
- 결과: 프롬프트당 ~280 토큰 절감, 코드 중복 ~2,600 토큰 제거

### Context Caching (적용 완료)
- `systemInstruction`: 보안+그라운딩+이력서 우선순위 블록을 모든 API 호출에 systemInstruction으로 분리
- `shared/api/geminiClient.ts`: Gemini `ai.caches.create()` 기반 세션 캐시 (이력서+JD+instruction, TTL 30분)
- 캐시 생성 실패 시 자동 인라인 폴백 (systemInstruction + contents)

### Thinking Level (적용 완료, 04-11)
- Pro 모델 (8개 호출): `ThinkingLevel.HIGH` — 복잡한 분석/생성에 extended thinking
- Flash 모델 (6개 호출): `ThinkingLevel.MEDIUM` — 빠른 처리에 적절한 추론
- Temperature 일관화: 분석=0.2, 생성=0.3 (전 프롬프트 설정)

### Few-shot 예시 (적용 완료, 04-11)
- ATS 키워드 분석: GOOD/BAD 키워드 매칭 예시
- 상세 점수: Action Verb GOOD/BAD 예시
- 면접 질문: GOOD/BAD 기술/인성 질문 예시
- 실무자 시선: GOOD/BAD 강점/우려 서술 예시
- LinkedIn: GOOD/BAD headline/experience 예시

### 미적용 (향후 과제)
- 출력 후처리 Zod 스키마 검증 (점수 범위, 필드 길이 등)

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

## Health Stack

- typecheck: tsc --noEmit
- test: vitest run

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

<!-- harness-kit:start -->
## Engineering harness

Generated by `harness-kit:introspect` — the always-on discipline spine for this
repo. Generic agents, skills, and hooks come from the installed **harness-kit**
plugin; this block only adds the repo-specific layer. A re-run replaces this block.

**Stack** — React 19 SPA + TypeScript (`package.json`, `tsconfig.json`); Vite 6 build, Tailwind CSS v3 (`package.json`); Gemini via `@google/genai`, Zustand store, Zod.

**Entry points** — `pnpm dev` (vite, :3000) · `pnpm build` (vite build) · `pnpm test` (vitest run) · `tsc --noEmit` (typecheck).

### Top-level rules
- **0.0 Establish before executing.** On multi-step work, restate the ask + plan before the first tool call. Self-check: ① ambiguity ② scope ③ is this the real problem.
- **0.1 Skill first, then delegate.** Matching skill → invoke before edit/Bash/git. Architecture work → `typescript-architect`. Verification → the matching critic below.
- **0.2 Verify before claiming.** State/data claims = a real grep/run, never inferred. Repo/PR state = real `gh`/`git`.
- **0.3 No premature "done".** Done = a real end-to-end run with evidence shown. Run `change-verifier` before reporting done.
- **0.4 Commit gate.** Before commit: tests pass + `tsc --noEmit` + one logical unit. Fix hook failures at the root, never `--no-verify`.
- **0.5 Scope lock.** On a negative constraint ("only X", "not Y"), re-acknowledge and stop before exceeding it.
- **0.6 No overclaim.** Before "limit/sufficient/complete/fully-solves/no-effect" — can a cheap check falsify it? Run it, or say "not verified — <what's missing>". High-stakes → `claim-checker`.

### Test discipline
- Runner: **Vitest** — `pnpm test` (`vitest run`), jsdom + Testing Library.
- Tests-first for non-trivial changes; a behavior change ships with the test that proves it. Scoring/parsing logic (`core/scoring/scoringEngine.ts`, prompt post-processing) is the natural home for unit tests.

### Workflow
- **Specs.** Non-trivial work (≥2 modules / ≥3 commits / a new ADR) → `/harness-kit:new-spec <name>`. Small work skips it.
- **Decisions.** Non-obvious / hard-to-reverse choice → `/harness-kit:adr <title>` → `docs/adr/NNNN-*.md`.
- **Scratch.** Temp files → gitignored `scratch/`, never the repo root.
- **Resume.** Stopping mid-task → `/harness-kit:handoff`; fresh session → `/harness-kit:pickup`.
- **Build.** Behavior change → `/harness-kit:tdd` or `tdd-runner`. Hard bug → `/harness-kit:diagnose`.

### Agents — main agent delegates here automatically
- `typescript-architect` — structural / refactoring / type-architecture work (service layer, prompt pipeline, scoring engine).

### Critics — independent read-only checks, routed on demand by your phrasing
Plugin-provided; delegate when the request matches — on demand, not by default.
- `instruction-critic` — is this the right ask? — before non-trivial work.
- `requirement-fidelity-critic` — does the spec/design still match the original ask? — after a spec.
- `change-verifier` — is the change actually complete? (callsites / wiring / tests) — before "done".
- `claim-checker` — is a terminal claim measured or asserted? — before "limit / sufficient".
- `spec-reviewer` — did the PR deliver its spec's scope? — at PR time.
- `readability-critic` — can a human decide from this output? — before a human-facing surface.
- `pr-shepherd` — is the PR mergeable? — after opening / updating a PR.
- `architecture-reviewer` — is a structural change sound? — after a refactor.
- `ui-verify` — does the UI actually render and work in the browser? — after a frontend change (needs a browser driver; see below).

### Architecture
`typescript-architect` owns structural work. The app is a 3-step React SPA (UPLOAD → ANALYSIS → REVIEW) over 7 Gemini service files (14 prompts) with a rule-based `scoringEngine.ts`; see the detailed sections above in this CLAUDE.md. `ui-verify` needs the Playwright MCP (`claude mcp add playwright -- npx @playwright/mcp@latest`) — note CLAUDE.md mandates `/browse` for web browsing, so prefer that flow.
<!-- harness-kit:end -->
