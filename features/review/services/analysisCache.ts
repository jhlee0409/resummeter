/**
 * 분석 결과 localStorage 캐싱.
 * LRU 10건, 이력서+JD 조합별 저장.
 */

import type { CoachingResult, TailoredInstructionWithRequirements, CompanyContext } from '../../../types';

const STORAGE_KEY = 'resummeter_analysis_cache';
// v2: 원문 resumeText/jobDescription을 저장하도록 스키마 확장.
// getAllEntries가 version 불일치 항목을 버리므로 텍스트 없는 v1 항목은 자동 폐기된다.
const CACHE_VERSION = 2;
const MAX_ENTRIES = 10;

interface CachedAnalysis {
  version: number;
  cacheKey: string;
  instruction: TailoredInstructionWithRequirements;
  result: CoachingResult;
  companyContext: CompanyContext | null;
  createdAt: string;
  resumeText: string;
  jobDescription: string;
  resumeLength: number;
  jdLength: number;
}

/** 캐시에서 복원되는 분석 결과 (원문 텍스트 포함) */
export interface RestoredAnalysis {
  instruction: TailoredInstructionWithRequirements;
  result: CoachingResult;
  companyContext: CompanyContext | null;
  resumeText: string;
  jobDescription: string;
}

export function generateCacheKey(resume: string, jd: string): string {
  return `${resume.length}:${jd.length}:${simpleHash(resume)}:${simpleHash(jd)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  const sample = str.slice(0, 500) + str.slice(-500);
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getAllEntries(): CachedAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: CachedAnalysis[] = JSON.parse(raw);
    return entries.filter(e => e.version === CACHE_VERSION);
  } catch {
    return [];
  }
}

function saveAllEntries(entries: CachedAnalysis[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full — clear oldest and retry
    const trimmed = entries.slice(-Math.floor(MAX_ENTRIES / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // still full — give up silently
    }
  }
}

export function getCachedAnalysis(
  resume: string,
  jd: string,
): RestoredAnalysis | null {
  const key = generateCacheKey(resume, jd);
  const entries = getAllEntries();
  const match = entries.find(
    e => e.cacheKey === key && e.resumeLength === resume.length && e.jdLength === jd.length
  );

  if (!match) return null;

  // LRU: move to end (most recently accessed)
  const updated = entries.filter(e => e.cacheKey !== key);
  updated.push({ ...match, createdAt: new Date().toISOString() });
  saveAllEntries(updated);

  return toRestored(match);
}

export function setCachedAnalysis(
  resume: string,
  jd: string,
  instruction: TailoredInstructionWithRequirements,
  result: CoachingResult,
  companyContext: CompanyContext | null,
) {
  const key = generateCacheKey(resume, jd);
  const entries = getAllEntries().filter(e => e.cacheKey !== key);

  entries.push({
    version: CACHE_VERSION,
    cacheKey: key,
    instruction,
    result,
    companyContext,
    createdAt: new Date().toISOString(),
    resumeText: resume,
    jobDescription: jd,
    resumeLength: resume.length,
    jdLength: jd.length,
  });

  // LRU eviction
  while (entries.length > MAX_ENTRIES) {
    entries.shift();
  }

  saveAllEntries(entries);
}

export function clearAnalysisCache() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCacheEntryCount(): number {
  return getAllEntries().length;
}

export function hasCachedAnalysis(resume: string, jd: string): boolean {
  const key = generateCacheKey(resume, jd);
  const entries = getAllEntries();
  return entries.some(e => e.cacheKey === key && e.resumeLength === resume.length && e.jdLength === jd.length);
}

export interface CachedAnalysisListItem {
  cacheKey: string;
  companyName: string | null;
  matchScore: number;
  createdAt: string;
  resumeLength: number;
  jdLength: number;
}

/** 모든 캐시 목록 (최신순) */
export function listCachedAnalyses(): CachedAnalysisListItem[] {
  return getAllEntries()
    .slice()
    .reverse()
    .map(e => ({
      cacheKey: e.cacheKey,
      companyName: e.companyContext?.companyName ?? null,
      matchScore: e.result.matchScore,
      createdAt: e.createdAt,
      resumeLength: e.resumeLength,
      jdLength: e.jdLength,
    }));
}

/** 캐시 키로 직접 로드 (이력서/JD 텍스트까지 복원) */
export function getCachedAnalysisByKey(cacheKey: string): RestoredAnalysis | null {
  const entries = getAllEntries();
  const match = entries.find(e => e.cacheKey === cacheKey);
  if (!match) return null;
  const updated = entries.filter(e => e.cacheKey !== cacheKey);
  updated.push({ ...match, createdAt: new Date().toISOString() });
  saveAllEntries(updated);
  return toRestored(match);
}

function toRestored(match: CachedAnalysis): RestoredAnalysis {
  return {
    instruction: match.instruction,
    result: match.result,
    companyContext: match.companyContext,
    resumeText: match.resumeText,
    jobDescription: match.jobDescription,
  };
}

/** 특정 캐시 삭제 */
export function deleteCachedAnalysis(cacheKey: string): void {
  const entries = getAllEntries().filter(e => e.cacheKey !== cacheKey);
  saveAllEntries(entries);
}
