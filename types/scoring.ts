// -- ATS Optimization Types --

export interface AtsKeywordAnalysis {
  keyword: string;
  foundInResume: boolean;
  frequency: number;
  context: string;
  suggestion?: string;
}

export interface AtsAbbreviationSuggestion {
  original: string;
  expanded: string;
  suggestion: string;
}

export interface AtsScore {
  overall: number;
  keywordMatch: number;
  formatCompliance: number;
  keywordCount: number;
  recommendedRange: { min: number; max: number };
  isStuffing: boolean;
  stuffingWarnings: string[];
  keywords: AtsKeywordAnalysis[];
  abbreviations: AtsAbbreviationSuggestion[];
  formatIssues: string[];
}

// -- Detailed Scoring Types --

export interface DetailedScore {
  overall: number;
  breakdown: {
    /** 직무 핵심 역량 관련성 (기술직=기술스택, 그 외=직무 핵심 실무역량) */
    coreSkills: { score: number; weight: number; details: string[] };
    experience: { score: number; weight: number; details: string[] };
    impact: { score: number; weight: number; details: string[] };
    readability: { score: number; weight: number; details: string[] };
  };
  actionVerbs: {
    weak: Array<{ verb: string; line: string; suggestion: string }>;
    strong: string[];
  };
  quantification: {
    quantified: string[];
    needsQuantification: Array<{ line: string; suggestion: string }>;
  };
  starAnalysis: Array<{
    section: string;
    hasS: boolean;
    hasT: boolean;
    hasA: boolean;
    hasR: boolean;
    completeness: number;
    suggestion?: string;
  }>;
}

// -- Scoring Engine Types --

export type FitLevel = 'strong_match' | 'conditional' | 'weak' | 'not_recommended' | 'data_insufficient';

export interface Penalty {
  category: string;
  points: number;
  reason: string;
}

export interface ScoringResult {
  matchScore: number;            // 0-100, 규칙 기반
  level: FitLevel;
  penalties: Penalty[];
  warnings: string[];
  breakdown: {
    hardRequirement: number;     // 경력+학력 감점
    hardSkill: number;           // 기술스택 감점
    experience: number;          // 경험 관련성 감점
    softSkill: number;           // 소프트스킬 감점
    domain: number;              // 도메인 키워드 감점
  };
}

export interface ParsedRequirements {
  minExperience: number | null;
  education: string | null;
}

export interface ParsedResume {
  totalExperience: number | null; // null이면 파싱 실패
  companies: { name: string; months: number }[];
}
