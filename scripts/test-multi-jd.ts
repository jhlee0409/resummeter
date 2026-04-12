/**
 * 다중 JD 비교 테스트 — 범용적 문제 vs 특정 JD 문제 구분
 * 실행: npx tsx scripts/test-multi-jd.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../core/analysis/jdAnalysis');
const { coachResume } = await import('../core/analysis/coaching');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
const { analyzeGap } = await import('../features/gap-analysis/service');
const { analyzeAtsScore } = await import('../features/ats-score/service');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');

const jds = [
  { name: '채널톡 FDE', file: '/tmp/resummeter-jd.txt', company: '채널톡', jobTitle: 'Forward Deployed Engineer' },
  { name: 'AVP 모빌리티', file: '/tmp/resummeter-jd-avp.txt', company: 'AVP', jobTitle: '모빌리티 엔지니어' },
  { name: 'CLO Virtual Fashion', file: '/tmp/resummeter-jd-clo.txt', company: 'CLO Virtual Fashion', jobTitle: '프론트엔드 엔지니어' },
];

console.log('🔥 다중 JD 비교 테스트\n');

const results: any[] = [];

for (const jd of jds) {
  const jdText = readFileSync(jd.file, 'utf-8');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${jd.name} (${jdText.length}자)`);
  console.log('='.repeat(60));

  const start = Date.now();

  // 1. JD 분석
  process.stdout.write('  JD분석...');
  const instruction = await generateTailoredInstruction(jdText);
  process.stdout.write(' ✓  ');

  // 2. 회사+직무 리서치
  process.stdout.write('회사리서치...');
  const [companyInfo, roleInfo] = await Promise.all([
    researchCompany(jd.company),
    researchJobRole(jd.jobTitle, jd.company),
  ]);
  const companyCtx = mergeResearchResults(companyInfo, roleInfo);
  process.stdout.write(' ✓  ');

  // 3. 코칭
  process.stdout.write('코칭...');
  const coach = await coachResume({
    resumeText,
    jobDescription: jdText,
    instruction,
    githubRepos: [{ url: '', description: '' }],
    githubData: undefined,
    onStageChange: () => {},
  });
  process.stdout.write(' ✓  ');

  // 4. 갭분석
  process.stdout.write('갭분석...');
  const gap = await analyzeGap(resumeText, jdText, instruction, companyCtx);
  process.stdout.write(' ✓  ');

  // 5. ATS
  process.stdout.write('ATS...');
  const ats = await analyzeAtsScore(resumeText, jdText, JSON.stringify(instruction));
  console.log(' ✓');

  const elapsed = Math.round((Date.now() - start) / 1000);

  const r = {
    jd: jd.name,
    elapsed: `${elapsed}초`,
    company: companyCtx?.companyName || '미확인',
    companyConfidence: companyCtx?.confidence || 0,
    roleInsight: companyCtx?.roleInsight?.slice(0, 80) || '',
    roleKeyTraits: companyCtx?.roleKeyTraits?.slice(0, 3) || [],
    coachScore: coach.matchScore,
    coachSummary: coach.summary,
    gapMapCount: coach.gapMap.length,
    strongCount: coach.gapMap.filter((g: any) => g.currentLevel === 'strong').length,
    weakCount: coach.gapMap.filter((g: any) => g.currentLevel === 'weak').length,
    missingCount: coach.gapMap.filter((g: any) => g.currentLevel === 'missing').length,
    actionItemCount: coach.actionItems.length,
    quickWins: coach.quickWins,
    gapMatchRate: gap.matchRate,
    gapRequiredRate: gap.requiredMatchRate,
    gapOverall: gap.overallAssessment,
    gapMatched: gap.matches.filter((m: any) => m.matched).length,
    gapMissing: gap.matches.filter((m: any) => !m.matched).length,
    atsOverall: ats.overall,
    atsKeyword: ats.keywordMatch,
    atsFormat: ats.formatCompliance,
  };

  results.push(r);

  console.log(`\n  📊 코칭=${r.coachScore} | 갭매칭=${r.gapMatchRate}%(필수${r.gapRequiredRate}%) | ATS=${r.atsOverall}(KW:${r.atsKeyword})`);
  console.log(`  🏢 ${r.company} (${Math.round(r.companyConfidence * 100)}%)`);
  console.log(`  📝 ${r.coachSummary?.slice(0, 120)}`);
  console.log(`  🔍 갭: 매칭${r.gapMatched} / 미스${r.gapMissing}`);
  console.log(`  ⏱ ${r.elapsed}`);
}

// 비교 분석
console.log('\n\n' + '='.repeat(60));
console.log('📊 3개 JD 비교 분석');
console.log('='.repeat(60));

console.log('\n| 항목 | 채널톡 FDE | AVP 모빌리티 | CLO Fashion |');
console.log('|------|----------|------------|------------|');
console.log(`| 코칭 점수 | ${results[0].coachScore} | ${results[1].coachScore} | ${results[2].coachScore} |`);
console.log(`| 갭 매칭률 | ${results[0].gapMatchRate}% | ${results[1].gapMatchRate}% | ${results[2].gapMatchRate}% |`);
console.log(`| 필수 매칭률 | ${results[0].gapRequiredRate}% | ${results[1].gapRequiredRate}% | ${results[2].gapRequiredRate}% |`);
console.log(`| ATS 점수 | ${results[0].atsOverall} | ${results[1].atsOverall} | ${results[2].atsOverall} |`);
console.log(`| ATS 키워드 | ${results[0].atsKeyword} | ${results[1].atsKeyword} | ${results[2].atsKeyword} |`);
console.log(`| 회사 신뢰도 | ${Math.round(results[0].companyConfidence*100)}% | ${Math.round(results[1].companyConfidence*100)}% | ${Math.round(results[2].companyConfidence*100)}% |`);
console.log(`| 소요시간 | ${results[0].elapsed} | ${results[1].elapsed} | ${results[2].elapsed} |`);

// 점수 차이 분석
console.log('\n🔍 점수 일관성 분석:');
const scores = results.map(r => ({ jd: r.jd, coach: r.coachScore, gap: r.gapMatchRate, ats: r.atsOverall }));
for (const s of scores) {
  const coachVsAts = s.coach - s.ats;
  console.log(`  ${s.jd}: 코칭(${s.coach}) vs ATS(${s.ats}) 차이=${coachVsAts}점 | 갭매칭=${s.gap}%`);
  if (Math.abs(coachVsAts) > 15) {
    console.log(`    ⚠️ 코칭-ATS 점수 차이 ${Math.abs(coachVsAts)}점 — 불일치 의심`);
  }
}

writeFileSync('/tmp/resummeter-multi-jd-results.json', JSON.stringify(results, null, 2));
console.log('\n결과 저장: /tmp/resummeter-multi-jd-results.json');
