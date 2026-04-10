/**
 * JD 업종 자동 감지 + 업종별 평가 가중치/키워드
 */

export type Industry = 'it' | 'finance' | 'manufacturing' | 'public' | 'general';

interface IndustryProfile {
  label: string;
  description: string;
  evaluationWeights: {
    technicalSkills: number;   // 기술 역량
    experience: number;        // 경력/프로젝트
    certifications: number;    // 자격증/교육
    softSkills: number;        // 소프트스킬
    portfolio: number;         // 포트폴리오/GitHub
  };
  keyFocusAreas: string[];
  hrPerspective: string;
  practitionerPerspective: string;
}

const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  it: ['개발', '프론트엔드', '백엔드', '풀스택', 'React', 'TypeScript', 'Java', 'Python', 'AWS', 'DevOps', 'CI/CD', 'API', 'MSA', '마이크로서비스', 'Docker', 'Kubernetes', '클라우드', 'SaaS', 'Git', '프로그래밍', 'AI', '머신러닝', 'LLM', '데이터', 'engineer', 'developer', 'software'],
  finance: ['금융', '은행', '보험', '증권', '자산운용', '리스크', '핀테크', 'DT', '디지털전환', '여신', '수신', '외환', '투자', '심사', '준법', '컴플라이언스', 'AML', '자금세탁', 'KYC', '디지털금융', 'WM', '자산관리'],
  manufacturing: ['제조', '생산', '품질', '공정', '설비', '자동차', '반도체', '디스플레이', '배터리', '소재', 'QC', 'QA', '6시그마', '린', 'SCM', '물류', '조달', 'ERP', 'MES', '스마트팩토리', '설계', 'CAD'],
  public: ['공공', '공기업', '공단', '공사', '진흥원', '연구원', '재단', '공무원', '행정', 'NCS', '블라인드채용', '직업기초능력', '직무수행능력', '경험기술서', '한국전력', 'KOTRA', '국민건강보험'],
  general: [],
};

