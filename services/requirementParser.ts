/**
 * JD/이력서에서 hard requirement를 정규식으로 추출.
 * LLM이 이미 추출하지 않는 것만 처리: 경력 년수, 학력.
 */

import type { ParsedRequirements, ParsedResume } from '../types';

// ─── JD 파싱 ───

const EXP_PATTERNS = [
  /(\d+)\s*년\s*이상/,
  /(\d+)\s*년\s*~\s*\d+\s*년/,
  /(\d+)\+?\s*years?/i,
  /경력\s*(\d+)\s*년/,
  /(\d+)\s*년\s*경력/,
];

const EDU_PATTERNS = [
  /(학사|석사|박사|대학|대졸)\s*(이상)?/,
  /(bachelor|master|phd|university)/i,
  /컴퓨터\s*(공학|과학)/,
];

export function parseJDRequirements(jdText: string): ParsedRequirements {
  let minExperience: number | null = null;
  let education: string | null = null;

  for (const pattern of EXP_PATTERNS) {
    const match = jdText.match(pattern);
    if (match) {
      minExperience = parseInt(match[1], 10);
      break;
    }
  }

  // "경력 무관", "경력무관" 체크
  if (/경력\s*무관/.test(jdText)) {
    minExperience = null;
  }

  for (const pattern of EDU_PATTERNS) {
    const match = jdText.match(pattern);
    if (match) {
      education = match[0];
      break;
    }
  }

  return { minExperience, education };
}

// ─── 이력서 경력 파싱 ───

const DATE_PATTERNS = [
  // 2024.04 ~ 현재, 2020.12 - 2023.04
  /(\d{4})\s*[./-]\s*(\d{1,2})\s*[-~]\s*(현재|present|now|\d{4}\s*[./-]\s*\d{1,2})/gi,
  // Apr. 2024 - 현재, Dec. 2020 - Apr. 2023
  /([A-Za-z]+)\s*\.?\s*(\d{4})\s*[-~]\s*(현재|present|now|[A-Za-z]+\s*\.?\s*\d{4})/gi,
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonth(str: string): number {
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;
  const key = str.toLowerCase().slice(0, 3);
  return MONTH_MAP[key] || 1;
}

function parseYearMonth(str: string): { year: number; month: number } | null {
  // "현재", "present", "now"
  if (/현재|present|now/i.test(str)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  // "2024.04" or "2024-04" or "2024/04"
  const numMatch = str.match(/(\d{4})\s*[./-]\s*(\d{1,2})/);
  if (numMatch) {
    return { year: parseInt(numMatch[1], 10), month: parseInt(numMatch[2], 10) };
  }

  // "Apr. 2024" or "Apr 2024"
  const engMatch = str.match(/([A-Za-z]+)\s*\.?\s*(\d{4})/);
  if (engMatch) {
    return { year: parseInt(engMatch[2], 10), month: parseMonth(engMatch[1]) };
  }

  return null;
}

export function parseResumeExperience(resumeText: string): ParsedResume {
  const periods: { name: string; months: number; startEpoch: number; endEpoch: number }[] = [];

  const lines = resumeText.split('\n');
  for (const line of lines) {
    // 프로젝트 라인 스킵: [프로젝트명] 패턴
    if (/^\s*\[/.test(line)) continue;

    for (const pattern of DATE_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        const fullMatch = match[0];
        const parts = fullMatch.split(/[-~]/);
        if (parts.length >= 2) {
          const start = parseYearMonth(parts[0].trim());
          const end = parseYearMonth(parts[1].trim());
          if (start && end) {
            const months = (end.year - start.year) * 12 + (end.month - start.month);
            if (months > 0 && months < 360) {
              const startEpoch = new Date(start.year, start.month - 1).getTime();
              const endEpoch = new Date(end.year, end.month - 1).getTime();
              periods.push({
                name: line.trim().slice(0, 50),
                months,
                startEpoch,
                endEpoch,
              });
            }
          }
        }
        break;
      }
    }
  }

  if (periods.length === 0) {
    return { totalExperience: null, companies: [] };
  }

  // 겹치는 기간 merge (overlap 제거)
  periods.sort((a, b) => a.startEpoch - b.startEpoch);
  const merged: typeof periods = [];
  for (const p of periods) {
    const last = merged[merged.length - 1];
    if (last && p.startEpoch <= last.endEpoch) {
      // overlap → extend end
      last.endEpoch = Math.max(last.endEpoch, p.endEpoch);
    } else {
      merged.push({ ...p });
    }
  }

  // merged 기간으로 총 개월 계산
  const totalMonths = merged.reduce((sum, p) => {
    const ms = p.endEpoch - p.startEpoch;
    return sum + Math.round(ms / (30.44 * 24 * 60 * 60 * 1000));
  }, 0);
  const totalYears = Math.round(totalMonths / 12 * 10) / 10;

  return {
    totalExperience: totalYears,
    companies: merged.map(p => ({ name: p.name, months: Math.round((p.endEpoch - p.startEpoch) / (30.44 * 24 * 60 * 60 * 1000)) })),
  };
}
