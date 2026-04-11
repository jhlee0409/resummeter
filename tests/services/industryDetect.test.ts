import { describe, it, expect } from 'vitest';
import { detectIndustry, buildIndustryContext, INDUSTRY_PROFILES } from '../../services/industryDetect';

describe('detectIndustry', () => {
  it('IT 키워드가 3개 이상이면 it 반환', () => {
    expect(detectIndustry('React TypeScript 프론트엔드 개발자 모집')).toBe('it');
  });

  it('금융 키워드가 3개 이상이면 finance 반환', () => {
    expect(detectIndustry('은행 금융 리스크관리 자산운용 담당자 모집')).toBe('finance');
  });

  it('제조 키워드가 3개 이상이면 manufacturing 반환', () => {
    expect(detectIndustry('제조 생산 품질관리 공정 엔지니어 모집')).toBe('manufacturing');
  });

  it('공공 키워드가 3개 이상이면 public 반환', () => {
    expect(detectIndustry('공기업 NCS 블라인드채용 직업기초능력 행정직')).toBe('public');
  });

  it('키워드 3개 미만이면 general 반환', () => {
    expect(detectIndustry('마케팅 담당자를 모집합니다')).toBe('general');
  });

  it('빈 문자열이면 general 반환', () => {
    expect(detectIndustry('')).toBe('general');
  });

  it('IT+금융 혼합일 때 더 많이 매칭되는 쪽', () => {
    const jd = 'React 프론트엔드 개발자, TypeScript 필수, API 개발, 금융 서비스';
    // IT 키워드가 더 많으므로 it
    expect(detectIndustry(jd)).toBe('it');
  });

  it('대소문자 구분 없이 매칭', () => {
    expect(detectIndustry('react typescript PYTHON aws docker kubernetes CI/CD')).toBe('it');
  });

  it('같은 키워드 중복 등장하면 카운트 증가', () => {
    // "개발" 3번 → 3개 이상이므로 it
    expect(detectIndustry('개발 업무, 개발 환경, 개발 문화')).toBe('it');
  });
});

describe('buildIndustryContext', () => {
  it('general이면 빈 문자열 반환', () => {
    expect(buildIndustryContext('general')).toBe('');
  });

  it('it이면 업종 컨텍스트 포함', () => {
    const ctx = buildIndustryContext('it');
    expect(ctx).toContain('IT/개발');
    expect(ctx).toContain('기술 역량');
    expect(ctx).toContain('40%');
  });

  it('finance이면 금융 관점 포함', () => {
    const ctx = buildIndustryContext('finance');
    expect(ctx).toContain('금융/은행');
    expect(ctx).toContain('리스크');
  });

  it('public이면 NCS 관련 내용 포함', () => {
    const ctx = buildIndustryContext('public');
    expect(ctx).toContain('NCS');
    expect(ctx).toContain('블라인드');
  });
});

describe('INDUSTRY_PROFILES', () => {
  it('5개 업종 프로필이 존재한다', () => {
    expect(Object.keys(INDUSTRY_PROFILES)).toHaveLength(5);
  });

  it('모든 프로필의 가중치 합이 100이다', () => {
    for (const [, profile] of Object.entries(INDUSTRY_PROFILES)) {
      const sum = Object.values(profile.evaluationWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
});