export const INDUSTRY_PROFILES: Record<Industry, IndustryProfile> = {
  it: {
    label: 'IT/개발',
    description: 'IT 기업 및 개발 직군',
    evaluationWeights: { technicalSkills: 40, experience: 25, certifications: 5, softSkills: 15, portfolio: 15 },
    keyFocusAreas: ['기술 스택 매칭', '문제 해결 과정', '코드 품질', '시스템 설계', '성능 최적화 경험'],
    hrPerspective: 'IT HR은 기술 스택 매칭과 경력 연차를 1차 필터로 봅니다. 포트폴리오/GitHub 링크가 있으면 가산점. "어떤 문제를 어떤 기술로 해결했는가"가 핵심.',
    practitionerPerspective: 'CTO/테크리드는 기술적 깊이를 봅니다. 단순 기술 나열이 아니라 "왜 그 기술을 선택했는가", "어떤 트레이드오프가 있었는가"를 중시.',
  },
  finance: {
    label: '금융/은행',
    description: '은행, 증권, 보험, 핀테크',
    evaluationWeights: { technicalSkills: 20, experience: 30, certifications: 15, softSkills: 25, portfolio: 10 },
    keyFocusAreas: ['디지털 전환(DT) 이해도', '리스크 관리 역량', '고객 중심 사고', '규제/컴플라이언스 이해', '데이터 분석 능력'],
    hrPerspective: '금융 HR은 NCS 기반 블라인드 채용이 기본. "왜 지금 이 은행인가?"에 대한 구체적 답변, DT 전략에 대한 이해를 봅니다.',
    practitionerPerspective: '리스크관리팀장/디지털전략팀장은 금융 도메인 지식과 디지털 역량의 교집합을 봅니다. 규제 환경에서의 혁신 경험이 차별화.',
  },
  manufacturing: {
    label: '제조/대기업',
    description: '삼성, 현대, LG, SK 등 대기업 제조',
    evaluationWeights: { technicalSkills: 30, experience: 30, certifications: 15, softSkills: 20, portfolio: 5 },
    keyFocusAreas: ['직무적합성', '전공 연관성', '프로젝트 수행 역량', '글로벌 역량', '문제해결/혁신 사례'],
    hrPerspective: '대기업 HR은 직무적합성평가(전공+활동+에세이)가 핵심. 탈스펙 채용이지만 전공 적합성은 여전히 중요. GSAT/HMAT 등 적성검사 통과가 전제.',
    practitionerPerspective: '생산기술파트장/R&D팀장은 전공 깊이와 실험/프로젝트 경험을 봅니다. "가치를 만드는 사람"인지, 단순 "기능을 수행하는 사람"인지 판별.',
  },
  public: {
    label: '공공기관/공기업',
    description: '공기업, 공단, 공사, 재단',
    evaluationWeights: { technicalSkills: 20, experience: 25, certifications: 20, softSkills: 25, portfolio: 10 },
    keyFocusAreas: ['NCS 직업기초능력 10개 항목', '경험기술서 STAR 구조', '직무수행능력', '조직이해능력', '직업윤리'],
    hrPerspective: '공공기관 HR은 NCS 서류전형(직무능력소개서)이 핵심. 블라인드 채용으로 학력/나이/성별 배제. 자기소개서가 면접 전형의 핵심 자료.',
    practitionerPerspective: 'NCS 면접관은 직업기초능력 10개 항목(의사소통, 문제해결, 자원관리 등)을 구조화된 질문으로 검증. 경험기술서의 STAR 구조 완성도가 핵심.',
  },
  general: {
    label: '일반',
    description: '업종 특화 없이 범용 분석',
    evaluationWeights: { technicalSkills: 25, experience: 30, certifications: 10, softSkills: 25, portfolio: 10 },
    keyFocusAreas: ['직무 전문 역량', '팀워크/협업', '성과 중심 서술', '구체적 수치', '경력 일관성'],
    hrPerspective: '채용담당자는 평균 7초 만에 이력서를 훑어봅니다. 상단 1/3에 핵심 성과 배치, 임팩트 중심 서술, JD 키워드 자연스럽게 포함이 핵심.',
    practitionerPerspective: '실무자는 "이 사람이 우리 팀에 합류하면 바로 기여할 수 있는가?"를 봅니다. 구체적 업무 수행 증거가 중요.',
  },
};

/** JD 텍스트에서 업종을 자동 감지 */
export function detectIndustry(jobDescription: string): Industry {
  const jdLower = jobDescription.toLowerCase();
  const scores: Record<Industry, number> = { it: 0, finance: 0, manufacturing: 0, public: 0, general: 0 };

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS) as Array<[Industry, string[]]>) {
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = jdLower.match(regex);
      if (matches) {
        scores[industry] += matches.length;
      }
    }
  }

  const sorted = Object.entries(scores)
    .filter(([k]) => k !== 'general')
    .sort(([, a], [, b]) => b - a);

  // 최소 3개 이상 매칭되어야 특정 업종으로 판별
  if (sorted[0] && sorted[0][1] >= 3) {
    return sorted[0][0] as Industry;
  }

  return 'general';
}

/** 업종별 프롬프트 컨텍스트 블록 생성 */
export function buildIndustryContext(industry: Industry): string {
  const profile = INDUSTRY_PROFILES[industry];
  if (industry === 'general') return '';

  return `
[업종별 맞춤 분석 — ${profile.label}]
감지된 업종: ${profile.label} (${profile.description})

평가 가중치:
- 기술 역량: ${profile.evaluationWeights.technicalSkills}%
- 경력/프로젝트: ${profile.evaluationWeights.experience}%
- 자격증/교육: ${profile.evaluationWeights.certifications}%
- 소프트스킬: ${profile.evaluationWeights.softSkills}%
- 포트폴리오: ${profile.evaluationWeights.portfolio}%

핵심 평가 영역: ${profile.keyFocusAreas.join(', ')}

[HR 관점] ${profile.hrPerspective}
[실무자 관점] ${profile.practitionerPerspective}

이 업종의 평가 기준에 맞춰 분석과 코칭을 조정하십시오.`;
}
