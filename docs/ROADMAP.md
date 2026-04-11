# Resummeter 고도화 로드맵

> 새 세션에서 작업 요청 시 이 문서를 참고. 각 항목은 독립적으로 요청 가능.
> 예: "로드맵에서 T1 결제 시스템 구현해줘"

## 완료된 작업

| ID | 작업 | 세션 | 커밋 |
|----|------|------|------|
| ✅ | GitHub 레포 입력 선택사항화 + 콜랩스 UI | 04-08 | `dd83dbd`, `5064fa8` |
| ✅ | 2단 탭 네비게이션 (5그룹) | 04-08 | `b3e5861` |
| ✅ | Radix UI 마이그레이션 (Collapsible, DropdownMenu, Select, Tabs, Progress, sonner) | 04-08 | `655af47`~`c5e08a5` |
| ✅ | LinkedIn/한줄소개 JD 분리 (이력서 기반) | 04-08 | `8e60b89`, `c6d4a3c` |
| ✅ | 코칭 체크박스 → 이력서 before→after 자동 적용 | 04-08 | `d66d646` |
| ✅ | 프롬프트 1차: Grounding, AI탐지회피, ATS키워드, Few-shot, 수치화, Temperature, 면접다양화 | 04-08 | `3d44abb`~`4fd32bb` |
| ✅ | 프롬프트 2차: Self-verification, HR관점, 시맨틱ATS, NCS매핑, Perplexity/Burstiness | 04-08 | `dac53c2` |
| ✅ | 프롬프트 3차: 인젝션방어(XML격리), 신입/경력 자동분기, 빈입력 가드 | 04-08 | `899d32b` |
| ✅ | 프롬프트 토큰 압축 (promptBlocks.ts 공통 블록 추출) | 04-09 | — |
| ✅ | Context Caching 인프라 (promptCache.ts) | 04-09 | — |
| ✅ | Phase 1: 프로덕션 안정성 (Zod + retry + error class) | 04-10 | `9dbaabb` |
| ✅ | Phase 2: 업종별 맞춤 프롬프트 (IT/금융/제조/공공 자동감지) | 04-10 | `e43daec` |
| ✅ | Phase 3: 코칭 적용 → ATS 점수 재분석 루프 | 04-10 | `49fc327` |
| ✅ | Phase 4: 실무자 관점 시뮬레이션 (CTO/리스크팀장/생산기술파트장/NCS면접관) | 04-10 | `d9257a5` |
| ✅ | Phase 5: 원클릭 파이프라인 4종 + 결과 요약 카드 | 04-10 | `2ca5aea`, `ffbe1d4` |
| ✅ | 리서치 문서화 (프롬프트/HR업종/상용화 전략) | 04-10 | `8496785` |
| ✅ | T2-1: Tailwind CSS 로컬 설치 + shadcn/ui 초기화 | 04-11 | — |
| ✅ | T2-2: 서술형 결과 → 이력서 반영 기능 | 04-11 | — |
| ✅ | T2-3: 이력서 템플릿 라이브러리 (8종, 4업종×2레벨) | 04-11 | — |
| ✅ | T2-4: 업종별 합격 이력서 사례 DB (9건, 패턴 분석 포함) | 04-11 | — |
| ✅ | T2-5: 사용자 분석 로그 시스템 (16 이벤트 타입) | 04-11 | — |
| ✅ | D1: Vitest 테스트 프레임워크 + 9개 파일 95개 테스트 | 04-11 | — |
| ✅ | 타입 에러 20개 전부 수정 (tsc clean) | 04-11 | — |
| ✅ | 번들 최적화: React.lazy + manualChunks (1,394KB→437KB, -69%) | 04-11 | — |
| ✅ | LLM 고도화: ThinkingLevel(14개), Temperature(14개), Few-shot(5개), CoVe(4개 추가) | 04-11 | — |

---

## Tier 1: 상용화 필수 (돈 받기 위한 최소 조건)

### T1-1. 사용자 인증 시스템
- **요청**: "로드맵 T1-1 사용자 인증 구현해줘"
- **스코프**: 회원가입/로그인/세션 관리
- **기술 후보**: Supabase Auth (가장 빠름) 또는 NextAuth.js
- **필요 사항**: 이메일+비밀번호, 소셜 로그인(Google/Kakao), 세션 유지
- **연관 파일**: App.tsx (라우팅), 새 파일 (AuthProvider, LoginPage, SignupPage)
- **고려 사항**: 현재 SPA 구조에서 인증 상태 관리, 토큰 저장 (httpOnly cookie vs localStorage)
- **예상 시간**: CC+gstack ~40분

