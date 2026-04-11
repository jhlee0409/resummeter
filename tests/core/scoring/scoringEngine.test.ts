import { describe, it, expect } from 'vitest';
import { calculateScore } from '../../../core/scoring/scoringEngine';
import { parseJDRequirements, parseResumeExperience } from '../../../core/scoring/requirementParser';
import type { GapMapItem, TailoredInstructionWithRequirements } from '../../../types';

const mockInstruction = {
  persona: 'test',
  keywords: ['React', 'TypeScript', 'AI', 'Map', '관제', '실시간'],
  evaluationCriteria: { hardSkills: ['React', 'TypeScript'], softSkills: ['커뮤니케이션'], preferredExperience: [] },
  toneGuide: { style: '', endings: '', avoidPatterns: [] },
  jdRequirements: [],
  detectedIndustry: 'it' as const,
} as TailoredInstructionWithRequirements;

const makeGapMap = (items: Array<{ cat: string; level: string }>): GapMapItem[] =>
  items.map((item, i) => ({
    requirement: `req-${i}`,
    category: item.cat as any,
    currentLevel: item.level as any,
    jdMentions: 1,
    resumeMentions: item.level === 'strong' ? 1 : 0,
    relatedActions: [],
    suggestion: '',
  }));

describe('parseJDRequirements', () => {
  it('"8년 이상" 파싱', () => {
    expect(parseJDRequirements('8년 이상의 Frontend 경력').minExperience).toBe(8);
  });

  it('"3년 이상" 파싱', () => {
    expect(parseJDRequirements('최소 3년 이상의 프론트엔드').minExperience).toBe(3);
  });

  it('"경력 무관"이면 null', () => {
    expect(parseJDRequirements('경력 무관, React 필수').minExperience).toBeNull();
  });

  it('학력 추출', () => {
    expect(parseJDRequirements('학사 이상의 학위').education).toContain('학사');
  });

  it('요건 없으면 null', () => {
    const r = parseJDRequirements('프론트엔드 개발자 모집');
    expect(r.minExperience).toBeNull();
    expect(r.education).toBeNull();
  });
});

describe('parseResumeExperience', () => {
  it('한국어 날짜 파싱', () => {
    const r = parseResumeExperience('버즈니 | Apr. 2024 - 현재\n요쿠스 | May. 2023 - Feb. 2024\n헥스콘 | Dec. 2020 - Apr. 2023');
    expect(r.totalExperience).toBeGreaterThan(4);
    expect(r.companies.length).toBe(3);
  });

  it('프로젝트 라인 [이름] 패턴은 스킵', () => {
    const resume = `버즈니 | 프론트엔드 엔지니어 | Apr. 2024 - 현재
[아임셀러] - AI 상품 분석 / 2026.02 - now
[Viskits] - AI 숏폼 편집 / 2024.04 - now
요쿠스 | 프론트엔드 엔지니어 | May. 2023 - Feb. 2024
헥스콘 | 프론트엔드 엔지니어 | Dec. 2020 - Apr. 2023`;
    const r = parseResumeExperience(resume);
    expect(r.companies.length).toBe(3);
    expect(r.totalExperience).toBeGreaterThan(4);
    expect(r.totalExperience).toBeLessThan(6); // 5.1년이어야 함, 7.3년 안 됨
  });

  it('겹치는 기간은 merge', () => {
    // 두 회사 기간이 겹침: 2023.01-2024.01 + 2023.06-2024.06 → 2023.01-2024.06 = 18개월
    const resume = `A회사 | 2023.01 - 2024.01\nB회사 | 2023.06 - 2024.06`;
    const r = parseResumeExperience(resume);
    expect(r.totalExperience).toBeLessThanOrEqual(1.5); // 18개월 = 1.5년
    expect(r.companies.length).toBe(1); // merged into one period
  });

  it('파싱 실패 시 null', () => {
    const r = parseResumeExperience('경력 없음');
    expect(r.totalExperience).toBeNull();
  });
});

