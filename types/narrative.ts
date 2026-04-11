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

export interface NarrativeAnalysis {
  questionBreakdown: {
    corePoints: string[];
    narrativeSubject: 'strength' | 'project' | 'value' | 'contribution' | 'other';
    subjectReason: string;
  };
  selectedExperience: {
    main: {
      name: string;
      reason: string;
      relatedJdRequirements: string[];
    };
    sub?: {
      name: string;
      connectionToMain: string;
    };
  };
  jdKeywordsToWeave: string[];
  outline: Record<string, unknown>;
  humanTouchPoints: {
    personalContext: string;
    limitation: string;
    lessonLearned: string;
  };
}

export interface NarrativeGenerationResult {
  sections: NarrativeSectionResult[];
  generatedAt: string;
}
