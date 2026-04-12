/**
 * 전체 분석 기능 점검 — 16개 기능 순차 실행
 * 디스크 캐시로 재실행 시 비용 0
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cached } from './testCache';

const envContent = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction, coachResume, generateNarrativeSections } = await import('../services/geminiService');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');
const { analyzeAtsScore, analyzeDetailedScore } = await import('../features/ats-score/service');
const { generateCareerStatements } = await import('../features/career-statement/service');
const { generateCoverLetter } = await import('../features/cover-letter/service');
const { refineAboutStatement } = await import('../features/about-statement/service');
const { generateInterviewQuestions, evaluateAnswer } = await import('../features/interview/service');
const { analyzeLearningRoadmap } = await import('../features/skill-gap/service');
const { generateLinkedInOptimization } = await import('../features/linkedin/service');
const { analyzeGap } = await import('../features/gap-analysis/service');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');
const company = '채널코퍼레이션';
const jobTitle = 'Forward Deployed Engineer';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) { pass++; console.log(`  ✅ ${name}: ${detail}`); }
  else { fail++; console.log(`  ❌ ${name}: ${detail}`); }
}

console.log(`\n━━━ 전체 기능 점검: ${company} / ${jobTitle} ━━━\n`);

// ── 1. Stage 0+1: 리서치 + JD 분석 ──
console.log('── Stage 0+1: 리서치 + JD 분석 ──');
const instruction = await cached('instruction', [jdText, company, jobTitle], () => generateTailoredInstruction(jdText, company, jobTitle));
check('JD 분석', instruction.keywords.length >= 5, `keywords ${instruction.keywords.length}개, persona ${instruction.persona.slice(0, 40)}...`);
check('keywordAliases', (instruction.keywordAliases?.length ?? 0) >= 3, `${instruction.keywordAliases?.length ?? 0}개 alias`);
check('jdRequirements', (instruction.jdRequirements?.length ?? 0) >= 3, `${instruction.jdRequirements?.length ?? 0}개 요구사항`);

const companyInfo = await cached('company', [company], () => researchCompany(company)).catch(() => null);
check('회사 리서치', !!companyInfo && companyInfo.confidence > 0, `신뢰도 ${companyInfo ? Math.round(companyInfo.confidence * 100) : 0}%, techStack ${companyInfo?.techStack.length ?? 0}개`);

const jobRoleInfo = await cached('role', [jobTitle, company], () => researchJobRole(jobTitle, company)).catch(() => null);
check('직무 리서치', !!jobRoleInfo && jobRoleInfo.roleKeyTraits.length >= 3, `traits ${jobRoleInfo?.roleKeyTraits.length ?? 0}개`);

const ctx = mergeResearchResults(companyInfo, jobRoleInfo);

// ── 2. Stage 2: 이력서 분석 + 코칭 ──
console.log('\n── Stage 2: 이력서 분석 + 코칭 ──');
const coach = await cached('coaching', [resumeText.slice(0, 200), jdText.slice(0, 200), company, jobTitle], () =>
  coachResume({
    resumeText,
    jobDescription: jdText,
    instruction,
    githubRepos: [{ url: '', description: '' }],
    githubData: undefined,
    onStageChange: () => {},
    companyContext: ctx,
  })
);
check('gapMap', coach.gapMap.length >= 3, `${coach.gapMap.length}개 항목`);
check('actionItems', (coach.actionItems?.length ?? 0) >= 1, `${coach.actionItems?.length ?? 0}개`);
check('actionItem.suggestion', coach.actionItems?.every(a => !!a.suggestion) ?? false, `모든 항목에 suggestion 존재`);
check('insights', (coach.insights?.length ?? 0) >= 1, `${coach.insights?.length ?? 0}개`);
check('insight.observation', coach.insights?.every(i => !!(i as any).observation) ?? false, `모든 항목에 observation 존재`);
check('quickWins', (coach.quickWins?.length ?? 0) >= 1, `${coach.quickWins?.length ?? 0}개`);
check('optimizedResume', (coach.optimizedResume?.length ?? 0) > 100, `${coach.optimizedResume?.length ?? 0}자`);
check('summary', (coach.summary?.length ?? 0) > 30, `${coach.summary?.slice(0, 60)}...`);

// ── 3. Scoring Engine ──
console.log('\n── Scoring Engine ──');
const scoring = calculateScore(coach.gapMap, instruction, resumeText, jdText, ctx);
check('matchScore 범위', scoring.matchScore >= 0 && scoring.matchScore <= 100, `${scoring.matchScore}점`);
check('level', ['strong_match', 'conditional', 'weak', 'not_recommended', 'data_insufficient'].includes(scoring.level), `${LEVEL_LABELS[scoring.level].label}`);
check('breakdown', Object.values(scoring.breakdown).every(v => v >= 0), JSON.stringify(scoring.breakdown));
check('penalties', scoring.penalties.every(p => p.points > 0 && p.category && p.reason), `${scoring.penalties.length}개`);

// ── 4. ATS ──
console.log('\n── ATS 점수 ──');
const ats = await cached('ats', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  analyzeAtsScore(resumeText, jdText, JSON.stringify(instruction), ctx)
);
check('ATS overall', ats.overall >= 0 && ats.overall <= 100, `${ats.overall}점`);
check('ATS keywords', (ats.keywords?.length ?? 0) >= 3, `${ats.keywords?.length ?? 0}개 키워드`);

const detailed = await cached('detailed', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  analyzeDetailedScore(resumeText, jdText, JSON.stringify(instruction), ctx)
);
check('상세점수 overall', detailed.overall >= 0 && detailed.overall <= 100, `${detailed.overall}점`);
check('상세점수 breakdown', !!detailed.breakdown, `techStack=${detailed.breakdown?.techStack?.score ?? '?'}, impact=${detailed.breakdown?.impact?.score ?? '?'}`);

// ── 5. 경력기술서 ──
console.log('\n── 경력기술서 ──');
const career = await cached('career', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  generateCareerStatements(resumeText, jdText, instruction, undefined, ctx)
);
check('경력기술서', (career.statements?.length ?? 0) >= 1, `${career.statements?.length ?? 0}개 문항`);
check('STAR 구조', career.statements?.[0]?.starBreakdown != null, `첫 문항 STAR: ${career.statements?.[0]?.starBreakdown ? 'OK' : 'MISSING'}`);

// ── 6. 커버레터 ──
console.log('\n── 커버레터 ──');
const cover = await cached('cover', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  generateCoverLetter(resumeText, jdText, instruction, { language: 'ko', tone: 'formal', length: 'medium' }, undefined, ctx)
);
check('커버레터', (cover.content?.length ?? 0) > 100, `${cover.content?.length ?? 0}자, keywords ${cover.keywordsUsed?.length ?? 0}개`);

// ── 7. 한줄소개 ──
console.log('\n── 한줄소개 ──');
const about = await cached('about', [resumeText.slice(0, 200)], () =>
  refineAboutStatement('기술로 비즈니스 문제를 해결하는 프론트엔드 개발자입니다', resumeText, jdText, instruction, undefined, ctx)
);
check('한줄소개', (about.versions?.length ?? 0) >= 2, `${about.versions?.length ?? 0}개 버전`);
check('bestVersion', !!about.bestVersion, `추천: ${about.bestVersion ?? 'NONE'}`);

// ── 8. 면접 질문 ──
console.log('\n── 면접 질문 ──');
const questions = await cached('interview', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  generateInterviewQuestions(resumeText, jdText, instruction, ctx)
);
check('면접 질문', questions.length >= 5, `${questions.length}개 질문`);
const techQ = questions.filter(q => q.type === 'technical').length;
const behavQ = questions.filter(q => q.type === 'behavioral').length;
check('질문 유형', techQ >= 2 && behavQ >= 1, `기술 ${techQ}개, 인성 ${behavQ}개`);
check('STAR 가이드', questions.every(q => !!q.starGuide), `모든 질문에 starGuide 있음`);

// ── 9. 학습 경로 ──
console.log('\n── 학습 경로 ──');
const weakGaps = coach.gapMap.filter(g => g.currentLevel !== 'strong');
if (weakGaps.length > 0) {
  const roadmap = await cached('roadmap', [jdText.slice(0, 200)], () =>
    analyzeLearningRoadmap(weakGaps as any, jdText, instruction, ctx)
  );
  check('학습 경로', (roadmap.items?.length ?? 0) >= 1, `${roadmap.items?.length ?? 0}개 항목`);
} else {
  console.log('  ⏭️ 학습 경로: weak/missing gap 없어서 스킵');
}

// ── 10. LinkedIn ──
console.log('\n── LinkedIn ──');
const linkedin = await cached('linkedin', [resumeText.slice(0, 200)], () =>
  generateLinkedInOptimization(resumeText, jdText, instruction, ctx)
);
check('LinkedIn headline', (linkedin.headline?.length ?? 0) > 10, `"${linkedin.headline?.slice(0, 50)}..."`);
check('LinkedIn about', (linkedin.about?.length ?? 0) > 50, `${linkedin.about?.length ?? 0}자`);

// ── 11. 역량 갭 분석 ──
console.log('\n── 역량 갭 분석 ──');
const gap = await cached('gap', [resumeText.slice(0, 200), jdText.slice(0, 200)], () =>
  analyzeGap(resumeText, jdText, instruction, ctx)
);
check('갭 매칭', (gap.matches?.length ?? 0) >= 3, `${gap.matches?.length ?? 0}개 매칭`);
check('전체 평가', (gap.overallAssessment?.length ?? 0) > 20, `${gap.overallAssessment?.slice(0, 60)}...`);
check('matchRate', gap.matchRate >= 0 && gap.matchRate <= 100, `${gap.matchRate}%`);

// ── 결과 ──
console.log(`\n━━━ 결과: ${pass} pass / ${fail} fail ━━━`);
if (fail > 0) process.exit(1);
