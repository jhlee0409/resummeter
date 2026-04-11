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
  CompanyContext,
} from '../../types';
import { parseJDRequirements, parseResumeExperience } from './requirementParser';

export function calculateScore(
  gapMap: GapMapItem[],
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  companyContext?: CompanyContext | null,
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

  // 학력 체크 — JD에서 required인 경우만 전체 감점, preferred면 절반
  if (parsed.education !== null) {
    const hasEducation = /학사|석사|박사|대학교|University|Bachelor|Master|PhD/i.test(resumeText);
    if (!hasEducation) {
      const eduReqs = (instruction.jdRequirements || []).filter(r => r.category === 'education');
      const isRequired = eduReqs.some(r => r.importance === 'required');
      const points = isRequired ? 15 : 8; // preferred이거나 JD에 없으면 절반 감점
      penalties.push({ category: '학력', points, reason: `학력 요건(${parsed.education}) 확인 불가${isRequired ? '' : ' (우대사항)'}` });
      hardReqDeduction += points;
    }
  }

  totalDeduction += hardReqDeduction;

  // ─── HR Red Flags (정보 제공, 감점 아님) ───

  if (resume.companies.length >= 3) {
    const avgMonths = resume.companies.reduce((s, c) => s + c.months, 0) / resume.companies.length;
    if (avgMonths < 12) {
      warnings.push(`평균 재직기간 ${Math.round(avgMonths)}개월 — 잦은 이직으로 인식될 수 있음`);
    }
  }

  // ─── 2단계: gapMap 카테고리별 감점 (JD 중요도 반영) ───

  // jdRequirements에서 카테고리별 required 비율 계산
  const jdReqs = instruction.jdRequirements || [];
  const importanceWeight = (category: string): number => {
    const items = jdReqs.filter(r => r.category === category);
    if (items.length === 0) return 1.0; // JD에 언급 없으면 보수적으로 전체 가중치
    const requiredCount = items.filter(r => r.importance === 'required').length;
    return 0.5 + 0.5 * (requiredCount / items.length); // 0.5 ~ 1.0
  };

  const BASE_DEDUCTIONS = {
    'hard-skill': 25,
    'experience': 20,
    'soft-skill': 10,
    'education': 5,
  } as const;

  const categories: Array<{ name: string; maxDeduction: number; key: keyof ScoringResult['breakdown'] }> = [
    { name: 'hard-skill', maxDeduction: Math.ceil(BASE_DEDUCTIONS['hard-skill'] * importanceWeight('hard-skill')), key: 'hardSkill' },
    { name: 'experience', maxDeduction: Math.ceil(BASE_DEDUCTIONS['experience'] * importanceWeight('experience')), key: 'experience' },
    { name: 'soft-skill', maxDeduction: Math.ceil(BASE_DEDUCTIONS['soft-skill'] * importanceWeight('soft-skill')), key: 'softSkill' },
    { name: 'education', maxDeduction: Math.ceil(BASE_DEDUCTIONS['education'] * importanceWeight('education')), key: 'experience' }, // breakdown에 education 키 없음 → experience에 합산
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

  // ─── 3단계: 도메인 키워드 감점 (시맨틱 매칭) ───

  const jdKeywords = instruction.keywords || [];
  if (jdKeywords.length > 0) {
    const resumeLower = resumeText.toLowerCase();
    // keywordAliases 배열 → Map 변환 (빠른 lookup)
    const aliasMap = new Map<string, string[]>();
    for (const entry of instruction.keywordAliases || []) {
      aliasMap.set(entry.keyword.toLowerCase(), entry.aliases);
    }

    const missingKeywords = jdKeywords.filter(kw => {
      // 1차: 원본 키워드 exact match
      if (resumeLower.includes(kw.toLowerCase())) return false;
      // 2차: alias match
      const kwAliases = aliasMap.get(kw.toLowerCase());
      if (kwAliases && kwAliases.some(alias => resumeLower.includes(alias.toLowerCase()))) return false;
      return true;
    });
    const missingRatio = missingKeywords.length / jdKeywords.length;

    if (missingRatio > 0.5) {
      const domainDeduction = 15;
      penalties.push({
        category: '도메인 키워드',
        points: domainDeduction,
        reason: `JD 키워드 ${jdKeywords.length}개 중 ${missingKeywords.length}개 미매칭 (${Math.round(missingRatio * 100)}%): ${missingKeywords.join(', ')}`,
      });
      breakdownDeductions.domain = domainDeduction;
      totalDeduction += domainDeduction;
    } else if (missingRatio > 0.3) {
      const domainDeduction = 8;
      penalties.push({
        category: '도메인 키워드',
        points: domainDeduction,
        reason: `JD 키워드 ${jdKeywords.length}개 중 ${missingKeywords.length}개 미매칭: ${missingKeywords.join(', ')}`,
      });
      breakdownDeductions.domain = domainDeduction;
      totalDeduction += domainDeduction;
    }
  }

  // ─── 4단계: 직무 특성 보너스 (리서치 기반) ───

  if (companyContext?.roleKeyTraits?.length) {
    const resumeLower = resumeText.toLowerCase();
    const matchedTraits = companyContext.roleKeyTraits.filter(trait => {
      const words = trait.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      return words.some(word => resumeLower.includes(word));
    });
    const matchRatio = matchedTraits.length / companyContext.roleKeyTraits.length;
    if (matchRatio >= 0.3) {
      const bonus = Math.min(5, Math.round(matchRatio * 7));
      totalDeduction = Math.max(0, totalDeduction - bonus);
      warnings.push(`직무 핵심 특성 ${companyContext.roleKeyTraits.length}개 중 ${matchedTraits.length}개 매칭 (+${bonus}점)`);
    }
  }

  // ─── 5단계: 잠재력 보너스 ───

  {
    let potentialBonus = 0;
    const reasons: string[] = [];
    // 항상 사용 가능한 데이터만 사용 (GitHub은 선택이라 점수에 반영하면 불공평)

    // 1. Gap 분포: weak 많고 missing 적으면 기초 있음 → 교육 가능
    const weakCount = gapMap.filter(g => g.currentLevel === 'weak').length;
    const missingCount = gapMap.filter(g => g.currentLevel === 'missing').length;
    if (weakCount >= 3 && missingCount <= 1) {
      potentialBonus += 2;
      reasons.push(`기초역량 보유(weak ${weakCount}/missing ${missingCount})`);
    }

    // 2. 경력 다양성: 3개+ 회사 경험 → 다양한 환경 적응력
    if (resume.companies.length >= 3) {
      potentialBonus += 2;
      reasons.push(`${resume.companies.length}개 회사 경험`);
    }

    // 3. 크로스 도메인: hard-skill strong + soft-skill strong 동시 → 균형잡힌 역량
    const hsStrong = gapMap.filter(g => g.category === 'hard-skill' && g.currentLevel === 'strong').length;
    const ssStrong = gapMap.filter(g => g.category === 'soft-skill' && g.currentLevel === 'strong').length;
    if (hsStrong >= 2 && ssStrong >= 1) {
      potentialBonus += 1;
      reasons.push('기술+소프트스킬 균형');
    }

    potentialBonus = Math.min(5, potentialBonus);
    if (potentialBonus > 0) {
      totalDeduction = Math.max(0, totalDeduction - potentialBonus);
      warnings.push(`잠재력 보너스 +${potentialBonus}점: ${reasons.join(', ')}`);
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
