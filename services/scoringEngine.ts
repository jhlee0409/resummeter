/**
 * Scoring Engine — 규칙 기반 점수 계산.
 * LLM은 분석만, 점수는 이 엔진이 계산.
 */

import type {
  GapMapItem,
  TailoredInstructionWithRequirements,
  ScoringResult,
  FitLevel,
  Penalty,
} from '../types';
import { parseJDRequirements, parseResumeExperience } from './requirementParser';

export function calculateScore(
  gapMap: GapMapItem[],
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
): ScoringResult {
  // 가드: 데이터 부족
  if (gapMap.length < 3) {
    return {
      matchScore: 0,
      level: 'data_insufficient',
      penalties: [],
      warnings: ['분석 데이터가 부족합니다. 이력서와 JD를 더 상세히 입력해주세요.'],
      breakdown: { hardRequirement: 0, hardSkill: 0, experience: 0, softSkill: 0, domain: 0 },
    };
  }

  const penalties: Penalty[] = [];
  const warnings: string[] = [];
  let totalDeduction = 0;

  // ─── 1단계: Hard Requirement ───

  const parsed = parseJDRequirements(jobDescription);
  const resume = parseResumeExperience(resumeText);
  let hardReqDeduction = 0;

  // 경력 체크
  if (parsed.minExperience !== null) {
    let experienceYears: number | null = resume.totalExperience;

    // 2차 fallback: gapMap experience 카테고리
    if (experienceYears === null) {
      const expItems = gapMap.filter(g => g.category === 'experience');
      if (expItems.length > 0) {
        const strongRatio = expItems.filter(g => g.currentLevel === 'strong').length / expItems.length;
        if (strongRatio < 0.5) {
          penalties.push({ category: '경력', points: 30, reason: `경력 요건 미달 가능성 (요구: ${parsed.minExperience}년, 자동 판별 실패)` });
          hardReqDeduction += 30;
          warnings.push('경력 자동 판별 실패. 경험 항목 분석 기반으로 감점 적용됨.');
        }
      } else {
        warnings.push('경력 자동 판별 실패. 수동 확인 필요.');
      }
    } else if (experienceYears < parsed.minExperience) {
      const deficit = parsed.minExperience - experienceYears;
      const points = deficit >= parsed.minExperience * 0.5 ? 30 : 20; // 50% 미만이면 최대 감점
      penalties.push({
        category: '경력',
        points,
        reason: `경력 요건 미달 (요구: ${parsed.minExperience}년, 보유: ${experienceYears}년)`,
      });
      hardReqDeduction += points;
    }
  }

  // 학력 체크
  if (parsed.education !== null) {
    // 간단 체크: 이력서에 학력 관련 키워드가 있는지
    const hasEducation = /학사|석사|박사|대학교|University|Bachelor|Master|PhD/i.test(resumeText);
    if (!hasEducation) {
      penalties.push({ category: '학력', points: 15, reason: `학력 요건(${parsed.education}) 확인 불가` });
      hardReqDeduction += 15;
    }
  }

  totalDeduction += hardReqDeduction;

  // ─── 2단계: gapMap 카테고리별 감점 ───

  const categories: Array<{ name: string; maxDeduction: number; key: keyof ScoringResult['breakdown'] }> = [
    { name: 'hard-skill', maxDeduction: 25, key: 'hardSkill' },
    { name: 'experience', maxDeduction: 20, key: 'experience' },
    { name: 'soft-skill', maxDeduction: 10, key: 'softSkill' },
    { name: 'education', maxDeduction: 5, key: 'experience' }, // education items 합산
  ];

  const breakdownDeductions: Record<string, number> = {
    hardSkill: 0,
    experience: 0,
    softSkill: 0,
    domain: 0,
  };

  for (const cat of categories) {
    const items = gapMap.filter(g => g.category === cat.name);
    if (items.length === 0) continue;

    const missingCount = items.filter(g => g.currentLevel === 'missing').length;
    const weakCount = items.filter(g => g.currentLevel === 'weak').length;
    const missingRatio = (missingCount + weakCount * 0.5) / items.length;
    const deduction = Math.ceil(missingRatio * cat.maxDeduction);

    if (deduction > 0) {
      penalties.push({
        category: cat.name,
        points: deduction,
        reason: `${cat.name}: ${items.length}개 중 missing ${missingCount}개, weak ${weakCount}개`,
      });
      breakdownDeductions[cat.key] = (breakdownDeductions[cat.key] || 0) + deduction;
      totalDeduction += deduction;
    }
  }

  // ─── 3단계: 도메인 키워드 감점 ───

  const jdKeywords = instruction.keywords || [];
  if (jdKeywords.length > 0) {
    const resumeLower = resumeText.toLowerCase();
    const missingKeywords = jdKeywords.filter(kw => !resumeLower.includes(kw.toLowerCase()));
    const missingRatio = missingKeywords.length / jdKeywords.length;

    if (missingRatio > 0.5) {
      const domainDeduction = 15;
      penalties.push({
        category: '도메인 키워드',
        points: domainDeduction,
        reason: `JD 키워드 ${jdKeywords.length}개 중 ${missingKeywords.length}개 미매칭 (${Math.round(missingRatio * 100)}%)`,
      });
      breakdownDeductions.domain = domainDeduction;
      totalDeduction += domainDeduction;
    } else if (missingRatio > 0.3) {
      const domainDeduction = 8;
      penalties.push({
        category: '도메인 키워드',
        points: domainDeduction,
        reason: `JD 키워드 ${jdKeywords.length}개 중 ${missingKeywords.length}개 미매칭`,
      });
      breakdownDeductions.domain = domainDeduction;
      totalDeduction += domainDeduction;
    }
  }

  // ─── 최종 계산 ───

  const matchScore = Math.max(0, 100 - totalDeduction);

  let level: FitLevel;
  if (matchScore >= 90) level = 'strong_match';
  else if (matchScore >= 70) level = 'conditional';
  else if (matchScore >= 50) level = 'weak';
  else level = 'not_recommended';

  // 경력 50% 미만이면 강제 not_recommended
  if (parsed.minExperience !== null && resume.totalExperience !== null) {
    if (resume.totalExperience < parsed.minExperience * 0.5) {
      level = 'not_recommended';
      if (!warnings.includes('경력 요건 대비 50% 미만')) {
        warnings.push(`경력 요건 대비 50% 미만 (요구: ${parsed.minExperience}년, 보유: ${resume.totalExperience}년). 지원 재고 필요.`);
      }
    }
  }

  return {
    matchScore,
    level,
    penalties,
    warnings,
    breakdown: {
      hardRequirement: hardReqDeduction,
      hardSkill: breakdownDeductions.hardSkill,
      experience: breakdownDeductions.experience,
      softSkill: breakdownDeductions.softSkill,
      domain: breakdownDeductions.domain,
    },
  };
}

export const LEVEL_LABELS: Record<FitLevel, { label: string; color: string }> = {
  strong_match: { label: '강력 추천', color: 'emerald' },
  conditional: { label: '조건부 추천', color: 'amber' },
  weak: { label: '약한 매칭', color: 'orange' },
  not_recommended: { label: '지원 부적합', color: 'red' },
  data_insufficient: { label: '데이터 부족', color: 'zinc' },
};
