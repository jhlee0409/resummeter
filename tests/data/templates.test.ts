import { describe, it, expect } from 'vitest';
import { resumeTemplates, getTemplatesByIndustry, getTemplatesByLevel, industries } from '../../data/templates';

describe('resumeTemplates', () => {
  it('8개 템플릿이 존재한다 (4업종 × 2레벨)', () => {
    expect(resumeTemplates).toHaveLength(8);
  });

  it('모든 템플릿에 필수 필드가 있다', () => {
    for (const t of resumeTemplates) {
      expect(t.id).toBeTruthy();
      expect(t.industry).toBeTruthy();
      expect(t.level).toMatch(/^(junior|senior)$/);
      expect(t.title).toBeTruthy();
      expect(t.template).toBeTruthy();
      expect(t.sections.length).toBeGreaterThan(0);
    }
  });

  it('ID가 중복되지 않는다', () => {
    const ids = resumeTemplates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getTemplatesByIndustry', () => {
  it('각 업종별로 2개씩 반환', () => {
    for (const ind of industries) {
      expect(getTemplatesByIndustry(ind)).toHaveLength(2);
    }
  });

  it('존재하지 않는 업종은 빈 배열', () => {
    expect(getTemplatesByIndustry('없는업종')).toHaveLength(0);
  });
});

describe('getTemplatesByLevel', () => {
  it('junior 4개, senior 4개', () => {
    expect(getTemplatesByLevel('junior')).toHaveLength(4);
    expect(getTemplatesByLevel('senior')).toHaveLength(4);
  });
});

describe('industries', () => {
  it('4개 업종이 정의됨', () => {
    expect(industries).toEqual(['IT', '금융', '제조', '공공']);
  });
});
