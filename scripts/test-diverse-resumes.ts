/**
 * 다양한 이력서 프로필 테스트 — 신입/경력전환자/시니어 간 pipeline 견고성 검증
 * 실행: npx tsx scripts/test-diverse-resumes.ts
 *
 * 공통 JD: Frontend Engineer (3년 이상)
 * 3개 프로필:
 *   - 신입 (Junior): CS 전공 학부생, 프로젝트 경험만 → 경력 감점 예상
 *   - 경력 전환자 (Career Changer): 마케팅 3년 → 부트캠프 → 1년 경력 → 도메인 부족 예상
 *   - 시니어 (Senior): 8+년 경력, 팀 리드 → 높은 match score 예상
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../core/analysis/jdAnalysis');
const { coachResume } = await import('../core/analysis/coaching');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');
const { parseResumeExperience } = await import('../core/scoring/requirementParser');
const { cached } = await import('./testCache');

// ───────────────────────── 공통 JD ─────────────────────────

const COMMON_JD = `[채용 공고] Frontend Engineer (3년 이상)

[회사 소개]
웨이브메이커(가명)는 B2B SaaS 분석 플랫폼을 운영하는 시리즈 B 스타트업입니다.
월간 활성 사용자 5만명, 국내외 300+ 고객사를 보유하고 있습니다.

[주요 업무]
- React 기반 SPA 설계 및 개발
- TypeScript 엄격 모드 코드베이스 유지
- 대용량 차트/대시보드 성능 최적화 (Recharts, D3)
- 디자인 시스템 컴포넌트 라이브러리 구축 및 유지보수
- 백엔드 API 스펙 협의 및 GraphQL 쿼리 최적화
- 신규 기능 주도적 설계 및 코드 리뷰 참여

[자격 요건]
- 프론트엔드 개발 경력 3년 이상
- React, TypeScript 실무 경험
- 상태관리 라이브러리 (Redux/Zustand/Recoil) 경험
- RESTful API, GraphQL 연동 경험
- Git 기반 협업 및 코드 리뷰 문화에 익숙한 분
- 학사 학위 이상 (전공 무관)

[우대 사항]
- B2B SaaS 프로덕트 경험
- 디자인 시스템 구축 경험
- Next.js, SSR/SSG 경험
- 성능 최적화 (Web Vitals, 번들 사이즈) 경험
- 오픈소스 기여 경험
- 테스트 코드 (Jest, Testing Library) 작성 경험

[근무 조건]
- 연봉: 5,500만 ~ 7,500만원 (경력에 따라 협의)
- 근무지: 서울 강남구 (하이브리드)
- 스톡옵션 제공
`;

// ───────────────────────── 프로필 1: 신입 ─────────────────────────

const RESUME_JUNIOR = `[이력서]

이름: 김신입
전공: 한국대학교 컴퓨터공학과 (2022.03 ~ 2026.02 졸업 예정)
학점: 3.8 / 4.5
연락처: junior@example.com

[소개]
웹 프론트엔드 분야에 관심이 많은 컴퓨터공학과 4학년 학부생입니다.
React와 TypeScript 기반 개인/팀 프로젝트를 진행하며 실무 감각을 쌓아왔습니다.
클린 코드와 테스트 주도 개발에 관심이 있으며, 꾸준히 학습하는 자세를 중요하게 생각합니다.

[학사 프로젝트]
1. 캠퍼스 중고거래 플랫폼 (2025.03 ~ 2025.06)
   - 팀 프로젝트 4명 (프론트엔드 2명 담당)
   - React 18, TypeScript, Zustand, React Query 사용
   - 상품 등록/검색/채팅 기능 구현
   - WebSocket 기반 실시간 채팅 서버 연동
   - Vercel 배포, 월 사용자 200명 달성
   - GitHub: github.com/example/campus-market

2. 개인 포트폴리오 블로그 (2024.12 ~ 2025.02)
   - Next.js 14 App Router, MDX, Tailwind CSS
   - Lighthouse 성능 점수 98점 달성
   - 다크모드, 검색 기능, 조회수 추적 구현
   - GitHub: github.com/example/blog

3. 알고리즘 시각화 웹앱 (2024.09 ~ 2024.11)
   - React, D3.js, TypeScript
   - 정렬/그래프 알고리즘 8종 시각화
   - 학과 과제로 최우수상 수상

[인턴 경험]
스타트업 "픽셀랩" 프론트엔드 인턴 (2025.07 ~ 2025.08, 2개월)
- React 컴포넌트 리팩토링
- Storybook 기반 디자인 시스템 문서화 지원
- 버그 수정 PR 6건 머지

[학습 이력]
- 인프런: "React 완벽 가이드", "TypeScript 시작하기" 수강
- 프로그래머스 코딩테스트 Lv.3 (실버)
- 사이드 프로젝트 꾸준히 진행 (GitHub 커밋 800+)

[기술 스택]
- Language: TypeScript, JavaScript, Python (학부 수준)
- Frontend: React 18, Next.js 14, Zustand, React Query, Tailwind CSS
- Tooling: Vite, ESLint, Prettier, Vitest (입문)
- 기타: Git, GitHub Actions 기초

[수상/활동]
- 2024 교내 해커톤 3등 (팀장, 웹 서비스 부문)
- 컴퓨터공학과 학생회 IT 부장 (2024)
- GDSC(Google Developer Student Club) 멤버 2년
`;

// ───────────────────────── 프로필 2: 경력 전환자 ─────────────────────────

const RESUME_CAREER_CHANGER = `[이력서]

이름: 박전환
경력: 마케팅 3년 → 프론트엔드 개발 1년 (총 4년)
학력: 한림대학교 경영학과 졸업 (2015.03 ~ 2019.02)
연락처: career@example.com

[소개]
B2C 마케터로 3년간 데이터 기반 퍼포먼스 캠페인을 운영하다,
코드로 직접 문제를 해결하고 싶다는 생각으로 개발자로 커리어 전환했습니다.
2023년 부트캠프 수료 후 1년간 스타트업에서 프론트엔드 실무를 쌓아왔습니다.
도메인 전환자로서 사용자 관점 + 비즈니스 맥락 이해가 강점입니다.

[경력]

1. 주식회사 셀라이트 (2024.03 ~ 현재, 1년 1개월)
   직무: 프론트엔드 엔지니어 (주니어)
   서비스: D2C 브랜드 쇼핑몰 + 관리자 대시보드

   - React 18, TypeScript, Redux Toolkit 기반 관리자 대시보드 신규 개발
     - 상품/주문/쿠폰 관리 페이지 7종 구현
     - React Hook Form + Zod 스키마 기반 폼 검증 체계 도입
   - 기존 JavaScript 쇼핑몰 프로젝트 TypeScript 마이그레이션 (약 40% 진행)
   - Jest + React Testing Library 단위 테스트 초기 세팅, 커버리지 18% → 45%
   - 주간 사내 기술 세미나 2회 발표 ("폼 검증 라이브러리 비교", "RTK Query 패턴")

2. 미디어웍스코리아 (2020.01 ~ 2023.02, 3년 2개월)
   직무: 퍼포먼스 마케터
   - 페이스북/구글/네이버 광고 캠페인 기획 및 집행, 월 예산 1.5억 관리
   - GA4, Amplitude 기반 유저 퍼널 분석 및 A/B 테스트 운영 20+건
   - SQL로 직접 마케팅 데이터 추출하여 주간 리포트 자동화 (재직 중 자발적 학습)
   - 대표 성과: 리타겟팅 캠페인 최적화로 CAC 32% 감소

[부트캠프]
우아한테크코스 3기 (2023.03 ~ 2023.12, 10개월)
- 프론트엔드 과정 수료
- 페어 프로그래밍, TDD, 코드 리뷰 문화 경험
- 최종 프로젝트: 러닝 크루 매칭 서비스 (PM+프론트 담당)

[사이드 프로젝트]
- 마케팅 대시보드 오픈소스 (2024.09 ~ 현재)
  - GA4 API 연동, 차트 시각화 (Recharts)
  - GitHub 스타 24, 기여자 3명
- 개인 블로그 (tistory → Next.js 이관)

[기술 스택]
- Language: TypeScript, JavaScript
- Frontend: React 18, Redux Toolkit, React Query, styled-components, Recharts
- Testing: Jest, React Testing Library
- Tooling: Vite, Webpack 기초, Git, GitHub Actions
- Data: SQL (MySQL, BigQuery), GA4, Amplitude

[강점 / 전환자 관점]
- 마케터 경험으로 A/B 테스트, 퍼널 분석 사고방식 익숙
- 비개발 이해관계자(디자이너, PM, 마케팅)와의 커뮤니케이션 경험 풍부
- SQL 실무 활용 가능
`;

// ───────────────────────── 프로필 3: 시니어 ─────────────────────────

const RESUME_SENIOR = `[이력서]

이름: 이시니어
경력: 프론트엔드 엔지니어 8년 6개월 (팀 리드 2년 포함)
학력: 성균관대학교 소프트웨어학과 졸업 (2012.03 ~ 2017.02)
연락처: senior@example.com

[소개]
B2B SaaS 및 핀테크 도메인에서 8년 이상 프론트엔드 엔지니어링을 해왔습니다.
3년간 팀 리드로서 5명 규모 FE 팀의 기술 방향성 수립, 디자인 시스템 구축,
코드 리뷰 문화 정착을 주도했습니다. 최근 관심사는 대규모 React 앱의
성능 최적화와 모노레포 아키텍처입니다.

[경력]

1. 핀테크스퀘어 (2022.04 ~ 현재, 3년)
   직무: 프론트엔드 팀 리드 (스태프 엔지니어)
   서비스: B2B 기업 정산/재무 SaaS (ARR 120억, 500+ 고객사)

   - 팀 관리: FE 엔지니어 5명 리드, 1:1 주간 미팅, 분기 OKR 수립
   - 아키텍처:
     - Nx 기반 모노레포 전환 (앱 4개 + 라이브러리 12개)
     - SSR(Next.js 14) 도입으로 초기 로딩 시간 4.2s → 1.8s 개선
     - Module Federation 기반 Micro-frontend 부분 도입 (결제 모듈)
   - 디자인 시스템 "Square DS" v1 → v2 전환 주도
     - Radix UI 기반 컴포넌트 45종, Storybook 문서화
     - 사내 3개 제품 공통 사용, 다른 팀 기여 PR 40+건
   - 성능 최적화:
     - 대시보드 차트 가상 스크롤 도입, 렌더링 시간 62% 감소
     - 번들 사이즈 1.8MB → 720KB (코드 스플리팅 + tree-shaking)
   - 채용: FE 3명 채용 전 과정 주도 (기술 인터뷰어)

2. 네이버 클로바 (2019.07 ~ 2022.03, 2년 9개월)
   직무: 시니어 프론트엔드 엔지니어
   - AI 스튜디오 웹 콘솔 개발 (React + TypeScript + Redux Saga)
   - WebSocket 실시간 추론 결과 스트리밍 UI 구현
   - 사내 오픈소스 "Clova UI Kit" 초기 설계 및 유지보수
   - 신입 온보딩 멘토링 4명

3. 쿠팡 (2017.03 ~ 2019.06, 2년 4개월)
   직무: 프론트엔드 엔지니어
   - 로켓배송 상품 상세 페이지 리뉴얼 (React 마이그레이션)
   - 일일 PV 500만 페이지의 성능 튜닝 (LCP 28% 개선)
   - A/B 테스트 플랫폼 연동 및 실험 10+건 운영

[오픈소스 / 기고]
- react-virtual-tree: 가상 스크롤 트리 컴포넌트, GitHub 스타 1.2k
- FEConf 2023 스피커: "모노레포 마이그레이션 18개월의 기록"
- DEVIEW 2024 발표: "대규모 디자인 시스템 v2 전환 실전기"
- 기술 블로그 (연 20+ 포스트)

[기술 스택]
- Language: TypeScript (엄격 모드 10년), JavaScript
- Frontend: React 19, Next.js 14, Redux Toolkit, Zustand, React Query, Recoil
- UI: Radix UI, Tailwind CSS, styled-components, Emotion
- Architecture: Nx, Turborepo, Module Federation, Micro-frontend
- Testing: Jest, React Testing Library, Playwright, Cypress
- Backend 협업: GraphQL (Apollo, Relay), REST, gRPC-Web
- CI/CD: GitHub Actions, CircleCI, Docker, Kubernetes (기본)
- 기타: Web Vitals, Lighthouse CI, Sentry, Datadog RUM

[리더십 경험]
- 신규 팀원 온보딩 프로세스 설계 (온보딩 기간 6주 → 3주)
- FE 챕터 위클리 스터디 운영 2년 (참여자 평균 12명)
- 기술 면접 인터뷰어 60+회
`;

// ───────────────────────── 실행 ─────────────────────────

interface ProfileCase {
  name: string;
  expectedIssue: string;
  resumeText: string;
}

const cases: ProfileCase[] = [
  {
    name: '신입 (Junior)',
    expectedIssue: '경력 요건(3년) 미달 감점 예상',
    resumeText: RESUME_JUNIOR,
  },
  {
    name: '경력 전환자 (Career Changer)',
    expectedIssue: 'FE 경력 1년 → 미달 + 도메인 경험 부족 예상',
    resumeText: RESUME_CAREER_CHANGER,
  },
  {
    name: '시니어 (Senior)',
    expectedIssue: '경력/역량 모두 충족, 높은 match score 예상',
    resumeText: RESUME_SENIOR,
  },
];

console.log('🧪 다양한 이력서 프로필 테스트\n');
console.log(`공통 JD: Frontend Engineer (3년 이상, ${COMMON_JD.length}자)\n`);

// JD instruction은 공통이므로 한 번만 생성
process.stdout.write('공통 JD 분석...');
const instruction = await cached(
  'diverse-instruction',
  [COMMON_JD],
  () => generateTailoredInstruction(COMMON_JD),
);
console.log(' OK');

const results: any[] = [];

for (const c of cases) {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`📋 ${c.name} — ${c.expectedIssue}`);
  console.log('━'.repeat(60));

  const parsed = parseResumeExperience(c.resumeText);
  const detectedMode = parsed.totalExperience !== null && parsed.totalExperience >= 1
    ? `경력 (${parsed.totalExperience}년, ${parsed.companies.length}개 회사)`
    : '신입 (회사 경력 1년 미만)';
  console.log(`  자동 판별: ${detectedMode}`);

  process.stdout.write('  코칭 중...');
  const coach = await cached(
    'diverse-coach',
    [c.name, c.resumeText, COMMON_JD],
    () => coachResume({
      resumeText: c.resumeText,
      jobDescription: COMMON_JD,
      instruction,
      githubRepos: [{ url: '', description: '' }],
      onStageChange: () => {},
    }),
  );
  console.log(' OK');

  const scoring = calculateScore(coach.gapMap, instruction, c.resumeText, COMMON_JD);
  const levelLabel = LEVEL_LABELS[scoring.level].label;

  // gapMap 분포
  const strongCount = coach.gapMap.filter((g: any) => g.currentLevel === 'strong').length;
  const weakCount = coach.gapMap.filter((g: any) => g.currentLevel === 'weak').length;
  const missingCount = coach.gapMap.filter((g: any) => g.currentLevel === 'missing').length;

  // 잠재력 보너스 여부 (warnings에서 감지)
  const potentialBonus = scoring.warnings.find(w => w.includes('잠재력 보너스'));

  console.log(`\n  📊 Match: LLM=${coach.matchScore} → Engine=${scoring.matchScore} (${levelLabel})`);
  console.log(`  📉 Top Penalties:`);
  if (scoring.penalties.length === 0) {
    console.log(`     (감점 없음)`);
  } else {
    for (const p of scoring.penalties.slice(0, 5)) {
      console.log(`     -${p.points} [${p.category}] ${p.reason.slice(0, 80)}`);
    }
  }
  console.log(`  🗺️  gapMap: strong=${strongCount} / weak=${weakCount} / missing=${missingCount}`);
  console.log(`  ✨ 잠재력 보너스: ${potentialBonus ? potentialBonus : '없음'}`);
  console.log(`  🔎 Breakdown: HR=${scoring.breakdown.hardRequirement} HS=${scoring.breakdown.hardSkill} EX=${scoring.breakdown.experience} SS=${scoring.breakdown.softSkill} DM=${scoring.breakdown.domain}`);

  results.push({
    name: c.name,
    mode: detectedMode,
    matchScore: scoring.matchScore,
    level: levelLabel,
    penalties: scoring.penalties.length,
    strong: strongCount,
    weak: weakCount,
    missing: missingCount,
    potentialBonus: potentialBonus ? '있음' : '없음',
  });
}

// ───────────────────────── 비교 요약 ─────────────────────────

console.log(`\n\n${'='.repeat(60)}`);
console.log('📊 프로필별 비교 요약');
console.log('='.repeat(60));
console.log('\n| 프로필 | Mode | Score | Level | 감점 | Strong/Weak/Missing | 잠재력 |');
console.log('|--------|------|-------|-------|------|---------------------|--------|');
for (const r of results) {
  console.log(`| ${r.name} | ${r.mode} | ${r.matchScore} | ${r.level} | ${r.penalties}개 | ${r.strong}/${r.weak}/${r.missing} | ${r.potentialBonus} |`);
}

console.log('\n🔍 기대치 검증:');
const junior = results[0];
const changer = results[1];
const senior = results[2];
console.log(`  - 신입: 경력 감점 적용? ${junior.penalties > 0 ? '✅' : '❌ 감점 없음 (예상 외)'}`);
console.log(`  - 경력 전환자: 경력 감점 + missing 증가? ${changer.penalties > 0 && changer.missing > 0 ? '✅' : '⚠️ 확인 필요'}`);
console.log(`  - 시니어: 높은 점수 (>= 70)? ${senior.matchScore >= 70 ? '✅' : `⚠️ ${senior.matchScore}점`}`);
console.log(`  - 점수 순서 (시니어 > 전환자 >= 신입)? ${senior.matchScore >= changer.matchScore && changer.matchScore >= junior.matchScore ? '✅' : '⚠️ 예상 외 순서'}`);
