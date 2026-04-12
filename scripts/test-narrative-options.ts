/**
 * 서술형 옵션별 테스트 — 6 타입 × 2 프레임워크
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cached } from './testCache';
import type { NarrativeSectionSpec, NarrativeSectionResult, NarrativeGenerationResult } from '../types';

const envContent = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction, generateNarrativeSections, coachResume } = await import('../services/geminiService');
const { researchCompany, researchJobRole, mergeResearchResults } = await import('../core/research/companyResearch');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');
const company = '채널코퍼레이션';
const jobTitle = 'Forward Deployed Engineer';

// 사전 데이터 (캐시 사용)
const instruction = await cached('instruction', [jdText, company, jobTitle], () => generateTailoredInstruction(jdText, company, jobTitle));
const companyInfo = await cached('company', [company], () => researchCompany(company)).catch(() => null);
const jobRoleInfo = await cached('role', [jobTitle, company], () => researchJobRole(jobTitle, company)).catch(() => null);
const ctx = mergeResearchResults(companyInfo, jobRoleInfo);
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

// 테스트 케이스 정의
const testCases: Array<{ name: string; spec: NarrativeSectionSpec }> = [
  // K-STAR-K 프레임워크
  {
    name: 'K-STAR-K / 자기소개',
    spec: { id: 'ksk-intro', type: 'self-introduction', framework: 'k-star-k', charLimit: 500, prompt: '본인을 소개해주세요.' },
  },
  {
    name: 'K-STAR-K / 프로젝트 경험',
    spec: { id: 'ksk-project', type: 'career-project', framework: 'k-star-k', charLimit: 600, prompt: '가장 도전적이었던 프로젝트 경험을 기술해주세요.' },
  },
  {
    name: 'K-STAR-K / 지원동기',
    spec: { id: 'ksk-motivation', type: 'motivation', framework: 'k-star-k', charLimit: 500, prompt: '채널톡에 지원하게 된 동기를 기술해주세요.' },
  },
  {
    name: 'K-STAR-K / 성장계획',
    spec: { id: 'ksk-growth', type: 'growth-plan', framework: 'k-star-k', charLimit: 500, prompt: '입사 후 성장 계획을 기술해주세요.' },
  },
  // Tech Narrative 프레임워크
  {
    name: 'Tech / 기술역량',
    spec: { id: 'tech-skills', type: 'technical-skills', framework: 'tech-narrative', charLimit: 600, prompt: '본인의 핵심 기술 역량을 기술해주세요.' },
  },
  {
    name: 'Tech / 프로젝트 경험',
    spec: { id: 'tech-project', type: 'career-project', framework: 'tech-narrative', charLimit: 600, prompt: '기술적으로 가장 도전적이었던 프로젝트를 기술해주세요.' },
  },
  // Custom
  {
    name: 'K-STAR-K / Custom 질문',
    spec: { id: 'ksk-custom', type: 'custom', framework: 'k-star-k', charLimit: 500, customTitle: 'AI 활용 경험', prompt: 'AI를 활용하여 문제를 해결한 경험을 기술해주세요.' },
  },
];

console.log(`\n━━━ 서술형 옵션별 테스트 (${testCases.length}건) ━━━\n`);

// generateNarrativeSections로 일괄 실행 (usedExperiences 누적 동작)
const allSpecs = testCases.map(tc => tc.spec);
const allResults = await cached<NarrativeGenerationResult>(
  'narrative-batch',
  [allSpecs.map(s => s.id).join(','), resumeText.slice(0, 100)],
  () => generateNarrativeSections(allSpecs, instruction, resumeText, jdText, [{ url: '', description: '' }], undefined, coach, (i, t) => process.stdout.write(`\r  진행: ${i}/${t}`), ctx)
);
console.log('');

let pass = 0, fail = 0;

for (let idx = 0; idx < testCases.length; idx++) {
  const { name, spec } = testCases[idx];
  process.stdout.write(`${name}... `);

  try {
    const result = allResults.sections[idx];

    const checks: string[] = [];
    let ok = true;

    // 기본 검증
    if (result.status !== 'success') { checks.push(`status=${result.status}`); ok = false; }
    if (!result.content || result.content.length < 50) { checks.push(`content=${result.content?.length ?? 0}자(너무 짧음)`); ok = false; }
    if (result.charCount > spec.charLimit * 1.2) { checks.push(`초과: ${result.charCount}/${spec.charLimit}`); ok = false; }

    // 프레임워크별 검증
    if (spec.framework === 'k-star-k') {
      if (!result.kStarKBreakdown) { checks.push('kStarKBreakdown 없음'); ok = false; }
      else {
        const b = result.kStarKBreakdown;
        if (!b.conclusion) checks.push('conclusion 없음');
        if (!b.situation) checks.push('situation 없음');
        if (!b.task) checks.push('task 없음');
        if (!b.action) checks.push('action 없음');
        if (!b.result) checks.push('result 없음');
        if (checks.length > 0) ok = false;
      }
    } else {
      if (!result.techNarrativeBreakdown) { checks.push('techNarrativeBreakdown 없음'); ok = false; }
      else {
        const b = result.techNarrativeBreakdown;
        if (!b.problemDefinition) checks.push('problemDefinition 없음');
        if (!b.technicalApproach) checks.push('technicalApproach 없음');
        if (!b.implementation) checks.push('implementation 없음');
        if (!b.impact) checks.push('impact 없음');
        if (checks.length > 0) ok = false;
      }
    }

    if (ok) {
      pass++;
      const breakdown = spec.framework === 'k-star-k'
        ? `K=${result.kStarKBreakdown!.conclusion.slice(0, 20)}...`
        : `P=${result.techNarrativeBreakdown!.problemDefinition.slice(0, 20)}...`;
      console.log(`✅ ${result.charCount}/${spec.charLimit}자, keywords=${result.keywordsUsed.length}, ${breakdown}`);
    } else {
      fail++;
      console.log(`❌ ${checks.join(', ')}`);
    }

    // 본문 첫 줄 출력
    console.log(`    "${result.content?.slice(0, 80)}..."`);

  } catch (e: any) {
    fail++;
    console.log(`❌ ERROR: ${e.message?.slice(0, 80)}`);
  }
}

console.log(`\n━━━ 결과: ${pass} pass / ${fail} fail ━━━`);
if (fail > 0) process.exit(1);
