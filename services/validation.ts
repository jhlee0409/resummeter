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
