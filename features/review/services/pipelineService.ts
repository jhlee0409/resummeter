import type {
  TailoredInstructionWithRequirements,
  CoachingResult,
  NarrativeSectionSpec,
  CoverLetterConfig,
} from '../../../types';
import { generateCareerStatements } from '../../../services/careerDocService';
import { generateCoverLetter } from '../../../services/careerDocService';
import { generateNarrativeSections } from '../../../services/geminiService';
import { analyzeAtsScore } from '../../../services/atsService';
import { generateInterviewQuestions } from '../../interview/service';
import { generatePractitionerReview } from '../../practitioner/service';
import { generateLinkedInOptimization } from '../../../services/skillGapService';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PipelineType =
  | 'application-package'
  | 'score-optimization'
  | 'interview-prep'
  | 'personal-branding';

export interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export interface PipelineProgress {
  type: PipelineType;
  steps: PipelineStep[];
  currentStep: number;
}

export interface PipelineResults {
  careerStatements?: any;
  coverLetter?: any;
  narrativeSections?: any;
  atsScore?: any;
  interviewQuestions?: any;
  practitionerReview?: any;
  linkedinOptimization?: any;
  aboutStatement?: any;
}

// ─────────────────────────────────────────────────────────────
// Pipeline Definitions
// ─────────────────────────────────────────────────────────────

interface PipelineDefinition {
  steps: Array<{ id: string; label: string }>;
  run: (
    resumeText: string,
    jobDescription: string,
    instruction: TailoredInstructionWithRequirements,
    coachingResult: CoachingResult,
    updateStep: (index: number, status: PipelineStep['status'], error?: string) => void,
  ) => Promise<PipelineResults>;
}

