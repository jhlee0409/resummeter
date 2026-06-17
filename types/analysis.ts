import type { ScoringResult } from './scoring';

export interface Insight {
  source: string;
  confidence: 'verified' | 'analyzed' | 'inferred';
  category: 'documentation' | 'problem-solving' | 'collaboration' | 'technical' | 'soft-skill';
  observation: string;
  impact: string;
  recommendation?: string;
}

export interface TailoredInstruction {
  persona: string;
  keywords: string[];
  keywordAliases?: Array<{ keyword: string; aliases: string[] }>;  // 시맨틱 동의어 매핑
  evaluationCriteria: {
    hardSkills: string[];
    softSkills: string[];
    preferredExperience: string[];
  };
  toneGuide: {
    style: string;
    endings: string;
    avoidPatterns: string[];
  };
}

export interface JdRequirement {
  text: string;
  category: 'hard-skill' | 'soft-skill' | 'experience' | 'education';
  importance: 'required' | 'preferred';
  keywords: string[];
}

/** 증빙 출처 유형. github은 link 증빙의 한 종류, document/portfolio는 업로드 파일. */
export type EvidenceType = 'jd' | 'github' | 'best-practice' | 'document' | 'portfolio' | 'link';

export interface Evidence {
  type: EvidenceType;
  content: string;
  source?: string;
  confidence: 'verified' | 'inferred';
}

export interface ActionItem {
  id: string;
  targetSection: string;
  before: string;
  suggestion: string;
  after?: string;
  evidence: Evidence[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'keyword-gap' | 'quantify' | 'reframe' | 'add-missing' | 'remove';
}

export interface GapMapItem {
  requirement: string;
  category: 'hard-skill' | 'soft-skill' | 'experience' | 'education';
  currentLevel: 'strong' | 'weak' | 'missing';
  jdMentions: number;
  resumeMentions: number;
  relatedActions: string[];
  suggestion: string;
}

export interface EvidenceBank {
  repos: Array<{
    name: string;
    url: string;
    relevantTo: string[];
    evidences: Evidence[];
  }>;
  techStack: Record<string, string[]>;
  highlights: Evidence[];
}

export type Industry = 'it' | 'finance' | 'manufacturing' | 'public' | 'general';

/**
 * 직무 프로파일 — JD 분석 단계에서 LLM이 동적 생성.
 * 정적 INDUSTRY_PROFILES(IT/금융/제조/공공)를 대체하여 모든 직무를 범용 커버.
 * 14개 프롬프트/scoringEngine이 이 프로파일을 따라 직무별로 분기.
 */
export interface JobProfile {
  /** 직무군. 예: '프로덕트 디자인', 'B2B 영업', '병동 간호' — LLM 자유 생성 */
  jobFamily: string;
  /** 요구 연차 추정: '신입' | '주니어' | '미들' | '시니어' | '리드' 등 */
  seniorityHint: string;
  /** 직무 핵심 역량 4~6개 (비기술직이면 기술 용어 배제) */
  coreCompetencies: string[];
  /** 평가 가중치 — 5개 항목 합 100 */
  evaluationWeights: {
    coreSkills: number;      // 직무 핵심 실무역량
    experience: number;      // 경력/프로젝트
    certifications: number;  // 자격증/교육
    softSkills: number;      // 소프트스킬
    portfolio: number;       // 포트폴리오/증빙물
  };
  keyFocusAreas: string[];
  hrPerspective: string;
  /** 실무 면접관 직책. 예: '디자인 리드', '영업팀장', '수간호사' (개발 외엔 CTO 금지) */
  practitionerPersona: string;
  practitionerPerspective: string;
  /** 면접 hard-skill 질문 소재가 될 역량/도구/지식 4~8개 */
  hardSkillTaxonomy: string[];
  /** 직무별 경험 서사 구조 (Tech Narrative 일반화) */
  narrativeStructure: string;
  /** 이 직무에서 의미있는 증빙 자료 종류 */
  evidenceTypes: string[];
  /** 직무 역량 향상 학습 자원 종류 (인프런/Udemy enum 일반화) */
  learningResourceTypes: string[];
}

export interface TailoredInstructionWithRequirements extends TailoredInstruction {
  jdRequirements: JdRequirement[];
  /** 동적 직무 프로파일. JD 분석 시 LLM 생성. 부재 시 detectedIndustry 기반 폴백. */
  jobProfile?: JobProfile;
  /** @deprecated jobProfile로 대체됨. 폴백/하위호환용으로만 유지. */
  detectedIndustry?: Industry;
}

export interface CoachingResult {
  matchScore: number;
  summary: string;
  gapMap: GapMapItem[];
  actionItems: ActionItem[];
  quickWins: string[];
  optimizedResume: string;
  insights: Insight[];
  evidenceBank?: EvidenceBank;
  scoringResult?: ScoringResult;    // Scoring Engine 결과 (규칙 기반)
}