describe('calculateScore', () => {
  it('gapMap 3개 미만이면 data_insufficient', () => {
    const result = calculateScore(makeGapMap([{ cat: 'hard-skill', level: 'strong' }]), mockInstruction, '', '');
    expect(result.level).toBe('data_insufficient');
  });

  it('경력 미달 시 큰 감점', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'experience', level: 'weak' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    const result = calculateScore(gapMap, mockInstruction,
      '버즈니 | Apr. 2024 - 현재\n요쿠스 | May. 2023 - Feb. 2024',
      '8년 이상의 Frontend 경력');
    expect(result.matchScore).toBeLessThan(70);
    expect(result.penalties.some(p => p.category === '경력')).toBe(true);
  });

  it('도메인 키워드 50% 이상 미매칭 시 감점', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'experience', level: 'strong' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    // 이력서에 React, TypeScript만 있고 Map, 관제, 실시간, AI 없음
    const result = calculateScore(gapMap, mockInstruction,
      'React TypeScript 개발자',
      '프론트엔드 개발자');
    expect(result.penalties.some(p => p.category === '도메인 키워드')).toBe(true);
  });

  it('keywordAliases로 시맨틱 매칭 — alias 매칭 시 감점 없음', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'experience', level: 'strong' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    const instrWithAliases = {
      ...mockInstruction,
      keywords: ['Fabric.js', 'Next.js', 'TypeScript'],
      keywordAliases: [
        { keyword: 'Fabric.js', aliases: ['Canvas', 'HTML5 Canvas', '캔버스'] },
        { keyword: 'Next.js', aliases: ['React', 'SSR'] },
      ],
    };
    // 이력서에 "Canvas"와 "React"가 있으면 Fabric.js, Next.js alias 매칭
    const result = calculateScore(gapMap, instrWithAliases,
      'Canvas 기반 에디터 개발, React 프레임워크 경험, TypeScript 사용',
      '프론트엔드 개발자');
    expect(result.penalties.some(p => p.category === '도메인 키워드')).toBe(false);
  });

  it('keywordAliases 없으면 exact match만', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'experience', level: 'strong' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    const instrNoAliases = {
      ...mockInstruction,
      keywords: ['Fabric.js', 'Next.js', 'TypeScript', 'GraphQL', 'Docker', 'K8s'],
    };
    // alias 없이 Fabric.js, Next.js, GraphQL, Docker, K8s 미매칭 = 5/6 > 50%
    const result = calculateScore(gapMap, instrNoAliases,
      'TypeScript 개발자',
      '프론트엔드 개발자');
    expect(result.penalties.some(p => p.category === '도메인 키워드')).toBe(true);
    expect(result.breakdown.domain).toBe(15);
  });

  it('preferred 항목은 감점 가중치 감소', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'missing' },
      { cat: 'hard-skill', level: 'missing' },
      { cat: 'experience', level: 'strong' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    // 모든 hard-skill이 required인 경우
    const instrRequired = {
      ...mockInstruction,
      keywords: [],
      jdRequirements: [
        { text: 'React 필수', category: 'hard-skill' as const, importance: 'required' as const, keywords: ['React'] },
        { text: 'TS 필수', category: 'hard-skill' as const, importance: 'required' as const, keywords: ['TS'] },
      ],
    };
    const resultRequired = calculateScore(gapMap, instrRequired, '경력 3년', '프론트엔드 개발자');

    // 모든 hard-skill이 preferred인 경우
    const instrPreferred = {
      ...mockInstruction,
      keywords: [],
      jdRequirements: [
        { text: 'React 우대', category: 'hard-skill' as const, importance: 'preferred' as const, keywords: ['React'] },
        { text: 'TS 우대', category: 'hard-skill' as const, importance: 'preferred' as const, keywords: ['TS'] },
      ],
    };
    const resultPreferred = calculateScore(gapMap, instrPreferred, '경력 3년', '프론트엔드 개발자');

    // preferred일 때 감점이 더 적어야 함
    expect(resultPreferred.breakdown.hardSkill).toBeLessThan(resultRequired.breakdown.hardSkill);
  });

  it('모든 항목 strong이면 높은 점수', () => {
    const gapMap = makeGapMap([
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'hard-skill', level: 'strong' },
      { cat: 'experience', level: 'strong' },
      { cat: 'soft-skill', level: 'strong' },
    ]);
    const instrNoKeywords = { ...mockInstruction, keywords: ['React', 'TypeScript'] };
    const result = calculateScore(gapMap, instrNoKeywords,
      'React TypeScript 개발자',
      '프론트엔드 개발자');
    expect(result.matchScore).toBeGreaterThanOrEqual(90);
    expect(result.level).toBe('strong_match');
  });
});
