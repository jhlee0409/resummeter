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