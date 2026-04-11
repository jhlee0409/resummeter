/**
 * 풀플로우 테스트: 이력서 + JD → JD분석 → 회사정보수집 → 코칭 → 갭분석
 * 실행: npx tsx scripts/test-fullflow.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env.local에서 API 키 로드
const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found in .env.local'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

// 서비스 임포트
const { generateTailoredInstruction, coachResume } = await import('../services/geminiService');
const { extractCompanyName, researchCompany } = await import('../services/companyResearchService');
const { analyzeGap } = await import('../services/gapAnalysisService');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

console.log('='.repeat(60));
console.log('풀플로우 테스트 시작');
console.log(`이력서: ${resumeText.length}자 / JD: ${jdText.length}자`);
console.log('='.repeat(60));

// Step 1: JD 분석
console.log('\n📋 Step 1: JD 분석 중...');
const startJD = Date.now();
const instruction = await generateTailoredInstruction(jdText);
console.log(`  완료 (${Date.now() - startJD}ms)`);
console.log(`  업종: ${instruction.detectedIndustry}`);
console.log(`  페르소나: ${instruction.persona}`);
console.log(`  키워드 (${instruction.keywords.length}): ${instruction.keywords.slice(0, 8).join(', ')}...`);
console.log(`  Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}`);
console.log(`  Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}`);

// Step 2: 회사 정보 수집
console.log('\n🏢 Step 2: 회사 정보 수집 중...');
const startCompany = Date.now();
let companyName: string | null = null;
let companyCtx: Awaited<ReturnType<typeof researchCompany>> | null = null;
try {
  companyName = await extractCompanyName(jdText);
  console.log(`  회사명: ${companyName}`);
  if (companyName) {
    companyCtx = await researchCompany(companyName, jdText);
    console.log(`  완료 (${Date.now() - startCompany}ms)`);
    console.log(`  신뢰도: ${Math.round(companyCtx.confidence * 100)}%`);
    console.log(`  기술스택: ${companyCtx.techStack.join(', ')}`);
    console.log(`  문화: ${companyCtx.culture.slice(0, 100)}...`);
    console.log(`  인재상: ${companyCtx.idealCandidate.slice(0, 100)}...`);
    console.log(`  사업방향: ${companyCtx.businessDirection.slice(0, 100)}...`);
    console.log(`  최근뉴스: ${companyCtx.recentNews.length}건`);
    companyCtx.recentNews.forEach(n => console.log(`    - ${n.slice(0, 80)}`));
    console.log(`  직무리서치: ${companyCtx.roleInsight?.slice(0, 150)}...`);
    console.log(`  직무핵심특성: ${companyCtx.roleKeyTraits?.join(', ')}`);
    console.log(`  출처: ${companyCtx.sources.length}개`);
  }
} catch (e: any) {
  console.log(`  실패: ${e.message || e}`);
}

// Step 3: 코칭 분석
console.log('\n🎯 Step 3: 코칭 분석 중...');
const startCoach = Date.now();
const coachResult = await coachResume(
  resumeText, jdText, instruction,
  [{ url: '', description: '' }], undefined,
  (stage) => console.log(`    stage: ${stage}`)
);
console.log(`  완료 (${Date.now() - startCoach}ms)`);
console.log(`  매칭 점수: ${coachResult.matchScore}/100`);
console.log(`  요약: ${coachResult.summary}`);
console.log(`\n  --- Gap Map (${coachResult.gapMap.length}개) ---`);
coachResult.gapMap.forEach(g => {
  console.log(`  [${g.currentLevel}] ${g.requirement} — ${g.suggestion || ''}`);
});
console.log(`\n  --- Action Items (${coachResult.actionItems.length}개) ---`);
coachResult.actionItems.slice(0, 5).forEach(a => {
  console.log(`  [${a.priority}] ${a.targetSection}`);
  console.log(`    BEFORE: ${a.before.slice(0, 80)}...`);
  console.log(`    AFTER:  ${a.after.slice(0, 80)}...`);
  console.log(`    제안: ${a.suggestion.slice(0, 80)}`);
  console.log();
});
console.log(`\n  --- Quick Wins (${coachResult.quickWins.length}개) ---`);
coachResult.quickWins.forEach(q => console.log(`  - ${q}`));

// Step 4: 역량 갭 분석
console.log('\n📊 Step 4: 역량 갭 분석 중...');
const startGap = Date.now();
const gapResult = await analyzeGap(resumeText, jdText, instruction, companyCtx);
console.log(`  완료 (${Date.now() - startGap}ms)`);
console.log(`  전체 매칭률: ${gapResult.matchRate}%`);
console.log(`  필수 매칭률: ${gapResult.requiredMatchRate}%`);
console.log(`  종합평가: ${gapResult.overallAssessment}`);
console.log(`\n  --- Matches (${gapResult.matches.length}개) ---`);
gapResult.matches.forEach(m => {
  const icon = m.matched ? '✅' : '❌';
  console.log(`  ${icon} [${m.severity}] ${m.requirement}`);
  if (m.evidence) console.log(`     증거: ${m.evidence.slice(0, 80)}`);
  if (m.reframeSuggestion) console.log(`     재프레이밍: ${m.reframeSuggestion.slice(0, 80)}`);
});
console.log(`\n  --- Missing Evidence ---`);
gapResult.missingEvidence.forEach(m => console.log(`  + ${m}`));

console.log('\n' + '='.repeat(60));
console.log('풀플로우 테스트 완료');
const totalTime = Date.now() - startJD;
console.log(`총 소요시간: ${Math.round(totalTime / 1000)}초`);
console.log('='.repeat(60));
