import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import {
  generateCacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,
  hasCachedAnalysis,
  getCacheEntryCount,
} from '../../../features/review/services/analysisCache';

const mockInstruction = { persona: 'test', keywords: ['a'], evaluationCriteria: { hardSkills: [], softSkills: [], preferredExperience: [] }, toneGuide: { style: '', endings: '', avoidPatterns: [] }, jdRequirements: [], detectedIndustry: 'it' as const } as any;
const mockResult = { matchScore: 85, summary: 'test', gapMap: [], actionItems: [], quickWins: [], optimizedResume: '', insights: [] } as any;

describe('analysisCache', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('generateCacheKey', () => {
    it('같은 입력에 같은 키 반환', () => {
      const key1 = generateCacheKey('resume', 'jd');
      const key2 = generateCacheKey('resume', 'jd');
      expect(key1).toBe(key2);
    });

    it('다른 입력에 다른 키 반환', () => {
      const key1 = generateCacheKey('resume A', 'jd A');
      const key2 = generateCacheKey('resume B', 'jd B');
      expect(key1).not.toBe(key2);
    });
  });

  describe('setCachedAnalysis + getCachedAnalysis', () => {
    it('저장 후 조회 가능', () => {
      setCachedAnalysis('resume', 'jd', mockInstruction, mockResult, null);
      const cached = getCachedAnalysis('resume', 'jd');
      expect(cached).not.toBeNull();
      expect(cached!.result.matchScore).toBe(85);
      expect(cached!.instruction.persona).toBe('test');
    });

    it('다른 입력은 miss', () => {
      setCachedAnalysis('resume', 'jd', mockInstruction, mockResult, null);
      expect(getCachedAnalysis('different', 'jd')).toBeNull();
    });

    it('companyContext 포함 저장/조회', () => {
      const ctx = { companyName: '채널톡', techStack: ['React'], culture: '', idealCandidate: '', recentNews: [], businessDirection: '', roleInsight: '', roleKeyTraits: [], confidence: 0.8, sources: [] } as any;
      setCachedAnalysis('resume', 'jd', mockInstruction, mockResult, ctx);
      const cached = getCachedAnalysis('resume', 'jd');
      expect(cached!.companyContext?.companyName).toBe('채널톡');
    });
  });

  describe('LRU eviction', () => {
    it('11번째 저장 시 가장 오래된 항목 제거', () => {
      for (let i = 0; i < 11; i++) {
        setCachedAnalysis(`resume-${i}`, `jd-${i}`, mockInstruction, mockResult, null);
      }
      expect(getCacheEntryCount()).toBe(10);
      // 첫 번째(resume-0)는 제거됨
      expect(getCachedAnalysis('resume-0', 'jd-0')).toBeNull();
      // 마지막(resume-10)은 있음
      expect(getCachedAnalysis('resume-10', 'jd-10')).not.toBeNull();
    });
  });

  describe('clearAnalysisCache', () => {
    it('모든 캐시 삭제', () => {
      setCachedAnalysis('resume', 'jd', mockInstruction, mockResult, null);
      clearAnalysisCache();
      expect(getCachedAnalysis('resume', 'jd')).toBeNull();
    });
  });

  describe('hasCachedAnalysis', () => {
    it('캐시 있으면 true', () => {
      setCachedAnalysis('resume', 'jd', mockInstruction, mockResult, null);
      expect(hasCachedAnalysis('resume', 'jd')).toBe(true);
    });

    it('캐시 없으면 false', () => {
      expect(hasCachedAnalysis('resume', 'jd')).toBe(false);
    });
  });
});
