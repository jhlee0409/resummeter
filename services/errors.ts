/**
 * Structured error classes for Gemini API calls.
 * User-facing messages in Korean, error codes for debugging.
 */

export type GeminiErrorCode =
  | 'PARSE_ERROR'
  | 'SCHEMA_MISMATCH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'EMPTY_RESPONSE'
  | 'API_ERROR'
  | 'UNKNOWN';

export class GeminiAPIError extends Error {
  constructor(
    public userMessage: string,
    public code: GeminiErrorCode,
    public retryable: boolean,
    public originalError?: unknown
  ) {
    super(userMessage);
    this.name = 'GeminiAPIError';
  }
}

/** Classify raw error into structured GeminiAPIError */
export function classifyError(error: unknown): GeminiAPIError {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
    return new GeminiAPIError(
      'API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
      'RATE_LIMIT',
      true,
      error
    );
  }

  if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('deadline')) {
    return new GeminiAPIError(
      '분석이 시간 초과되었습니다. 다시 시도해주세요.',
      'TIMEOUT',
      true,
      error
    );
  }

  if (error instanceof SyntaxError) {
    return new GeminiAPIError(
      'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.',
      'PARSE_ERROR',
      true,
      error
    );
  }

  return new GeminiAPIError(
    '분석에 실패했습니다. 다시 시도해주세요.',
    'UNKNOWN',
    true,
    error
  );
}
