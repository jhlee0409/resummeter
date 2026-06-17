/**
 * POC-A: 동적 JobProfile 생성 검증 (throwaway)
 *
 * 검증 질문: gemini-3-flash-preview가 다양한 직무 JD에서
 * 일관되고 쓸만한 JobProfile을 뽑는가? (개발 편향 없이)
 *
 * 실행: npx tsx scripts/poc-jobprofile.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// ── .env.local 로드 (기존 test 스크립트 컨벤션) ──
const envPath = resolve(import.meta.dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY not found");
  process.exit(1);
}
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { Type, ThinkingLevel } = await import("@google/genai");
const { getAI, MODELS } = await import("../shared/api/geminiClient");

// ── JobProfile responseSchema (Phase 1 타입 초안) ──
const jobProfileSchema = {
  type: Type.OBJECT,
  properties: {
    jobFamily: {
      type: Type.STRING,
      description: "직무군. 예: '프로덕트 디자인', 'B2B 영업', '병동 간호'. 자유롭게 직무에 맞게 생성.",
    },
    seniorityHint: {
      type: Type.STRING,
      description: "JD가 요구하는 연차 수준 추정: '신입' | '주니어' | '미들' | '시니어' | '리드' 중 하나",
    },
    coreCompetencies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "이 직무의 핵심 역량 4~6개. 기술직이 아니면 기술 용어 쓰지 말 것.",
    },
    evaluationWeights: {
      type: Type.OBJECT,
      description: "평가 가중치. 5개 항목 합이 정확히 100이 되도록.",
      properties: {
        coreSkills: { type: Type.NUMBER, description: "직무 핵심 실무역량" },
        experience: { type: Type.NUMBER, description: "경력/프로젝트" },
        certifications: { type: Type.NUMBER, description: "자격증/교육" },
        softSkills: { type: Type.NUMBER, description: "소프트스킬" },
        portfolio: { type: Type.NUMBER, description: "포트폴리오/증빙물" },
      },
      required: ["coreSkills", "experience", "certifications", "softSkills", "portfolio"],
    },
    keyFocusAreas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "채용 시 핵심적으로 보는 평가 영역 3~5개",
    },
    hrPerspective: {
      type: Type.STRING,
      description: "이 직무 HR 담당자의 서류 평가 관점 (2~3문장)",
    },
    practitionerPersona: {
      type: Type.STRING,
      description: "실무 면접관의 직책. 예: '디자인 리드', '영업팀장', '수간호사'. 개발 아니면 CTO 쓰지 말 것.",
    },
    practitionerPerspective: {
      type: Type.STRING,
      description: "실무 면접관이 중시하는 관점 (2~3문장)",
    },
    hardSkillTaxonomy: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "이 직무 hard-skill 면접 질문의 소재가 될 역량/도구/지식 4~8개",
    },
    narrativeStructure: {
      type: Type.STRING,
      description: "이 직무 경험을 서술할 때 적합한 서사 구조. 예: 영업='고객니즈→솔루션제시→계약→관계유지'. 개발 프로젝트 전제 금지.",
    },
    evidenceTypes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "이 직무에서 의미있는 증빙 자료 종류. 예: 디자이너='포트폴리오 사이트, 작업 이미지', 영업='실적표, 수상이력'",
    },
    learningResourceTypes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "이 직무 역량 향상에 적합한 학습 자원 종류. 인프런/Udemy에 국한하지 말 것.",
    },
  },
  required: [
    "jobFamily", "seniorityHint", "coreCompetencies", "evaluationWeights",
    "keyFocusAreas", "hrPerspective", "practitionerPersona",
    "practitionerPerspective", "hardSkillTaxonomy", "narrativeStructure",
    "evidenceTypes", "learningResourceTypes",
  ],
};

// ── 6개 직무 JD (개발 밖 직군 위주로 편향 검증) ──
const JDS: Array<{ label: string; jd: string }> = [
  {
    label: "① 백엔드 개발자",
    jd: `[백엔드 개발자 채용] 대용량 트래픽 처리 경험이 있는 백엔드 개발자를 찾습니다. 주요 업무: MSA 기반 결제 시스템 설계 및 개발, API 성능 최적화, DB 쿼리 튜닝. 자격요건: Java/Kotlin + Spring Boot 3년 이상, MySQL/Redis 실무 경험, AWS 운영 경험. 우대: Kafka 등 메시지 큐 경험, 대규모 트래픽 처리 경험.`,
  },
  {
    label: "② B2B 영업 (SaaS)",
    jd: `[B2B 엔터프라이즈 영업 담당] SaaS 솔루션을 기업 고객에게 판매할 영업 담당자를 모십니다. 주요 업무: 신규 고객사 발굴 및 콜드 아웃리치, 제품 데모 및 제안, 계약 협상 및 클로징, 기존 고객 업셀/리텐션 관리. 자격요건: B2B 영업 3년 이상, 연간 매출 목표 달성 경험, CRM(Salesforce 등) 활용 능력. 우대: SaaS/IT 솔루션 영업 경험, 엔터프라이즈 대형 딜 경험.`,
  },
  {
    label: "③ 퍼포먼스 마케터",
    jd: `[퍼포먼스 마케터] 데이터 기반으로 광고 성과를 최적화할 마케터를 찾습니다. 주요 업무: 페이스북/구글/네이버 광고 캠페인 기획 및 집행, ROAS 최적화, A/B 테스트, GA4 기반 퍼널 분석. 자격요건: 퍼포먼스 마케팅 2년 이상, 광고비 월 5천만원 이상 운영 경험, GA/GTM 활용. 우대: 앱 마케팅 경험, SQL 기초.`,
  },
  {
    label: "④ 프로덕트 디자이너",
    jd: `[프로덕트 디자이너] 사용자 중심의 모바일 앱 경험을 설계할 디자이너를 찾습니다. 주요 업무: UX 리서치 및 유저 인터뷰, 와이어프레임/프로토타입 제작, 디자인 시스템 운영, 개발자 협업. 자격요건: 프로덕트/UX 디자인 3년 이상, Figma 능숙, 포트폴리오 필수. 우대: 디자인 시스템 구축 경험, 데이터 기반 의사결정 경험.`,
  },
  {
    label: "⑤ 병동 간호사",
    jd: `[병동 간호사 모집] 상급종합병원 내과 병동에서 근무할 간호사를 모집합니다. 주요 업무: 입원 환자 간호 및 투약 관리, 활력징후 측정 및 기록(EMR), 의사 처방 수행, 환자/보호자 교육. 자격요건: 간호사 면허 소지, 신규 또는 경력 무관, 3교대 근무 가능. 우대: BLS 자격, 내과 병동 경력, 상급종합병원 경력.`,
  },
  {
    label: "⑥ 재무회계 담당",
    jd: `[재무회계 담당자] 중견기업 재무팀에서 결산 및 자금 업무를 담당할 인력을 채용합니다. 주요 업무: 월/분기/연 결산, 재무제표 작성, 세무 신고 지원, 자금 관리 및 자금수지 계획. 자격요건: 재무회계 실무 3년 이상, 전표 처리 및 결산 경험, ERP(SAP/더존) 활용. 우대: 세무회계 자격증(전산세무 등), 상장사 결산 경험.`,
  },
];

async function generateProfile(jd: string) {
  const prompt = `다음 채용공고(JD)를 분석하여, 이 "직무"에 맞는 평가 프로파일을 생성하라.

[중요 규칙]
- 이 직무가 개발/IT 직군이 아니면, 기술 스택·코딩·GitHub 같은 개발 전용 개념을 절대 끌어오지 말 것.
- evaluationWeights 5개 항목의 합은 반드시 정확히 100.
- 모든 필드를 이 직무의 실제 채용 현실에 맞게 채울 것.

<user-jd>
${jd}
</user-jd>`;

  const res = await getAI().models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: "application/json",
      responseSchema: jobProfileSchema,
    },
  });
  return JSON.parse(res.text ?? "{}");
}

console.log("═══════════ POC-A: 동적 JobProfile 생성 검증 ═══════════\n");

for (const { label, jd } of JDS) {
  console.log(`\n━━━━━━━━━━ ${label} ━━━━━━━━━━`);
  try {
    const p = await generateProfile(jd);
    const w = p.evaluationWeights ?? {};
    const wSum = Object.values(w).reduce((a: number, b) => a + (Number(b) || 0), 0);
    console.log(`jobFamily        : ${p.jobFamily}`);
    console.log(`seniorityHint    : ${p.seniorityHint}`);
    console.log(`coreCompetencies : ${(p.coreCompetencies ?? []).join(", ")}`);
    console.log(`weights(합=${wSum}) : core ${w.coreSkills} / exp ${w.experience} / cert ${w.certifications} / soft ${w.softSkills} / portfolio ${w.portfolio}`);
    console.log(`keyFocusAreas    : ${(p.keyFocusAreas ?? []).join(", ")}`);
    console.log(`practitioner     : ${p.practitionerPersona}`);
    console.log(`  └ 관점         : ${p.practitionerPerspective}`);
    console.log(`hrPerspective    : ${p.hrPerspective}`);
    console.log(`hardSkillTaxonomy: ${(p.hardSkillTaxonomy ?? []).join(", ")}`);
    console.log(`narrativeStructure: ${p.narrativeStructure}`);
    console.log(`evidenceTypes    : ${(p.evidenceTypes ?? []).join(", ")}`);
    console.log(`learningResources: ${(p.learningResourceTypes ?? []).join(", ")}`);
    // 자동 플래그
    const flags: string[] = [];
    if (wSum !== 100) flags.push(`⚠️ 가중치 합 ${wSum}≠100`);
    if (!label.includes("개발") && /CTO|테크리드|개발자|엔지니어/i.test(p.practitionerPersona ?? "")) flags.push("⚠️ 비개발 직무에 개발 페르소나");
    if (!label.includes("개발") && /git|코드|코딩|기술 스택|repository/i.test(JSON.stringify(p))) flags.push("⚠️ 비개발 직무에 개발 용어 누출");
    if (flags.length) console.log(`\n  🚩 ${flags.join(" | ")}`);
    else console.log(`\n  ✅ 자동 체크 통과`);
  } catch (e) {
    console.error(`  ❌ 실패: ${(e as Error).message}`);
  }
}

console.log("\n═══════════ 완료 — 위 결과 수동 검수 ═══════════");
