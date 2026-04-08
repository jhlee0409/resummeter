export interface Insight {
  source: string;
  confidence: 'verified' | 'analyzed' | 'inferred';
  category: 'documentation' | 'problem-solving' | 'collaboration' | 'technical' | 'soft-skill';
  observation: string;
  impact: string;
  recommendation?: string;
}


export enum AppStep {
  UPLOAD = 0,
  ANALYSIS = 1,
  REVIEW = 2
}

export interface GithubRepo {
  url: string;
  description: string;
}

export interface GitHubRepoData {
  metadata: {
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    topics: string[];
    updatedAt: string;
  };
  readme: string | null;
  languages: Record<string, number>;
  recentCommits: Array<{
    message: string;
    date: string;
    author: string;
  }>;
}

export interface GitHubFetchResult {
  repoUrl: string;
  status: 'success' | 'not-found' | 'rate-limited' | 'error';
  data?: GitHubRepoData;
  error?: string;
}

export interface UserInputData {
  resumeText: string;
  jobDescription: string;
  githubRepos: GithubRepo[];
  githubData?: GitHubFetchResult[];
}

export type PdfValidationError = 'TOO_LARGE' | 'INVALID_FORMAT' | 'ENCRYPTED' | 'CORRUPTED' | 'UNKNOWN';

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  phase: 'validating' | 'extracting' | 'rendering-thumbnail';
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  charCount: number;
  lineCount: number;
  thumbnailDataUrl: string | null;
  metadata: {
    author?: string;
    title?: string;
  };
}

export interface TailoredInstruction {
  persona: string;
  keywords: string[];
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

export interface Evidence {
  type: 'jd' | 'github' | 'best-practice';
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

export interface TailoredInstructionWithRequirements extends TailoredInstruction {
  jdRequirements: JdRequirement[];
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
}

// -- Narrative Framework Types --

export type NarrativeFramework = 'k-star-k' | 'tech-narrative';

export type NarrativeSectionType =
  | 'self-introduction'
  | 'career-project'
  | 'technical-skills'
  | 'motivation'
  | 'growth-plan'
  | 'custom';

export interface NarrativeSectionSpec {
  id: string;
  type: NarrativeSectionType;
  framework: NarrativeFramework;
  customTitle?: string;
  charLimit: number;
  prompt?: string;
}

export interface KStarKBreakdown {
  conclusion: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  potential: string;
}

export interface TechNarrativeBreakdown {
  problemDefinition: string;
  technicalApproach: string;
  implementation: string;
  impact: string;
}

export interface NarrativeSectionResult {
  specId: string;
  framework: NarrativeFramework;
  title: string;
  content: string;
  charCount: number;
  charLimit: number;
  status: 'success' | 'error';
  errorMessage?: string;
  kStarKBreakdown?: KStarKBreakdown;
  techNarrativeBreakdown?: TechNarrativeBreakdown;
  keywordsUsed: string[];
  githubEvidences: string[];
}

export interface NarrativeGenerationResult {
  sections: NarrativeSectionResult[];
  generatedAt: string;
}

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
    techStack: { score: number; weight: number; details: string[] };
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
  platform: 'inflearn' | 'udemy' | 'coursera' | 'youtube' | 'docs';
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