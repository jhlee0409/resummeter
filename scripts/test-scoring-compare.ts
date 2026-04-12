/**
 * Scoring Engine before/after 비교 — 3개 JD
 * 실행: npx tsx scripts/test-scoring-compare.ts
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
const { parseJDRequirements, parseResumeExperience } = await import('../core/scoring/requirementParser');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');

const jds = [
  { name: '채널톡 FDE', file: '/tmp/resummeter-jd.txt', expectLevel: 'conditional', expectRange: [70, 85] },
  { name: 'AVP 모빌리티', file: '/tmp/resummeter-jd-avp.txt', expectLevel: 'not_recommended', expectRange: [30, 50] },
  { name: 'CLO Fashion', file: '/tmp/resummeter-jd-clo.txt', expectLevel: 'conditional', expectRange: [75, 90] },
];

console.log('🔥 Scoring Engine Before/After 비교\n');

// 먼저 이력서 경력 파싱 결과
const resumeParsed = parseResumeExperience(resumeText);
console.log(`📋 이력서 경력 파싱: ${resumeParsed.totalExperience}년 (${resumeParsed.companies.length}개 회사)`);
resumeParsed.companies.forEach(c => console.log(`  - ${c.name.slice(0, 40)}... (${c.months}개월)`));

console.log('\n' + '='.repeat(70));

for (const jd of jds) {
  const jdText = readFileSync(jd.file, 'utf-8');
  console.log(`\n📋 ${jd.name}`);
  console.log('-'.repeat(70));

  // JD 요건 파싱
  const jdParsed = parseJDRequirements(jdText);
  console.log(`  JD 요건: 경력=${jdParsed.minExperience ?? '무관'}년, 학력=${jdParsed.education ?? '무관'}`);

  // LLM 코칭
  process.stdout.write('  코칭 분석 중...');
  const instruction = await generateTailoredInstruction(jdText);
  const coach = await coachResume({
    resumeText,
    jobDescription: jdText,
    instruction,
    githubRepos: [{ url: '', description: '' }],
    githubData: undefined,
    onStageChange: () => {},
  });
  console.log(' ✓');

  // Scoring Engine
  const scoring = calculateScore(coach.gapMap, instruction, resumeText, jdText);
  const levelInfo = LEVEL_LABELS[scoring.level];

  console.log(`\n  BEFORE (LLM): ${coach.matchScore}점`);
  console.log(`  AFTER (Engine): ${scoring.matchScore}점 → ${levelInfo.label}`);
  console.log(`  차이: ${coach.matchScore - scoring.matchScore}점`);

  console.log(`\n  감점 내역:`);
  if (scoring.penalties.length === 0) {
    console.log('    (감점 없음)');
  }
  for (const p of scoring.penalties) {
    console.log(`    -${p.points}점 [${p.category}] ${p.reason}`);
  }

  if (scoring.warnings.length > 0) {
    console.log(`  경고:`);
    for (const w of scoring.warnings) {
      console.log(`    ⚠️ ${w}`);
    }
  }

  console.log(`\n  breakdown: HR=${scoring.breakdown.hardRequirement} HS=${scoring.breakdown.hardSkill} EX=${scoring.breakdown.experience} SS=${scoring.breakdown.softSkill} DM=${scoring.breakdown.domain}`);

  // 기대값 검증
  const inRange = scoring.matchScore >= jd.expectRange[0] && scoring.matchScore <= jd.expectRange[1];
  const levelMatch = scoring.level === jd.expectLevel || (jd.expectLevel === 'conditional' && scoring.level === 'strong_match');
  console.log(`\n  기대: ${jd.expectRange[0]}-${jd.expectRange[1]}점 ${jd.expectLevel} → ${inRange ? '✅ 범위 OK' : '❌ 범위 초과'} / ${levelMatch ? '✅ 레벨 OK' : '❌ 레벨 불일치 (got: ' + scoring.level + ')'}`);
}

console.log('\n' + '='.repeat(70));
console.log('비교 완료');
