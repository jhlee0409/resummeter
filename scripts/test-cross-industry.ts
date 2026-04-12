/**
 * 범용성 테스트 — 다양한 산업(금융/제조/공공) JD에 대한 분석 파이프라인 견고성 검증.
 *
 * 목적:
 * - JD 분석이 IT 키워드만이 아닌 산업별 키워드(컴플라이언스, CAN, NCS 등)를 올바르게 포착하는가
 * - keywordAliases에 산업 특화 동의어(e.g., 제조의 "CAN", 공공의 "NCS")가 포함되는가
 * - 매칭 점수가 이력서-JD 적합도를 정확히 반영하는가 (IT 이력서 → 비IT JD는 저점 예상)
 *
 * 실행: npx tsx scripts/test-cross-industry.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { cached } from './testCache';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../core/analysis/jdAnalysis');
const { coachResume } = await import('../core/analysis/coaching');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');

// ──────────────────────────────────────────────────────────────────────────
// 산업별 테스트 JD (인라인)
// ──────────────────────────────────────────────────────────────────────────

const JD_FINANCE = `[은행권 Backend Engineer 채용 공고 — KB디지털뱅크]

■ 회사 소개
KB디지털뱅크는 국내 최대 금융그룹 KB금융지주의 디지털 전문 자회사로, 차세대 뱅킹 플랫폼과 핀테크 서비스를 개발/운영합니다. 모바일뱅킹, 오픈뱅킹, 마이데이터, 간편결제 등 리테일 금융 전반의 코어뱅킹 시스템을 책임집니다.

■ 포지션
Backend Engineer (신입/경력 3~7년)

■ 담당 업무
- 코어뱅킹 차세대 시스템 백엔드 API 설계 및 개발 (Java 17, Spring Boot 3.x, Spring Cloud)
- MSA(마이크로서비스 아키텍처) 기반 결제/송금/계좌 도메인 서비스 구현
- 오픈뱅킹/마이데이터 API 연동 및 외부 금융기관 EAI 인터페이스 개발
- 대용량 트랜잭션 처리 (TPS 10,000+) 및 이중화/장애 복구 아키텍처 설계
- 금융 도메인 배치 처리 (Spring Batch), 정산/마감 작업 자동화
- Kafka 기반 이벤트 드리븐 아키텍처 (결제 승인, 한도 체크, 부정거래 탐지)
- Redis/Hazelcast 캐시 설계, Oracle DB 튜닝, 쿼리 최적화
- 내/외부 감사 대응 및 금융보안원 보안 취약점 진단 대응

■ 자격 요건 (필수)
- Java/Spring 기반 백엔드 개발 경력 3년 이상 (Spring Boot, JPA, MyBatis)
- RDBMS 설계 및 SQL 튜닝 경험 (Oracle, PostgreSQL)
- RESTful API 설계 및 OpenAPI 3.0 명세 작성 경험
- Git, Jenkins, Gradle 기반 CI/CD 파이프라인 이해
- 금융권 또는 엔터프라이즈 환경에서의 팀 프로젝트 경험

■ 우대 사항
- 핀테크(PG/간편결제/송금) 또는 은행권 프로젝트 경험 3년 이상
- 전자금융거래법, 개인정보보호법, 신용정보법 등 금융 컴플라이언스 이해
- 금융보안원 전자금융감독규정 및 ISMS-P 인증 대응 경험
- PCI-DSS, ISO 27001 등 보안 표준 기반 개발 경험
- Kafka, RabbitMQ 등 메시지 큐 기반 이벤트 처리 경험
- MSA 전환 프로젝트 리딩 경험 (모놀리식 → MSA)
- 대용량 트랜잭션(TPS 5,000+) 처리 시스템 구축 경험
- Oracle Tuxedo, MCI/FEP 등 금융권 미들웨어 경험
- 정보처리기사, AWS Certified Developer, CISA 등 자격증
- 금융 관련 학과(재무, 경영, 금융공학) 복수전공

■ 우리가 찾는 사람
- 금융 도메인에 대한 이해와 책임감이 있는 분
- 0.1초 장애도 막대한 금융 손실로 이어지는 환경에서 신중함과 꼼꼼함을 겸비한 분
- 레거시 시스템과 신기술의 균형을 이해하고, 점진적 전환을 주도할 수 있는 분
- 보안/컴플라이언스를 제약이 아닌 설계 요건으로 받아들이는 분
- 장기 근속 의지와 조직 적응력이 있는 분

■ 근무 조건
- 서울 여의도 KB금융타워
- 금융권 표준 근태 (오전 9시~오후 6시, 탄력근무 일부 가능)
- 연봉: 협의 (경력 우대, 금융권 수준)
`;

const JD_MANUFACTURING = `[자동차 Embedded Software Engineer — 현대모비스 자율주행시스템BU]

■ 회사/조직 소개
현대모비스 자율주행시스템BU는 현대·기아차 및 글로벌 완성차 OEM에 공급되는 ADAS/자율주행 ECU, 레이더, 카메라 시스템의 임베디드 소프트웨어를 개발합니다. Level 2+~Level 3 자율주행 양산 프로젝트와 Level 4 선행개발을 동시에 진행합니다.

■ 포지션
Embedded Software Engineer (경력 3~8년, 양산 차량 ECU 개발)

■ 담당 업무
- 차량용 ECU(Electronic Control Unit) 펌웨어 설계 및 구현 (C/C++17)
- AUTOSAR Classic Platform (CP) 기반 BSW(Basic Software) 개발
- FreeRTOS, Vector MICROSAR, AUTOSAR OS 등 RTOS 환경에서 실시간 제어 로직 구현
- CAN/CAN-FD, LIN, FlexRay, Ethernet (SOME/IP, DoIP) 프로토콜 스택 개발 및 통합
- UDS(ISO 14229) 진단 통신 및 ECU 부트로더/FOTA(Firmware Over-The-Air) 구현
- 차량 기능안전 표준 ISO 26262 ASIL-B/D 준수 개발 프로세스 (HARA, FMEA, 안전요구사항 분석)
- MISRA C:2012 코딩 규칙 준수 및 정적 분석 도구(Polyspace, LDRA) 활용
- 센서 퓨전 알고리즘 (레이더/카메라/라이다) 실차 검증 및 HIL/SIL 시뮬레이션
- Vector CANoe/CANalyzer, dSPACE, ETAS INCA 기반 계측/검증
- 양산 프로젝트 품질 대응: PPAP, APQP, 8D 리포트 작성

■ 자격 요건 (필수)
- C/C++ 기반 임베디드 소프트웨어 개발 경력 3년 이상
- RTOS(FreeRTOS, Vx Works, AUTOSAR OS) 환경 개발 경험
- 마이크로컨트롤러(Infineon Aurix, NXP S32, Renesas RH850) 저수준 프로그래밍
- CAN 통신 스택 설계/구현 경험 (CAPL, DBC 파싱)
- 형상관리(Git, SVN), 이슈트래커(Jira, Polarion) 협업 경험

■ 우대 사항
- AUTOSAR CP/AP 아키텍처 설계 및 양산 적용 경험 3년 이상
- ISO 26262 ASIL-C/D 기능안전 프로젝트 수행 경험 (TÜV 인증 참여 우대)
- CAN-FD, FlexRay, Automotive Ethernet SOME/IP 스택 구현 경험
- UDS 진단, XCP 캘리브레이션, DoIP 플래싱 개발 경험
- MATLAB/Simulink 모델 기반 설계(MBD) 및 자동 코드 생성(TargetLink, Embedded Coder)
- Polyspace, LDRA, Coverity 등 정적 분석 도구 활용
- 완성차 OEM(현대기아/GM/Stellantis/VW) 양산 ECU 납품 경험
- 사이버보안(ISO 21434) 및 SW 업데이트(UNECE R156) 규제 대응 경험

■ 우리가 찾는 사람
- 양산 품질에 대한 책임감 (1ppm 결함도 리콜로 이어지는 환경 이해)
- 제한된 리소스(MCU 메모리 수백 KB, CPU 수백 MHz) 환경에서 최적화 집착
- 타이밍/인터럽트/ISR 등 실시간 제약에 대한 깊은 이해
- 완성차 개발 V-cycle과 Tier-1 공급사 업무 프로세스 숙지
- 영어 기술 문서 독해 및 글로벌 OEM 협업 가능

■ 근무 조건
- 경기 용인 마북연구소 (셔틀 운행)
- 자율좌석, 탄력근무제
- 연봉: 협의 (경력/역량 기반)
`;

const JD_PUBLIC = `[공공기관 정보시스템 개발자 — 한국정보화진흥원(NIA)]

■ 기관 소개
한국정보화진흥원(NIA, National Information Society Agency)은 과학기술정보통신부 산하 공공기관으로, 범정부 디지털 플랫폼 정부 구현, 공공데이터 개방, 지능정보사회 기반 조성 사업을 주관합니다.

■ 채용 포지션
정보시스템 개발자 (일반직 5급, 신입/경력 무관)

■ 담당 업무
- 범정부 공공데이터포털(data.go.kr) 시스템 운영 및 고도화 개발
- 공공데이터 개방 API 설계/구현 (Java, Spring Framework, JSP, MyBatis)
- 전자정부 표준프레임워크(eGovFrame) 기반 정보시스템 구축/유지보수
- 행정정보 공동이용, 마이데이터(공공) API 연계
- 공공기관 웹 접근성(WCAG 2.1, KWCAG 2.2) 및 웹 호환성 준수 개발
- 공공데이터품질관리 수준평가 대응 (데이터 표준화, 메타데이터 관리)
- 조달청 나라장터 SI 사업 감리 대응 및 감리지적사항 조치
- 행정안전부 전자정부사업관리위탁(PMO) 대응
- 정보시스템 감사(BSC, ISMS-P) 및 개인정보영향평가(PIA) 대응

■ 자격 요건 (필수)
- 학사 이상 학위 소지자 (전공 무관, 전산/정보통신 우대)
- 정보처리기사 또는 정보처리산업기사 자격 소지자
- Java/JSP/Spring Framework 기반 웹 개발 경험 (전자정부 표준프레임워크 이해)
- Oracle 또는 Tibero DB 사용 경험, SQL 작성 가능
- 한국사능력검정시험 3급 이상 (NCS 공공기관 공통)
- NCS 직업기초능력(의사소통, 문제해결, 자원관리, 대인관계, 정보, 기술, 조직이해, 직업윤리) 이해
- 국가공무원법 제33조 결격사유 없는 자

■ 우대 사항
- 전자정부 표준프레임워크(eGovFrame) 3.x/4.x 기반 개발 경험
- 공공데이터 개방/활용 프로젝트 참여 경험 (Open API 설계)
- 정보시스템감리원, 정보보안기사, CISA, CISSP 자격 소지자
- 국어능력인증시험, 한국어능력시험(KBS한국어) 3급 이상
- 저소득층/장애인/보훈대상자 등 취업지원대상자 (관련 법령에 따라 가산점 부여)
- 국가유공자 예우에 관한 법률 해당자
- 공공기관 SI 프로젝트 PM/PL 경험
- 행정정보 공동이용, 전자서명, 공인인증(GPKI/NPKI) 연동 경험
- 웹 접근성 품질마크 취득 경험
- 데이터품질관리(DQC-M, DQC-V) 인증 관련 업무 경험
- 블록체인, AI, 빅데이터 등 지능정보기술 공공 적용 사례 연구 경험

■ 우리가 찾는 사람
- 공공성과 국민 편익에 대한 사명감
- 감사 대응, 문서화, 표준 준수 등 공공기관 업무 특성 이해
- 장기 재직 의지 (공공기관 정년 보장, 순환 보직 수용)
- NCS 기반 직무역량 평가 방식 이해
- 행정기관/지자체/공공기관 이해관계자 커뮤니케이션 역량

■ 전형 절차
서류전형 → NCS 기반 필기시험(직업기초능력 50% + 직무수행능력 50%) → 인성검사 → 1차 면접(직무역량) → 2차 면접(인성/조직적합성) → 신원조회 → 최종합격

■ 근무 조건
- 대구광역시 동구 신서동 NIA 본원 (지방 순환 근무 가능)
- 공무원 준하는 근무 조건 (주 40시간, 유연근무제)
- 연봉: NIA 일반직 5급 초임 기준 (약 4,000~4,500만원)
- 기타: 공공기관 복리후생 (사학연금, 자녀학자금, 건강검진 등)
`;

// ──────────────────────────────────────────────────────────────────────────
// 테스트 케이스 정의
// ──────────────────────────────────────────────────────────────────────────

interface TestCase {
  industry: string;
  label: string;
  company: string;
  jobTitle: string;
  jdText: string;
  // 산업별 기대 키워드 (검증용)
  expectedKeywords: string[];
  expectedAliases: string[];
}

const cases: TestCase[] = [
  {
    industry: '금융',
    label: '은행 Backend Engineer',
    company: 'KB디지털뱅크',
    jobTitle: 'Backend Engineer',
    jdText: JD_FINANCE,
    expectedKeywords: ['Spring', 'Java', '핀테크', '컴플라이언스', 'MSA', 'Kafka'],
    expectedAliases: ['전자금융', '금융보안', 'ISMS'],
  },
  {
    industry: '제조',
    label: '자동차 Embedded Engineer',
    company: '현대모비스',
    jobTitle: 'Embedded Software Engineer',
    jdText: JD_MANUFACTURING,
    expectedKeywords: ['C/C++', 'RTOS', 'AUTOSAR', 'CAN', 'LIN', 'ISO 26262'],
    expectedAliases: ['CAN-FD', '기능안전', 'MISRA'],
  },
  {
    industry: '공공',
    label: '공공기관 정보시스템 개발자',
    company: '한국정보화진흥원',
    jobTitle: '정보시스템 개발자',
    jdText: JD_PUBLIC,
    expectedKeywords: ['Java', 'Spring', 'eGovFrame', '공공데이터', 'NCS', '전자정부'],
    expectedAliases: ['전자정부 표준프레임워크', '정보처리기사', 'WCAG'],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 키워드 매칭 검증
// ──────────────────────────────────────────────────────────────────────────

function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/()]/g, '');
}

function containsAny(haystack: string[], needles: string[]): { hits: string[]; misses: string[] } {
  const hayNorm = haystack.map(normalizeKeyword);
  const hayJoined = hayNorm.join('|');
  const hits: string[] = [];
  const misses: string[] = [];
  for (const n of needles) {
    const nNorm = normalizeKeyword(n);
    if (hayNorm.some(h => h.includes(nNorm) || nNorm.includes(h)) || hayJoined.includes(nNorm)) {
      hits.push(n);
    } else {
      misses.push(n);
    }
  }
  return { hits, misses };
}

// ──────────────────────────────────────────────────────────────────────────
// 테스트 실행
// ──────────────────────────────────────────────────────────────────────────

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
console.log(`\n이력서: ${resumeText.length}자 (IT 백그라운드 기준)\n`);

console.log('─'.repeat(72));
console.log(' 산업별 JD 분석 파이프라인 범용성 테스트');
console.log('─'.repeat(72));

const results: any[] = [];

for (const c of cases) {
  console.log(`\n━━━ [${c.industry}] ${c.label} — ${c.company} / ${c.jobTitle} ━━━`);
  const start = Date.now();

  // 1. JD 분석 (tailored instruction)
  process.stdout.write('  JD분석...');
  const instruction = await cached(
    'instruction-cross',
    [c.jdText.slice(0, 400), c.company, c.jobTitle],
    () => generateTailoredInstruction(c.jdText, c.company, c.jobTitle),
  );
  process.stdout.write(' OK  ');

  // 2. 회사 + 직무 리서치 (병렬)
  process.stdout.write('리서치...');
  const [companyInfo, roleInfo] = await Promise.all([
    cached('company-cross', [c.company], () => researchCompany(c.company)).catch(() => null),
    cached('role-cross', [c.jobTitle, c.company], () => researchJobRole(c.jobTitle, c.company)).catch(() => null),
  ]);
  const companyCtx = mergeResearchResults(companyInfo, roleInfo);
  process.stdout.write(' OK  ');

  // 3. 코칭 (gapMap, actionItems, matchScore)
  process.stdout.write('코칭...');
  const coach = await cached(
    'coaching-cross',
    [resumeText.slice(0, 200), c.jdText.slice(0, 200), c.company, c.jobTitle],
    () => coachResume({
      resumeText,
      jobDescription: c.jdText,
      instruction,
      githubRepos: [{ url: '', description: '' }],
      githubData: undefined,
      onStageChange: () => {},
      companyContext: companyCtx,
    }),
  );
  process.stdout.write(' OK  ');

  // 4. Scoring Engine (규칙 기반)
  process.stdout.write('점수산정...');
  const scoring = calculateScore(coach.gapMap, instruction, resumeText, c.jdText, companyCtx);
  console.log(' OK');

  const elapsed = Math.round((Date.now() - start) / 1000);

  // ── 검증 ──
  const keywordHits = containsAny(instruction.keywords, c.expectedKeywords);
  const aliasFlat = (instruction.keywordAliases ?? []).flatMap(a => [a.keyword, ...a.aliases]);
  const aliasHits = containsAny(aliasFlat, c.expectedAliases);

  // gap map 분류
  const strongCount = coach.gapMap.filter(g => g.currentLevel === 'strong').length;
  const weakCount = coach.gapMap.filter(g => g.currentLevel === 'weak').length;
  const missingCount = coach.gapMap.filter(g => g.currentLevel === 'missing').length;
  const totalPenalty = scoring.penalties.reduce((acc, p) => acc + p.points, 0);
  const levelLabel = LEVEL_LABELS[scoring.level]?.label ?? scoring.level;

  // 출력
  console.log('');
  console.log(`  ── 매칭 점수 ──`);
  console.log(`  LLM=${coach.matchScore} / Engine=${scoring.matchScore} (${levelLabel})`);
  console.log(`  감점 합계: -${totalPenalty}점 (${scoring.penalties.length}개 페널티)`);
  if (scoring.penalties.length) {
    for (const p of scoring.penalties.slice(0, 5)) {
      console.log(`    -${p.points} [${p.category}] ${p.reason.slice(0, 70)}`);
    }
  }

  console.log(`  ── Top 3 JD 키워드 (감지) ──`);
  for (const k of instruction.keywords.slice(0, 3)) {
    console.log(`    · ${k}`);
  }

  console.log(`  ── Top 3 keywordAliases ──`);
  const aliases = instruction.keywordAliases ?? [];
  if (aliases.length === 0) {
    console.log(`    (없음)`);
  } else {
    for (const a of aliases.slice(0, 3)) {
      console.log(`    · ${a.keyword} → [${a.aliases.slice(0, 4).join(', ')}]`);
    }
  }

  console.log(`  ── Gap Map ──`);
  console.log(`    total=${coach.gapMap.length} | strong=${strongCount} / weak=${weakCount} / missing=${missingCount}`);

  console.log(`  ── 산업별 키워드 검증 ──`);
  console.log(`    기대 keywords: ${c.expectedKeywords.join(', ')}`);
  console.log(`    hit (${keywordHits.hits.length}/${c.expectedKeywords.length}): ${keywordHits.hits.join(', ') || '(없음)'}`);
  if (keywordHits.misses.length) {
    console.log(`    miss: ${keywordHits.misses.join(', ')}`);
  }
  console.log(`    기대 aliases: ${c.expectedAliases.join(', ')}`);
  console.log(`    alias hit (${aliasHits.hits.length}/${c.expectedAliases.length}): ${aliasHits.hits.join(', ') || '(없음)'}`);

  console.log(`  ⏱  ${elapsed}초`);

  results.push({
    industry: c.industry,
    label: c.label,
    company: c.company,
    jobTitle: c.jobTitle,
    companyConfidence: companyCtx?.confidence ?? 0,
    detectedIndustry: instruction.detectedIndustry ?? 'unknown',
    keywordTop3: instruction.keywords.slice(0, 3),
    aliasTop3: aliases.slice(0, 3).map(a => ({ keyword: a.keyword, aliases: a.aliases.slice(0, 4) })),
    keywordHits: keywordHits.hits,
    keywordMisses: keywordHits.misses,
    aliasHits: aliasHits.hits,
    aliasMisses: aliasHits.misses,
    coachMatchScore: coach.matchScore,
    engineMatchScore: scoring.matchScore,
    level: scoring.level,
    levelLabel,
    totalPenalty,
    penaltyCount: scoring.penalties.length,
    gapMapTotal: coach.gapMap.length,
    strongCount,
    weakCount,
    missingCount,
    elapsedSec: elapsed,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 종합 리포트
// ──────────────────────────────────────────────────────────────────────────

console.log('\n');
console.log('═'.repeat(72));
console.log(' 산업별 범용성 종합 리포트');
console.log('═'.repeat(72));
console.log('');
console.log('| 산업 | 감지 산업 | Engine점 | 레벨 | 감점 | gap(S/W/M) | KW매칭 | Alias매칭 |');
console.log('|------|-----------|----------|------|------|-----------|--------|-----------|');
for (const r of results) {
  const row = [
    r.industry,
    r.detectedIndustry,
    `${r.engineMatchScore}(LLM:${r.coachMatchScore})`,
    r.levelLabel,
    `-${r.totalPenalty}`,
    `${r.strongCount}/${r.weakCount}/${r.missingCount}`,
    `${r.keywordHits.length}/${r.keywordHits.length + r.keywordMisses.length}`,
    `${r.aliasHits.length}/${r.aliasHits.length + r.aliasMisses.length}`,
  ];
  console.log(`| ${row.join(' | ')} |`);
}

console.log('\n── 검증 결과 ──');
const totalKwHits = results.reduce((s, r) => s + r.keywordHits.length, 0);
const totalKwExpected = results.reduce((s, r) => s + r.keywordHits.length + r.keywordMisses.length, 0);
const totalAliasHits = results.reduce((s, r) => s + r.aliasHits.length, 0);
const totalAliasExpected = results.reduce((s, r) => s + r.aliasHits.length + r.aliasMisses.length, 0);

console.log(`  산업별 키워드 감지율: ${totalKwHits}/${totalKwExpected} (${Math.round(totalKwHits / totalKwExpected * 100)}%)`);
console.log(`  산업별 alias 감지율: ${totalAliasHits}/${totalAliasExpected} (${Math.round(totalAliasHits / totalAliasExpected * 100)}%)`);

const allLowScore = results.every(r => r.engineMatchScore < 70);
console.log(`  IT 이력서 → 비IT JD 저점 확인: ${allLowScore ? 'PASS (모두 <70)' : 'FAIL (일부 고점)'}`);

// 저장
writeFileSync('/tmp/resummeter-cross-industry-results.json', JSON.stringify(results, null, 2));
console.log('\n결과 저장: /tmp/resummeter-cross-industry-results.json');
