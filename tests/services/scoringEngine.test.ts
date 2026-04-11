import { describe, it, expect } from 'vitest';
import { calculateScore } from '../../services/scoringEngine';
import { parseJDRequirements, parseResumeExperience } from '../../services/requirementParser';
import type { GapMapItem, TailoredInstructionWithRequirements } from '../../types';

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
