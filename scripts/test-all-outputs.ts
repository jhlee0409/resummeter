/**
 * 전체 14개 프롬프트 output 품질 테스트
 * 실행: npx tsx scripts/test-all-outputs.ts
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
const { analyzeAtsScore, analyzeDetailedScore } = await import('../features/ats-score/service');
const { generateCareerStatements } = await import('../features/career-statement/service');
const { generateCoverLetter } = await import('../features/cover-letter/service');
const { generateInterviewQuestions } = await import('../features/interview/service');
const { generatePractitionerReview } = await import('../features/practitioner/service');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

const outputs: Record<string, any> = {};
const timings: Record<string, number> = {};

function log(label: string, data: any) {
  outputs[label] = data;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${label}`);
  console.log(`${'='.repeat(50)}`);
}

function time(label: string) { timings[label] = Date.now(); }
function timeEnd(label: string) {
  const ms = Date.now() - timings[label];
  console.log(`  ⏱ ${Math.round(ms/1000)}초`);
  return ms;
}

console.log('🔥 전체 output 품질 테스트 시작\n');

// 1. JD 분석
console.log('📋 1/8 JD 분석...');
time('jd');
const instruction = await generateTailoredInstruction(jdText);
timeEnd('jd');
log('JD 분석', {
  업종: instruction.detectedIndustry,
  키워드수: instruction.keywords.length,
  hardSkills: instruction.evaluationCriteria.hardSkills,
  softSkills: instruction.evaluationCriteria.softSkills,
});

// 2. 회사+직무 리서치
console.log('🏢 2/8 회사+직무 리서치...');
time('company');
const companyName = '채널톡';
const [companyInfo, roleInfo] = await Promise.all([
  researchCompany(companyName),
  researchJobRole('Forward Deployed Engineer', companyName),
]);
const companyCtx = mergeResearchResults(companyInfo, roleInfo);
timeEnd('company');
log('회사 리서치', {
  회사: companyCtx?.companyName,
  신뢰도: companyCtx?.confidence,
  기술스택: companyCtx?.techStack?.slice(0, 5),
  직무핵심: companyCtx?.roleKeyTraits?.slice(0, 3),
});

// 3. 코칭
console.log('🎯 3/8 코칭 분석...');
time('coach');
const result = await coachResume({
  resumeText,
  jobDescription: jdText,
  instruction,
  githubRepos: [{ url: '', description: '' }],
  githubData: undefined,
  onStageChange: () => {},
});
timeEnd('coach');
log('코칭', {
  점수: result.matchScore,
  요약: result.summary,
  gapMap수: result.gapMap.length,
  actionItems수: result.actionItems.length,
  quickWins: result.quickWins,
});

// 4. 역량 갭 분석
console.log('📊 4/8 역량 갭 분석...');
time('gap');
const gap = await analyzeGap(resumeText, jdText, instruction, companyCtx);
timeEnd('gap');
log('역량 갭', {
  전체매칭률: gap.matchRate,
  필수매칭률: gap.requiredMatchRate,
  종합평가: gap.overallAssessment,
  매칭수: gap.matches.filter(m => m.matched).length,
  갭수: gap.matches.filter(m => !m.matched).length,
});

// 5. ATS 점수
console.log('📝 5/8 ATS 분석...');
time('ats');
const ats = await analyzeAtsScore(resumeText, jdText, JSON.stringify(instruction));
timeEnd('ats');
log('ATS 점수', {
  overall: ats.overall,
  keywordMatch: ats.keywordMatch,
  formatCompliance: ats.formatCompliance,
  키워드수: ats.keywords?.length,
  이슈수: ats.formatIssues?.length,
});

// 6. 상세 점수
console.log('📈 6/8 상세 점수...');
time('detailed');
const detailed = await analyzeDetailedScore(resumeText, jdText, JSON.stringify(instruction));
timeEnd('detailed');
log('상세 점수', {
  overall: detailed.overall,
  coreSkills: detailed.breakdown?.coreSkills?.score,
  experience: detailed.breakdown?.experience?.score,
  impact: detailed.breakdown?.impact?.score,
  readability: detailed.breakdown?.readability?.score,
  약한동사수: detailed.actionVerbs?.weak?.length,
  수치화필요: detailed.quantification?.needsQuantification?.length,
});

// 7. 면접 질문
console.log('🎤 7/8 면접 질문...');
time('interview');
const questions = await generateInterviewQuestions(resumeText, jdText, instruction);
timeEnd('interview');
log('면접 질문', {
  총질문수: questions.length,
  질문목록: questions.map((q: any) => `[${q.type}] ${q.question?.slice(0, 60)}`),
});

// 8. 실무자 시선
console.log('👁 8/8 실무자 시선...');
time('practitioner');
const practitioner = await generatePractitionerReview(resumeText, jdText, instruction);
timeEnd('practitioner');
log('실무자 시선', {
  관점: practitioner.perspective,
  업종: practitioner.industry,
  인상: practitioner.overallImpression?.slice(0, 150),
  추천: practitioner.hiringRecommendation,
  강점: practitioner.strengths?.slice(0, 3),
  우려: practitioner.concerns?.slice(0, 3),
});

// 결과 저장
const report = JSON.stringify(outputs, null, 2);
writeFileSync('/tmp/resummeter-all-outputs.json', report);
console.log('\n' + '='.repeat(50));
console.log('전체 테스트 완료. /tmp/resummeter-all-outputs.json에 저장됨');
console.log('='.repeat(50));
