import { describe, it, expect } from 'vitest';
import { validateResumeInput, validateJDInput, safeParseJSON } from '../../../shared/lib/validation';
import { GeminiAPIError } from '../../../shared/lib/errors';

describe('validateResumeInput', () => {
  it('빈 문자열이면 INVALID_INPUT 에러', () => {
    expect(() => validateResumeInput('')).toThrow(GeminiAPIError);
    expect(() => validateResumeInput('')).toThrow('이력서를 입력해주세요');
  });

  it('공백만 있어도 에러', () => {
    expect(() => validateResumeInput('   ')).toThrow(GeminiAPIError);
  });

  it('50,000자 초과하면 에러', () => {
    expect(() => validateResumeInput('a'.repeat(50001))).toThrow('50,000자');
  });

  it('50,000자 이내는 통과', () => {
    expect(() => validateResumeInput('정상 이력서')).not.toThrow();
  });

  it('경계값: 정확히 50,000자 통과', () => {
    expect(() => validateResumeInput('a'.repeat(50000))).not.toThrow();
  });

  it('에러 코드는 INVALID_INPUT, retryable은 false', () => {
    try { validateResumeInput(''); } catch (e) {
      expect(e).toBeInstanceOf(GeminiAPIError);
      expect((e as GeminiAPIError).code).toBe('INVALID_INPUT');
      expect((e as GeminiAPIError).retryable).toBe(false);
    }
  });
});

describe('validateJDInput', () => {
  it('빈 문자열이면 에러', () => {
    expect(() => validateJDInput('')).toThrow('채용 공고를 입력해주세요');
  });

  it('30자 미만이면 에러', () => {
    expect(() => validateJDInput('짧은 공고')).toThrow('너무 짧습니다');
  });

  it('30자 이상이면 통과', () => {
    const jd = '프론트엔드 개발자를 모집합니다. React, TypeScript 경험 필수. 우대사항 있음.';
    expect(() => validateJDInput(jd)).not.toThrow();
  });

  it('경계값: 정확히 30자 통과', () => {
    expect(() => validateJDInput('a'.repeat(30))).not.toThrow();
  });

  it('경계값: 29자는 실패', () => {
    expect(() => validateJDInput('a'.repeat(29))).toThrow();
  });
});

describe('safeParseJSON', () => {
  it('유효한 JSON 파싱', () => {
    expect(safeParseJSON<{ name: string }>('{"name":"test"}', 'ctx')).toEqual({ name: 'test' });
  });

  it('배열 JSON 파싱', () => {
    expect(safeParseJSON<number[]>('[1,2,3]', 'ctx')).toEqual([1, 2, 3]);
  });

  it('빈 문자열이면 EMPTY_RESPONSE (retryable)', () => {
    try { safeParseJSON('', 'ATS분석'); } catch (e) {
      expect(e).toBeInstanceOf(GeminiAPIError);
      expect((e as GeminiAPIError).code).toBe('EMPTY_RESPONSE');
      expect((e as GeminiAPIError).retryable).toBe(true);
    }
  });

  it('undefined이면 EMPTY_RESPONSE', () => {
    expect(() => safeParseJSON(undefined, 'ctx')).toThrow(GeminiAPIError);
  });

  it('잘못된 JSON이면 PARSE_ERROR (retryable)', () => {
    try { safeParseJSON('{invalid', 'ctx'); } catch (e) {
      expect(e).toBeInstanceOf(GeminiAPIError);
      expect((e as GeminiAPIError).code).toBe('PARSE_ERROR');
      expect((e as GeminiAPIError).retryable).toBe(true);
    }
  });

  it('에러 메시지에 context 포함', () => {
    expect(() => safeParseJSON('', 'ATS분석')).toThrow('ATS분석');
  });
});
