/**
 * 전체 파이프라인 품질 검증 — 채널톡 FDE
 * 디스크 캐시 사용: 같은 입력이면 API 재호출 안 함.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cached } from './testCache';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../core/analysis/jdAnalysis');
const { coachResume } = await import('../core/analysis/coaching');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

const company = '채널코퍼레이션';
const jobTitle = 'Forward Deployed Engineer';

console.log(`━━━ ${company} / ${jobTitle} ━━━\n`);

const start = Date.now();

// Stage 0+1: 전부 캐시 래핑
const [instruction, companyInfo, jobRoleInfo] = await Promise.all([
  cached('instruction', [jdText, company, jobTitle], () => generateTailoredInstruction(jdText, company, jobTitle)),
  cached('company', [company], () => researchCompany(company)).catch(() => null),
  cached('role', [jobTitle, company], () => researchJobRole(jobTitle, company)).catch(() => null),
]);
console.log(`Stage 0+1: ${Date.now() - start}ms`);

const ctx = mergeResearchResults(companyInfo, jobRoleInfo);

// Stage 2: coaching도 캐시
const coachStart = Date.now();
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
console.log(`Stage 2: ${Date.now() - coachStart}ms`);

// Scoring (규칙 기반 — 캐시 불필요, 즉시 계산)
const scoring = calculateScore(coach.gapMap, instruction, resumeText, jdText, ctx);
const label = LEVEL_LABELS[scoring.level].label;

console.log(`\n━━━ 결과 ━━━`);
console.log(`점수: ${scoring.matchScore} (${label})`);
console.log(`summary: ${coach.summary?.slice(0, 200)}`);
console.log(`\ngapMap (${coach.gapMap.length}개):`);
for (const g of coach.gapMap.slice(0, 5)) {
  console.log(`  [${g.currentLevel}] ${g.category}: ${g.requirement.slice(0, 50)}`);
}
console.log(`\nactionItems: ${coach.actionItems?.length}개`);
console.log(`quickWins: ${coach.quickWins?.length}개`);
console.log(`insights: ${coach.insights?.length}개`);

console.log(`\n감점:`);
for (const p of scoring.penalties) {
  console.log(`  -${p.points} [${p.category}] ${p.reason.slice(0, 80)}`);
}
console.log(`\nwarnings:`);
for (const w of scoring.warnings) {
  console.log(`  ${w}`);
}
console.log(`\n총 소요: ${Date.now() - start}ms`);
