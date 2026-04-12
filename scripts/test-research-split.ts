/**
 * 회사/직무 리서치 분리 테스트 (Flash Lite + Google Search)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');
const { generateTailoredInstruction, coachResume } = await import('../services/geminiService');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

const cases = [
  { company: '채널코퍼레이션', jobTitle: 'Forward Deployed Engineer', jdFile: '/tmp/resummeter-jd.txt' },
  { company: 'CLO Virtual Fashion', jobTitle: 'Frontend Engineer', jdFile: '/tmp/resummeter-jd-clo.txt' },
  { company: '현대자동차', jobTitle: 'AVP Frontend Engineer', jdFile: '/tmp/resummeter-jd-avp.txt' },
];

for (const c of cases) {
  console.log(`\n━━━ ${c.company} / ${c.jobTitle} ━━━`);
  const jd = readFileSync(c.jdFile, 'utf-8');

  // 병렬 실행: 회사 + 직무 + JD분석
  const start = Date.now();
  const [companyInfo, jobRoleInfo, instruction] = await Promise.all([
    researchCompany(c.company).catch(e => { console.log('  회사 리서치 실패:', e.message); return null; }),
    researchJobRole(c.jobTitle, c.company).catch(e => { console.log('  직무 리서치 실패:', e.message); return null; }),
    generateTailoredInstruction(jd),
  ]);
  const elapsed = Date.now() - start;
  console.log(`  병렬 실행: ${elapsed}ms`);

  // 회사 정보
  if (companyInfo) {
    console.log(`  회사: ${companyInfo.companyName} (신뢰도 ${Math.round(companyInfo.confidence * 100)}%)`);
    console.log(`  기술: ${companyInfo.techStack.slice(0, 5).join(', ')}`);
  }

  // 직무 정보
  if (jobRoleInfo) {
    console.log(`  직무: ${jobRoleInfo.roleInsight.slice(0, 100)}`);
    console.log(`  특성: ${jobRoleInfo.roleKeyTraits.join(' | ')}`);
  }

  // merge → scoring
  const ctx = mergeResearchResults(companyInfo, jobRoleInfo);
  const coach = await coachResume({
    resumeText,
    jobDescription: jd,
    instruction,
    githubRepos: [{ url: '', description: '' }],
    githubData: undefined,
    onStageChange: () => {},
    companyContext: ctx,
  });
  const scoring = calculateScore(coach.gapMap, instruction, resumeText, jd, ctx);
  const label = LEVEL_LABELS[scoring.level].label;

  console.log(`  점수: ${scoring.matchScore} (${label})`);
  for (const p of scoring.penalties) {
    console.log(`    -${p.points} [${p.category}] ${p.reason.slice(0, 80)}`);
  }
  for (const w of scoring.warnings) {
    console.log(`    ${w}`);
  }
}
