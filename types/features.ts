import type { GapMapItem } from './analysis';

// -- Career Statement Types --

export interface CareerStatement {
  id: string;
  title: string;
  content: string;
  starBreakdown: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  quantifiedResults: string[];
  relatedJdKeywords: string[];
}

export interface CareerStatementResult {
  statements: CareerStatement[];
  ncsCompatible: boolean;
  generatedAt: string;
}

// -- Cover Letter Types --

export type CoverLetterTone = 'formal' | 'confident' | 'passionate';
export type CoverLetterLength = 'short' | 'medium' | 'long';
export type CoverLetterLanguage = 'ko' | 'en';

export interface CoverLetterConfig {
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
}

export interface CoverLetterResult {
  content: string;
  language: CoverLetterLanguage;
  charCount: number;
  keywordsUsed: string[];
  generatedAt: string;
}

// -- Mock Interview Types --

export type InterviewQuestionType = 'technical' | 'behavioral' | 'situational';

export interface InterviewQuestion {
  id: string;
  type: InterviewQuestionType;
  question: string;
  intent: string;
  sampleAnswer: string;
  starGuide: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  relatedJdRequirements: string[];
}

export interface InterviewFeedback {
  questionId: string;
  score: number;
  strengths: string[];
  improvements: string[];
  revisedAnswer: string;
}

export interface InterviewSession {
  questions: InterviewQuestion[];
  answers: Record<string, string>;
  feedbacks: Record<string, InterviewFeedback>;
  generatedAt: string;
}

// -- Skill Gap + Learning Path Types --

export interface LearningResource {
  title: string;
  /** 학습 자원의 종류/제공처. 직무 범용 — 개발 강의 플랫폼에 국한하지 않음 (예: 인프런, Coursera, 보수교육, 공식문서, 도서) */
  platform: string;
  url: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface SkillGapItem extends GapMapItem {
  learningResources: LearningResource[];
  estimatedEffort: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface LearningRoadmap {
  items: SkillGapItem[];
  totalSkillGaps: number;
  criticalGaps: number;
  generatedAt: string;
}

// -- Version Management Types --

export interface ResumeVersion {
  id: string;
  name: string;
  resumeText: string;
  jobDescription: string;
  matchScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VersionComparison {
  versionA: ResumeVersion;
  versionB: ResumeVersion;
  diffHtml: string;
  scoreComparison: { a: number; b: number } | null;
}

// -- LinkedIn Optimization Types --

export interface LinkedInOptimization {
  headline: string;
  about: string;
  experienceHighlights: Array<{
    role: string;
    optimizedDescription: string;
  }>;
  keywordDensity: Array<{
    keyword: string;
    count: number;
    recommended: number;
  }>;
  generatedAt: string;
}

// -- About Statement (한 줄 자기소개 고도화) Types --

export type AboutStatementTone = 'professional' | 'friendly' | 'impactful';

export interface AboutStatementVersion {
  id: string;
  tone: AboutStatementTone;
  toneLabel: string;           // "격식있는" | "친근한" | "임팩트있는"
  content: string;
  charCount: number;
  improvements: string[];      // 개선 포인트 목록
  keywordsUsed: string[];      // 사용된 JD 키워드
  strengthsHighlighted: string[];
}

export interface AboutStatementResult {
  originalInput: string;
  originalAnalysis: string;    // 원본 문장 분석 노트
  versions: AboutStatementVersion[];
  bestVersion: string;         // 추천 버전 ID
  generatedAt: string;
}
