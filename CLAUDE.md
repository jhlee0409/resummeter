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
- **Gemini 서비스** (`services/geminiService.ts`): 2단계 AI 호출
  1. `generateTailoredInstruction` (Flash 모델): JD 분석 → 맞춤형 페르소나/가이드라인 생성
  2. `optimizeResume` (Pro 모델): 페르소나 + 이력서 + GitHub 정보 → JSON 스키마 기반 최적화 결과 반환
- **스타일링**: Tailwind CSS (CDN). 컴포넌트 내 유틸리티 클래스 직접 사용.
- **타입**: `types.ts`에 모든 공유 인터페이스/enum 정의 (`OptimizationResult`, `UserInputData`, `GithubRepo`, `AppStep`)
- **PDF 파싱**: `pdfjs-dist` 의존성 있음 (이력서 PDF 업로드 지원용)

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
