// -- Company & Job Role Research --

export interface CompanyInfo {
  companyName: string;
  techStack: string[];
  culture: string;
  idealCandidate: string;
  recentNews: string[];
  businessDirection: string;
  confidence: number;
  sources: string[];
}

export interface JobRoleInfo {
  jobTitle: string;
  roleInsight: string;           // 이 직무가 뭔지 (기원, 업계 맥락, 유사 역할)
  roleKeyTraits: string[];       // 이 직무에서 성공하는 사람의 핵심 특성 3-5개
  confidence: number;
  sources: string[];
}

// 하위 호환용 합성 타입
export interface CompanyContext {
  companyName: string;
  techStack: string[];
  culture: string;
  idealCandidate: string;
  recentNews: string[];
  businessDirection: string;
  roleInsight: string;
  roleKeyTraits: string[];
  confidence: number;
  sources: string[];
}

// -- Gap Analysis --

export type GapSeverity = 'required' | 'preferred' | 'bonus';

export interface GapMatch {
  requirement: string;           // 회사가 원하는 역량
  severity: GapSeverity;
  evidence: string | null;       // 이력서에서 찾은 증거 (null이면 갭)
  matched: boolean;
  reframeSuggestion?: string;    // 기존 경험을 이 맥락에 맞게 재프레이밍하는 제안
}

export interface GapAnalysisResult {
  matches: GapMatch[];
  matchRate: number;             // 0-100, 전체 매칭률
  requiredMatchRate: number;     // 0-100, 필수 항목만의 매칭률
  missingEvidence: string[];     // 이력서에 추가해야 할 경험/성과
  overallAssessment: string;     // 2-3문장 종합 평가
  generatedAt: string;
}
