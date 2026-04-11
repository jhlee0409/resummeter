/**
 * Zustand 전역 상태 — on-demand 기능 결과 영속화.
 * 탭 전환 시 unmount돼도 결과/loading/error 유지.
 */

import { create } from 'zustand';
import type {
  CareerStatementResult,
  CoverLetterResult,
  CoverLetterConfig,
  InterviewQuestion,
  InterviewFeedback,
  LearningRoadmap,
  LinkedInOptimization,
  AboutStatementResult,
  GapAnalysisResult,
  TailoredInstructionWithRequirements,
  GitHubFetchResult,
  CoachingResult,
  CompanyContext,
  GapMapItem,
} from '../types';
import type { PractitionerReview } from '../services/practitionerService';

import { generateCareerStatements, generateCoverLetter, refineAboutStatement } from '../services/careerDocService';
import { generateInterviewQuestions, evaluateAnswer } from '../services/interviewService';
import { analyzeLearningRoadmap, generateLinkedInOptimization } from '../services/skillGapService';
import { analyzeGap } from '../services/gapAnalysisService';
import { generatePractitionerReview } from '../services/practitionerService';

// ─── Slice 타입 ───

interface FeatureSlice<T> {
  result: T | null;
  loading: boolean;
  error: string | null;
}

interface InterviewSlice extends FeatureSlice<InterviewQuestion[]> {
  answers: Record<string, string>;
  feedbacks: Record<string, InterviewFeedback>;
}

// ─── Store 타입 ───

interface FeatureState {
  careerStatement: FeatureSlice<CareerStatementResult>;
  coverLetter: FeatureSlice<CoverLetterResult>;
  interview: InterviewSlice;
  skillGap: FeatureSlice<LearningRoadmap>;
  linkedIn: FeatureSlice<LinkedInOptimization>;
  aboutStatement: FeatureSlice<AboutStatementResult>;
  gapAnalysis: FeatureSlice<GapAnalysisResult>;
  practitioner: FeatureSlice<PractitionerReview>;

  // Generate actions
  generateCareerStatement: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, githubData?: GitHubFetchResult[], companyContext?: CompanyContext | null) => Promise<void>;
  generateCoverLetter: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, config: CoverLetterConfig, coachingResult?: CoachingResult, companyContext?: CompanyContext | null) => Promise<void>;
  generateInterviewQuestions: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, companyContext?: CompanyContext | null) => Promise<void>;
  submitInterviewAnswer: (question: InterviewQuestion, answer: string, resumeText: string, jd: string) => Promise<InterviewFeedback>;
  generateSkillGap: (gapMap: GapMapItem[], jd: string, instruction: TailoredInstructionWithRequirements, companyContext?: CompanyContext | null) => Promise<void>;
  generateLinkedIn: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, companyContext?: CompanyContext | null) => Promise<void>;
  generateAboutStatement: (input: string, resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, coachingResult?: CoachingResult, companyContext?: CompanyContext | null) => Promise<void>;
  generateGapAnalysis: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements, companyContext?: CompanyContext | null) => Promise<void>;
  generatePractitioner: (resumeText: string, jd: string, instruction: TailoredInstructionWithRequirements) => Promise<void>;

  // Direct setters (PipelinePanel용)
  setCareerStatementResult: (result: CareerStatementResult) => void;
  setCoverLetterResult: (result: CoverLetterResult) => void;
  setInterviewQuestions: (result: InterviewQuestion[]) => void;
  setLinkedInResult: (result: LinkedInOptimization) => void;
  setPractitionerResult: (result: PractitionerReview) => void;
  setAboutStatementResult: (result: AboutStatementResult) => void;

  resetAll: () => void;
}

// ─── 초기값 ───

const initialSlice = <T>(): FeatureSlice<T> => ({ result: null, loading: false, error: null });
const initialInterview: InterviewSlice = { result: null, loading: false, error: null, answers: {}, feedbacks: {} };

// ─── Store ───