### T1-2. 결제/구독 시스템
- **요청**: "로드맵 T1-2 결제 시스템 구현해줘"
- **스코프**: 무료/프로 플랜, 월간 구독
- **기술 후보**: 토스페이먼츠 (한국 시장) 또는 Stripe (글로벌)
- **플랜 구조 제안**:
  - Free: 월 3회 분석, 기본 코칭
  - Pro (₩9,900/월): 무제한 분석, 파이프라인, 실무자 시선, 버전 관리
  - Premium (₩19,900/월): 모든 기능 + 업종별 맞춤 + 면접 무제한
- **연관 파일**: 새 파일 (PricingPage, PaymentService, SubscriptionGuard)
- **선행 조건**: T1-1 인증 시스템
- **예상 시간**: CC+gstack ~60분

### T1-3. 배포 인프라
- **요청**: "로드맵 T1-3 배포 설정해줘"
- **스코프**: 프로덕션 배포 + 도메인 + HTTPS
- **기술 후보**: Vercel (Vite SPA에 최적) 또는 Cloudflare Pages
- **필요 사항**: 환경변수 관리 (GEMINI_API_KEY), 커스텀 도메인, CI/CD
- **연관 파일**: vite.config.ts, 새 파일 (vercel.json 또는 wrangler.toml)
- **예상 시간**: CC+gstack ~20분

