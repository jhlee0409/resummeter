import { describe, it, expect } from 'vitest';
import { resumeExamples, getExamplesByIndustry, exampleIndustries } from '../../data/examples';

describe('resumeExamples', () => {
  it('9개 사례가 존재한다', () => {
    expect(resumeExamples).toHaveLength(9);
  });

  it('모든 사례에 필수 필드가 있다', () => {
    for (const e of resumeExamples) {
      expect(e.id).toBeTruthy();
      expect(e.industry).toBeTruthy();
      expect(e.position).toBeTruthy();
      expect(e.content.length).toBeGreaterThan(50);
      expect(e.analysis.strengths.length).toBeGreaterThan(0);
      expect(e.analysis.keywords.length).toBeGreaterThan(0);
      expect(e.analysis.pattern).toBeTruthy();
    }
  });

  it('ID가 중복되지 않는다', () => {
    const ids = resumeExamples.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getExamplesByIndustry', () => {
  it('IT 사례 3건', () => {
    expect(getExamplesByIndustry('IT')).toHaveLength(3);
  });

  it('금융 사례 2건', () => {
    expect(getExamplesByIndustry('금융')).toHaveLength(2);
  });

  it('제조 사례 2건', () => {
    expect(getExamplesByIndustry('제조')).toHaveLength(2);
  });

  it('공공 사례 2건', () => {
    expect(getExamplesByIndustry('공공')).toHaveLength(2);
  });

  it('존재하지 않는 업종은 빈 배열', () => {
    expect(getExamplesByIndustry('없는업종')).toHaveLength(0);
  });
});

describe('exampleIndustries', () => {
  it('4개 업종이 정의됨', () => {
    expect(exampleIndustries).toEqual(['IT', '금융', '제조', '공공']);
  });
});
