/**
 * 서술형 생성 테스트: 채널톡 FDE 필수 질문 2개
 * 실행: npx tsx scripts/test-narrative.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../core/analysis/jdAnalysis');
const { coachResume } = await import('../core/analysis/coaching');
const { generateNarrativeSections } = await import('../features/narrative/service');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');
import type { NarrativeSectionSpec } from '../types';

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

console.log('='.repeat(60));
console.log('서술형 생성 테스트 — 채널톡 FDE 필수 질문');
console.log('='.repeat(60));

// Step 1: JD 분석
console.log('\n📋 JD 분석 중...');
const instruction = await generateTailoredInstruction(jdText);
console.log('  완료');

// Step 2: 회사+직무 리서치
console.log('\n🏢 회사+직무 정보 수집 중...');
const companyName = '채널톡';
const [companyInfo, roleInfo] = await Promise.all([
  researchCompany(companyName),
  researchJobRole('Forward Deployed Engineer', companyName),
]);
const companyCtx = mergeResearchResults(companyInfo, roleInfo);
console.log(`  완료 (${companyCtx?.companyName}, 신뢰도 ${Math.round((companyCtx?.confidence || 0) * 100)}%)`);

// Step 3: 코칭 (서술형 생성에 필요)
console.log('\n🎯 코칭 분석 중...');
const coachResult = await coachResume({
  resumeText,
  jobDescription: jdText,
  instruction,
  githubRepos: [{ url: '', description: '' }],
  githubData: undefined,
  onStageChange: (stage) => process.stdout.write(`  ${stage}...`),
});
console.log('\n  완료');

// Step 4: 서술형 생성 — 채널톡 필수 질문 2개
const specs: NarrativeSectionSpec[] = [
  {
    id: 'q1-ai-business',
    type: 'custom',
    framework: 'k-star-k',
    charLimit: 1500,
    customTitle: 'AI를 활용해 비즈니스 문제를 해결해본 경험',
    prompt: '어떤 문제였는지, 어떤 AI 도구를 어떻게 사용했는지, 결과가 어땠는지를 구체적으로 적어주세요. 사이드 프로젝트, 인턴, 학교 과제 모두 가능합니다.',
  },
  {
    id: 'q2-customer-discovery',
    type: 'custom',
    framework: 'k-star-k',
    charLimit: 1500,
    customTitle: '고객 또는 현장 사용자를 직접 만나 비즈니스 문제를 발견한 경험',
    prompt: '어떤 맥락에서 누구를 만났는지, 무엇을 발견했는지, 이후 어떤 행동을 했는지를 적어주세요. 규모와 무관하게 본인이 직접 움직인 경험이라면 충분합니다.',
  },
];

console.log('\n✍️  서술형 생성 중...');
const startNarr = Date.now();
const narrativeResult = await generateNarrativeSections(
  specs, instruction, resumeText, jdText,
  [{ url: '', description: '' }], undefined, coachResult,
  (completed, total) => console.log(`  ${completed}/${total} 완료`)
);
console.log(`  생성 완료 (${Math.round((Date.now() - startNarr) / 1000)}초)`);

// 결과 출력
for (const section of narrativeResult.sections) {
  console.log('\n' + '='.repeat(60));
  console.log(`📝 ${section.title}`);
  console.log(`   프레임워크: ${section.framework} | ${section.charCount}/${section.charLimit}자 | 상태: ${section.status}`);
  console.log('='.repeat(60));

  if (section.status === 'error') {
    console.log(`   ❌ 에러: ${section.errorMessage}`);
    continue;
  }

  console.log('\n[본문]');
  console.log(section.content);

  if (section.kStarKBreakdown) {
    console.log('\n[K-STAR-K 구조 분석]');
    const b = section.kStarKBreakdown;
    console.log(`  K(결론): ${b.conclusion?.slice(0, 100)}...`);
    console.log(`  S(상황): ${b.situation?.slice(0, 100)}...`);
    console.log(`  T(과제): ${b.task?.slice(0, 100)}...`);
    console.log(`  A(행동): ${b.action?.slice(0, 100)}...`);
    console.log(`  R(결과): ${b.result?.slice(0, 100)}...`);
    console.log(`  K(가능성): ${b.potential?.slice(0, 100)}...`);
  }

  if (section.keywordsUsed.length > 0) {
    console.log(`\n[활용 키워드] ${section.keywordsUsed.join(', ')}`);
  }
  if (section.githubEvidences.length > 0) {
    console.log(`[GitHub 근거] ${section.githubEvidences.join(' | ')}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('서술형 테스트 완료');
console.log('='.repeat(60));
