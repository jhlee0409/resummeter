/**
 * 3개 JD Scoring Engine 테스트 (회사명/직무명 직접 입력)
 * 1. 채널코퍼레이션 → FDE
 * 2. CLO → FE
 * 3. 현대자동차 → AVP (AVF)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction, coachResume } = await import('../services/geminiService');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');
const { parseResumeExperience } = await import('../core/scoring/requirementParser');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');

const cases = [
  { company: '채널코퍼레이션', jobTitle: 'Forward Deployed Engineer', jdFile: '/tmp/resummeter-jd.txt' },
  { company: 'CLO', jobTitle: 'Frontend Engineer', jdFile: '/tmp/resummeter-jd-clo.txt' },
  { company: '현대자동차', jobTitle: 'AVP Frontend Engineer', jdFile: '/tmp/resummeter-jd-avp.txt' },
];

const resume = parseResumeExperience(resumeText);
console.log(`이력서: ${resume.totalExperience}년 (${resume.companies.length}개 회사)\n`);

for (const c of cases) {
  const jdText = readFileSync(c.jdFile, 'utf-8');
  console.log(`━━━ ${c.company} / ${c.jobTitle} ━━━`);

  process.stdout.write('  분석 중...');
  const instruction = await generateTailoredInstruction(jdText);
  const coach = await coachResume(resumeText, jdText, instruction, [{ url: '', description: '' }], undefined, () => {});
  console.log(' OK');

  // keywordAliases 확인
  if (instruction.keywordAliases?.length) {
    console.log(`  aliases: ${instruction.keywordAliases.length}개`);
    for (const a of instruction.keywordAliases.slice(0, 3)) {
      console.log(`    ${a.keyword} → [${a.aliases.slice(0, 3).join(', ')}]`);
    }
  }

  const scoring = calculateScore(coach.gapMap, instruction, resumeText, jdText);
  const label = LEVEL_LABELS[scoring.level].label;
  console.log(`  LLM: ${coach.matchScore} → Engine: ${scoring.matchScore} (${label})`);
  for (const p of scoring.penalties) {
    console.log(`    -${p.points} [${p.category}] ${p.reason.slice(0, 80)}`);
  }
  console.log(`  breakdown: HR=${scoring.breakdown.hardRequirement} HS=${scoring.breakdown.hardSkill} EX=${scoring.breakdown.experience} SS=${scoring.breakdown.softSkill} DM=${scoring.breakdown.domain}`);
  console.log('');
}