export const useFeatureStore = create<FeatureState>((set) => ({
  careerStatement: initialSlice(),
  coverLetter: initialSlice(),
  interview: initialInterview,
  skillGap: initialSlice(),
  linkedIn: initialSlice(),
  aboutStatement: initialSlice(),
  gapAnalysis: initialSlice(),
  practitioner: initialSlice(),

  // ── Generate actions ──

  generateCareerStatement: async (resumeText, jd, instruction, githubData, companyContext) => {
    set(s => ({ careerStatement: { ...s.careerStatement, loading: true, error: null } }));
    try {
      const result = await generateCareerStatements(resumeText, jd, instruction, githubData, companyContext);
      set({ careerStatement: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ careerStatement: { ...s.careerStatement, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generateCoverLetter: async (resumeText, jd, instruction, config, coachingResult, companyContext) => {
    set(s => ({ coverLetter: { ...s.coverLetter, loading: true, error: null } }));
    try {
      const result = await generateCoverLetter(resumeText, jd, instruction, config, coachingResult, companyContext);
      set({ coverLetter: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ coverLetter: { ...s.coverLetter, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generateInterviewQuestions: async (resumeText, jd, instruction, companyContext) => {
    set(s => ({ interview: { ...s.interview, loading: true, error: null } }));
    try {
      const result = await generateInterviewQuestions(resumeText, jd, instruction, companyContext);
      set(s => ({ interview: { ...s.interview, result, loading: false, error: null } }));
    } catch (e: unknown) {
      set(s => ({ interview: { ...s.interview, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  submitInterviewAnswer: async (question, answer, resumeText, jd) => {
    const feedback = await evaluateAnswer(question, answer, resumeText, jd);
    set(s => ({
      interview: {
        ...s.interview,
        answers: { ...s.interview.answers, [question.id]: answer },
        feedbacks: { ...s.interview.feedbacks, [question.id]: feedback },
      },
    }));
    return feedback;
  },

  generateSkillGap: async (gapMap, jd, instruction, companyContext) => {
    set(s => ({ skillGap: { ...s.skillGap, loading: true, error: null } }));
    try {
      const result = await analyzeLearningRoadmap(gapMap, jd, instruction, companyContext);
      set({ skillGap: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ skillGap: { ...s.skillGap, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generateLinkedIn: async (resumeText, jd, instruction, companyContext) => {
    set(s => ({ linkedIn: { ...s.linkedIn, loading: true, error: null } }));
    try {
      const result = await generateLinkedInOptimization(resumeText, jd, instruction, companyContext);
      set({ linkedIn: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ linkedIn: { ...s.linkedIn, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generateAboutStatement: async (input, resumeText, jd, instruction, coachingResult, companyContext) => {
    set(s => ({ aboutStatement: { ...s.aboutStatement, loading: true, error: null } }));
    try {
      const result = await refineAboutStatement(input, resumeText, jd, instruction, coachingResult, companyContext);
      set({ aboutStatement: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ aboutStatement: { ...s.aboutStatement, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generateGapAnalysis: async (resumeText, jd, instruction, companyContext) => {
    set(s => ({ gapAnalysis: { ...s.gapAnalysis, loading: true, error: null } }));
    try {
      const result = await analyzeGap(resumeText, jd, instruction, companyContext);
      set({ gapAnalysis: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ gapAnalysis: { ...s.gapAnalysis, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  generatePractitioner: async (resumeText, jd, instruction) => {
    set(s => ({ practitioner: { ...s.practitioner, loading: true, error: null } }));
    try {
      const result = await generatePractitionerReview(resumeText, jd, instruction);
      set({ practitioner: { result, loading: false, error: null } });
    } catch (e: unknown) {
      set(s => ({ practitioner: { ...s.practitioner, loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  },

  // ── Direct setters (PipelinePanel) ──

  setCareerStatementResult: (result) => set({ careerStatement: { result, loading: false, error: null } }),
  setCoverLetterResult: (result) => set({ coverLetter: { result, loading: false, error: null } }),
  setInterviewQuestions: (result) => set(s => ({ interview: { ...s.interview, result, loading: false, error: null } })),
  setLinkedInResult: (result) => set({ linkedIn: { result, loading: false, error: null } }),
  setPractitionerResult: (result) => set({ practitioner: { result, loading: false, error: null } }),
  setAboutStatementResult: (result) => set({ aboutStatement: { result, loading: false, error: null } }),

  resetAll: () => set({
    careerStatement: initialSlice(),
    coverLetter: initialSlice(),
    interview: initialInterview,
    skillGap: initialSlice(),
    linkedIn: initialSlice(),
    aboutStatement: initialSlice(),
    gapAnalysis: initialSlice(),
    practitioner: initialSlice(),
  }),
}));
