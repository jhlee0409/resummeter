import { describe, it, expect } from 'vitest';
import { GeminiAPIError, classifyError } from '../../services/errors';

describe('GeminiAPIError', () => {
  it('Error를 상속한다', () => {
    const err = new GeminiAPIError('msg', 'UNKNOWN', true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GeminiAPIError);
    expect(err.name).toBe('GeminiAPIError');
  });

  it('필드를 올바르게 저장한다', () => {
    const original = new Error('원본');
    const err = new GeminiAPIError('유저 메시지', 'RATE_LIMIT', true, original);
    expect(err.userMessage).toBe('유저 메시지');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.retryable).toBe(true);
    expect(err.originalError).toBe(original);
  });
});

describe('classifyError', () => {
  it('429 에러 → RATE_LIMIT', () => {
    const err = classifyError(new Error('HTTP 429 Too Many Requests'));
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toContain('요청 한도');
  });

  it('rate limit 문자열 → RATE_LIMIT', () => {
    const err = classifyError(new Error('rate limit exceeded'));
    expect(err.code).toBe('RATE_LIMIT');
  });

  it('timeout 에러 → TIMEOUT', () => {
    const err = classifyError(new Error('Request timeout'));
    expect(err.code).toBe('TIMEOUT');
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toContain('시간 초과');
  });

  it('deadline 에러 → TIMEOUT', () => {
    const err = classifyError(new Error('Deadline exceeded'));
    expect(err.code).toBe('TIMEOUT');
  });

  it('SyntaxError → PARSE_ERROR', () => {
    const err = classifyError(new SyntaxError('Unexpected token'));
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('알 수 없는 에러 → UNKNOWN', () => {
    const err = classifyError(new Error('something weird'));
    expect(err.code).toBe('UNKNOWN');
    expect(err.retryable).toBe(true);
  });

  it('원본 에러를 보존한다', () => {
    const original = new Error('original');
    const classified = classifyError(original);
    expect(classified.originalError).toBe(original);
  });

  it('문자열도 처리한다', () => {
    const err = classifyError('plain string error');
    expect(err.code).toBe('UNKNOWN');
  });
});
