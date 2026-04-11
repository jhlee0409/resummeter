/**
 * Input validation + output Zod schemas for Gemini API calls.
 */

import { GeminiAPIError } from './errors';

// ─── Input Validation ───

export function validateResumeInput(resumeText: string): void {
  if (!resumeText?.trim()) {
    throw new GeminiAPIError('이력서를 입력해주세요.', 'INVALID_INPUT', false);
  }
  if (resumeText.length > 50000) {
    throw new GeminiAPIError('이력서는 50,000자 이내여야 합니다.', 'INVALID_INPUT', false);
  }
}

export function validateJDInput(jobDescription: string): void {
  if (!jobDescription?.trim()) {
    throw new GeminiAPIError('채용 공고를 입력해주세요.', 'INVALID_INPUT', false);
  }
  if (jobDescription.length < 30) {
    throw new GeminiAPIError('채용 공고가 너무 짧습니다. 자격요건과 직무 설명을 포함해주세요.', 'INVALID_INPUT', false);
  }
}

// ─── Output Parsing ───

export function safeParseJSON<T>(jsonText: string | undefined, context: string): T {
  if (!jsonText?.trim()) {
    throw new GeminiAPIError(
      `${context} 결과가 비어있습니다. 다시 시도해주세요.`,
      'EMPTY_RESPONSE',
      true
    );
  }
  try {
    return JSON.parse(jsonText) as T;
  } catch (e) {
    console.error(`[${context}] JSON parse failed:`, jsonText?.slice(0, 200));
    throw new GeminiAPIError(
      'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.',
      'PARSE_ERROR',
      true,
      e
    );
  }
}

// ─── Output Validation (Zod) ───

import { z } from 'zod';

const GapMapItemSchema = z.object({
  requirement: z.string(),
  category: z.string(),
  currentLevel: z.enum(['strong', 'weak', 'missing']),
  jdMentions: z.number().min(0),
  resumeMentions: z.number().min(0),
  suggestion: z.string(),
});

const ActionItemSchema = z.object({
  id: z.string(),
  targetSection: z.string(),
  before: z.string(),
  suggestion: z.string(),
  after: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string(),
});

export const AnalysisOutputSchema = z.object({
  summary: z.string().min(1),
  gapMap: z.array(GapMapItemSchema).min(1),
  analysisItems: z.array(z.object({
    id: z.string(),
    before: z.string(),
    issue: z.string(),
    direction: z.string(),
    priority: z.string(),
    category: z.string(),
  })),
  quickWins: z.array(z.string()),
});

export const CoachingOutputSchema = z.object({
  optimizedResume: z.string().min(10),
  summary: z.string().min(1),
  gapMap: z.array(GapMapItemSchema).min(1),
  actionItems: z.array(ActionItemSchema),
  quickWins: z.array(z.string()),
  insights: z.array(z.object({
    category: z.string(),
    observation: z.string(),
    impact: z.string(),
  })),
});

/**
 * Zod 스키마로 LLM 출력을 검증합니다.
 * 실패 시 warning 로그 + 원본 반환 (서비스 중단 방지).
 */
export function validateOutput<T>(data: T, schema: z.ZodSchema, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[${context}] Zod 검증 실패:`, result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
  }
  return data; // 검증 실패해도 원본 반환 (graceful degradation)
}