const PIPELINE_DEFINITIONS: Record<PipelineType, PipelineDefinition> = {
  // ── 지원서 패키지: 경력기술서 → 커버레터 → 서술형 자소서 ──
  'application-package': {
    steps: [
      { id: 'career-statements', label: '경력기술서' },
      { id: 'cover-letter', label: '커버레터' },
      { id: 'narrative', label: '서술형 자소서' },
    ],
    async run(resumeText, jobDescription, instruction, coachingResult, updateStep) {
      const results: PipelineResults = {};

      // Step 1: 경력기술서
      updateStep(0, 'running');
      try {
        results.careerStatements = await generateCareerStatements(
          resumeText,
          jobDescription,
          instruction,
        );
        updateStep(0, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '경력기술서 생성 실패';
        updateStep(0, 'error', msg);
      }

      // Step 2: 커버레터 (career statement highlights injected via coachingResult)
      updateStep(1, 'running');
      try {
        const coverLetterConfig: CoverLetterConfig = {
          language: 'ko',
          tone: 'confident',
          length: 'medium',
        };
        results.coverLetter = await generateCoverLetter(
          resumeText,
          jobDescription,
          instruction,
          coverLetterConfig,
          coachingResult,
        );
        updateStep(1, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '커버레터 생성 실패';
        updateStep(1, 'error', msg);
      }

      // Step 3: 서술형 자소서 (auto-configured 2 sections)
      updateStep(2, 'running');
      try {
        const autoSpecs: NarrativeSectionSpec[] = [
          {
            id: 'pipeline-intro',
            type: 'self-introduction',
            framework: 'k-star-k',
            charLimit: 1000,
          },
          {
            id: 'pipeline-project',
            type: 'career-project',
            framework: 'k-star-k',
            charLimit: 1000,
          },
        ];
        results.narrativeSections = await generateNarrativeSections(
          autoSpecs,
          instruction,
          resumeText,
          jobDescription,
          [], // no GitHub repos for auto-pipeline
          undefined,
          coachingResult,
        );
        updateStep(2, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '서술형 자소서 생성 실패';
        updateStep(2, 'error', msg);
      }

      return results;
    },
  },

  // ── 점수 최적화: ATS 분석 → 실무자 시선 ──
  'score-optimization': {
    steps: [
      { id: 'ats-score', label: 'ATS 분석' },
      { id: 'practitioner', label: '실무자 시선' },
    ],
    async run(resumeText, jobDescription, instruction, _coachingResult, updateStep) {
      const results: PipelineResults = {};

      // Step 1: ATS 분석
      updateStep(0, 'running');
      try {
        results.atsScore = await analyzeAtsScore(
          resumeText,
          jobDescription,
          JSON.stringify(instruction),
        );
        updateStep(0, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'ATS 분석 실패';
        updateStep(0, 'error', msg);
      }

      // Step 2: 실무자 시선
      updateStep(1, 'running');
      try {
        results.practitionerReview = await generatePractitionerReview(
          resumeText,
          jobDescription,
          instruction,
        );
        updateStep(1, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '실무자 시선 분석 실패';
        updateStep(1, 'error', msg);
      }

      return results;
    },
  },

  // ── 면접 통합: 면접 질문 생성 → 실무자 시선 ──
  'interview-prep': {
    steps: [
      { id: 'interview', label: '면접 질문 생성' },
      { id: 'practitioner', label: '실무자 시선' },
    ],
    async run(resumeText, jobDescription, instruction, _coachingResult, updateStep) {
      const results: PipelineResults = {};

      // Step 1: 면접 질문 생성
      updateStep(0, 'running');
      try {
        results.interviewQuestions = await generateInterviewQuestions(
          resumeText,
          jobDescription,
          instruction,
        );
        updateStep(0, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '면접 질문 생성 실패';
        updateStep(0, 'error', msg);
      }

      // Step 2: 실무자 시선
      updateStep(1, 'running');
      try {
        results.practitionerReview = await generatePractitionerReview(
          resumeText,
          jobDescription,
          instruction,
        );
        updateStep(1, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '실무자 시선 분석 실패';
        updateStep(1, 'error', msg);
      }

      return results;
    },
  },

  // ── 퍼스널 브랜딩: LinkedIn 최적화 → (한줄소개는 사용자 입력 필요) ──
  'personal-branding': {
    steps: [
      { id: 'linkedin', label: 'LinkedIn 최적화' },
      { id: 'about', label: '한줄소개' },
    ],
    async run(resumeText, jobDescription, instruction, _coachingResult, updateStep) {
      const results: PipelineResults = {};

      // Step 1: LinkedIn 최적화
      updateStep(0, 'running');
      try {
        results.linkedinOptimization = await generateLinkedInOptimization(
          resumeText,
          jobDescription,
          instruction,
        );
        updateStep(0, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'LinkedIn 최적화 실패';
        updateStep(0, 'error', msg);
      }

      // Step 2: 한줄소개 - requires user input so we just mark as done
      // The about statement refinement needs a user-written draft to refine,
      // so we skip auto-generation and let the user navigate to it manually.
      updateStep(1, 'running');
      try {
        results.aboutStatement = null; // User must provide input
        updateStep(1, 'done');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '한줄소개 처리 실패';
        updateStep(1, 'error', msg);
      }

      return results;
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Pipeline Runner
// ─────────────────────────────────────────────────────────────

export async function runPipeline(
  type: PipelineType,
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  coachingResult: CoachingResult,
  onProgress: (progress: PipelineProgress) => void,
): Promise<PipelineResults> {
  const definition = PIPELINE_DEFINITIONS[type];

  const steps: PipelineStep[] = definition.steps.map((s) => ({
    id: s.id,
    label: s.label,
    status: 'pending' as const,
  }));

  const emitProgress = (currentStep: number) => {
    onProgress({
      type,
      steps: [...steps],
      currentStep,
    });
  };

  // Initial progress: all pending
  emitProgress(0);

  const updateStep = (index: number, status: PipelineStep['status'], error?: string) => {
    steps[index] = { ...steps[index], status, error };
    emitProgress(index);
  };

  const results = await definition.run(
    resumeText,
    jobDescription,
    instruction,
    coachingResult,
    updateStep,
  );

  return results;
}