### T1-4. API 키 보안 (백엔드 프록시)
- **요청**: "로드맵 T1-4 API 키 보안 처리해줘"
- **스코프**: 현재 클라이언트에서 직접 Gemini API 호출 → 서버사이드 프록시로 전환
- **현재 문제**: GEMINI_API_KEY가 클라이언트 번들에 노출됨
- **기술 후보**: Vercel Serverless Functions, Cloudflare Workers, 또는 별도 Express 서버
- **연관 파일**: services/*.ts (모든 API 호출), 새 파일 (api/ 디렉토리)
- **선행 조건**: T1-3 배포 인프라
- **예상 시간**: CC+gstack ~45분

---

## Tier 2: 제품 완성도 (경쟁력 강화)

### T2-1. Tailwind CSS 로컬 설치 + shadcn/ui 초기화
- **요청**: "로드맵 T2-1 Tailwind 로컬 설치해줘"
- **스코프**: CDN → 로컬 PostCSS 설치, shadcn CLI init, 기존 컴포넌트 마이그레이션
- **현재 상태**: Tailwind CDN 사용 중이라 shadcn init 불가
- **연관 파일**: index.html (CDN 제거), tailwind.config.ts (신규), postcss.config.js (신규)
- **예상 시간**: CC+gstack ~30분

### T2-2. 서술형 생성 결과 → 이력서 반영
- **요청**: "로드맵 T2-2 서술형 결과 이력서 반영 기능 만들어줘"
- **스코프**: 서술형(K-STAR-K/Tech Narrative) 생성 결과를 이력서 에디터에 삽입하는 기능
- **현재 문제**: 서술형을 생성해도 이력서 본문에 반영하려면 수동 복사 필요
- **연관 파일**: ReviewStep.tsx, NarrativeSectionView.tsx
- **예상 시간**: CC+gstack ~20분

### T2-3. 이력서 템플릿 라이브러리
- **요청**: "로드맵 T2-3 이력서 템플릿 만들어줘"
- **스코프**: 업종별/직급별 이력서 템플릿 제공 (IT 개발자, 금융 신입, 공기업 경력 등)
- **포함 내용**: 섹션 구조, 권장 분량, 핵심 키워드 가이드
- **연관 파일**: 새 파일 (templates/, TemplateSelector 컴포넌트)
- **예상 시간**: CC+gstack ~40분

### T2-4. 업종별 합격 이력서 사례 DB
- **요청**: "로드맵 T2-4 합격 사례 DB 구축해줘"
- **스코프**: 업종별 합격 이력서/자소서의 익명화된 사례 데이터
- **데이터 소스**: 링커리어, 잡코리아, 자소설닷컴의 공개 합격 자소서 패턴 분석
- **활용**: 프롬프트에 few-shot 예시로 주입, 사용자에게 참고 자료 제공
- **연관 파일**: 새 파일 (data/examples/, ExampleBrowser 컴포넌트)
- **선행 조건**: T2-1 (디자인 시스템이 있으면 UI가 더 나음)
- **예상 시간**: CC+gstack ~50분

### T2-5. 사용자 분석 로그
- **요청**: "로드맵 T2-5 분석 로그 수집 설정해줘"
- **스코프**: 사용자 행동 추적 (어떤 기능을 쓰는지, 이탈 포인트, 파이프라인 완료율)
- **기술 후보**: Amplitude (무료 티어), Mixpanel, 또는 Posthog (셀프호스팅)
- **핵심 이벤트**: 분석 시작, 탭 전환, 코칭 적용, 파이프라인 실행, 다운로드
- **연관 파일**: 새 파일 (services/analytics.ts), 각 컴포넌트에 이벤트 삽입
- **예상 시간**: CC+gstack ~30분

---

## Tier 3: 확장 (성장 단계)

### T3-1. 영어 전체 지원
- **요청**: "로드맵 T3-1 영어 지원 확장해줘"
- **스코프**: 현재 커버레터만 영어 지원 → 전체 14개 기능 영어화
- **포함**: UI 다국어 (i18n), 프롬프트 영어 버전, 영어 ATS 키워드
- **기술 후보**: react-i18next
- **예상 시간**: CC+gstack ~90분

### T3-2. 모바일 PWA
- **요청**: "로드맵 T3-2 PWA 설정해줘"
- **스코프**: Service Worker, manifest.json, 오프라인 지원, 홈 화면 추가
- **현재 상태**: 반응형 디자인은 부분적 (2단 탭이 모바일에서 동작)
- **연관 파일**: vite.config.ts (vite-plugin-pwa), public/manifest.json
- **예상 시간**: CC+gstack ~25분

### T3-3. 이력서 PDF 내보내기
- **요청**: "로드맵 T3-3 PDF 내보내기 만들어줘"
- **스코프**: 최적화된 이력서를 ATS-friendly PDF로 내보내기
- **기술 후보**: react-pdf, html2pdf.js, 또는 서버사이드 Puppeteer
- **연관 파일**: ReviewStep.tsx (내보내기 버튼), 새 파일 (services/pdfExport.ts)
- **예상 시간**: CC+gstack ~35분

### T3-4. 이력서 버전 비교 시각화
- **요청**: "로드맵 T3-4 버전 비교 강화해줘"
- **스코프**: 버전별 점수 추이 차트, "어떤 수정이 가장 점수를 올렸나" 분석
- **현재 상태**: VersionManagerView에 기본 저장/비교 있음 (localStorage)
- **기술 후보**: Recharts 또는 Chart.js
- **연관 파일**: VersionManagerView.tsx, services/versionService.ts
- **예상 시간**: CC+gstack ~30분

### T3-5. 포트폴리오 연동 분석 (IT 특화)
- **요청**: "로드맵 T3-5 포트폴리오 분석 기능 만들어줘"
- **스코프**: Notion/개인 블로그 URL 입력 → AI가 포트폴리오 품질 분석
- **현재**: GitHub만 분석. 포트폴리오 링크는 무시됨
- **연관 파일**: 새 파일 (services/portfolioService.ts, PortfolioAnalysisView.tsx)
- **선행 조건**: T1-4 (URL 크롤링은 서버사이드 필요)
- **예상 시간**: CC+gstack ~50분

---

## Tier 4: 고급 기능 (차별화 무기)

### T4-1. 실시간 협업 편집
- **요청**: "로드맵 T4-1 실시간 협업 만들어줘"
- **스코프**: 취업 코치/멘토가 이력서를 함께 편집 + AI 코칭을 같이 보기
- **기술 후보**: Yjs + WebSocket, Liveblocks
- **예상 시간**: CC+gstack ~120분 (대규모)

### T4-2. 채용공고 자동 수집 + 매칭
- **요청**: "로드맵 T4-2 채용공고 자동 매칭 만들어줘"
- **스코프**: 사람인/잡코리아/원티드 등에서 JD 자동 수집 → 이력서와 매칭 점수 계산
- **기술 후보**: 크롤링 서버 + 매칭 엔진
- **선행 조건**: T1-1, T1-3, T1-4 (서버 인프라 필수)
- **예상 시간**: CC+gstack ~180분 (대규모)

### T4-3. 면접 영상 분석
- **요청**: "로드맵 T4-3 면접 영상 분석 만들어줘"
- **스코프**: 웹캠 모의면접 → AI가 표정/어조/답변 내용 종합 분석
- **기술 후보**: Gemini Multimodal API (비디오 입력)
- **예상 시간**: CC+gstack ~150분 (대규모)

---

## 기술 부채 / 인프라 개선

### D1. 테스트 프레임워크 부트스트랩
- **요청**: "로드맵 D1 테스트 프레임워크 설정해줘"
- **스코프**: Vitest + @testing-library/react 설치, 핵심 서비스 유닛 테스트
- **현재**: 린터/테스트 프레임워크 없음 (CLAUDE.md에 명시)
- **우선 테스트 대상**: services/validation.ts, services/retry.ts, services/industryDetect.ts
- **예상 시간**: CC+gstack ~30분

### D2. 프롬프트 토큰 추가 압축
- **요청**: "로드맵 D2 프롬프트 압축해줘"
- **스코프**: 현재 프롬프트가 3차 개선으로 비대해짐. 중복 지시 통합, 핵심만 남기기
- **목표**: 프롬프트당 150-300단어 (현재 일부 500단어 이상)
- **연관 파일**: services/promptBlocks.ts, 5개 서비스 파일
- **예상 시간**: CC+gstack ~40분

### D3. 에러 바운더리 + 사용자 에러 UI
- **요청**: "로드맵 D3 에러 UI 만들어줘"
- **스코프**: React ErrorBoundary, 사용자 친화적 에러 페이지, retry 버튼
- **현재**: GeminiAPIError가 있지만 UI에서 표시하는 방식이 컴포넌트마다 다름
- **연관 파일**: 새 파일 (components/ErrorBoundary.tsx), 각 뷰 컴포넌트
- **예상 시간**: CC+gstack ~25분

### D4. 성능 최적화 (코드 스플리팅)
- **요청**: "로드맵 D4 코드 스플리팅해줘"
- **스코프**: 현재 번들 1.3MB. 탭별 lazy loading으로 초기 로딩 최적화
- **기술**: React.lazy + Suspense, Vite dynamic import
- **연관 파일**: components/ReviewStep.tsx (탭 컴포넌트들), vite.config.ts
- **예상 시간**: CC+gstack ~20분

---

## 세션 시작 시 참고사항

### 기술 스택 현황
- React 19 + TypeScript + Vite
- Tailwind CSS (CDN, 로컬 아님)
- Radix UI: collapsible, dropdown-menu, select, tabs, progress
- sonner (토스트)
- Google Gemini API (gemini-3-pro-preview, gemini-3-flash-preview)
- pdfjs-dist (PDF 파싱)
- Zod (런타임 스키마 검증)

### 주요 아키텍처
- SPA, 3단계 플로우: UPLOAD → ANALYSIS → REVIEW
- 14개 Gemini 프롬프트, 5개 서비스 파일
- ReviewStep: 2단 탭 네비게이션 (5그룹 × 14탭)
- 원클릭 파이프라인 4종
- 업종별 자동 감지 (IT/금융/제조/공공/일반)

### 프롬프트 공통 원칙 (전 14개 적용됨)
- 프롬프트 인젝션 방어 (XML 태그 격리)
- Grounding (외부 지식 추론 금지)
- 신입/경력 자동 분기
- 이력서 활용 우선순위 (경력 > 프로젝트 > 기타)
- Self-verification (코칭/서술형/커버레터)
- HR 실무자 관점 + 실무자 관점
- AI 탐지 대응 (perplexity/burstiness)
- 수치화 패턴 예시
- 업종별 가중치/키워드

### 사용자 피드백 (반드시 준수)
- gstack 스킬 적극 사용 (/qa, /qa-only, /browse, /review, /ship 등)
- 요구사항 전체를 한번에 구현. 반만 하고 물어보지 말 것
- shadcn/Radix 같은 검증된 라이브러리 사용. 수제 구현 금지
