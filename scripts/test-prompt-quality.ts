/**
 * 프롬프트 퀄리티 검증 — 구조 수정 전/후 비교
 * Fix 1 검증: instruction에 companyName/jobTitle 주입 효과
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

const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

console.log('━━━ A: 회사/직무 없이 (기존 방식) ━━━');
const instrA = await generateTailoredInstruction(jdText);
console.log('persona:', instrA.persona);
console.log('keywords:', instrA.keywords.join(', '));
if (instrA.keywordAliases?.length) {
  console.log('aliases:');
  for (const a of instrA.keywordAliases.slice(0, 3)) {
    console.log(`  ${a.keyword} → [${a.aliases.join(', ')}]`);
  }
}
console.log('jdReqs:', instrA.jdRequirements?.length, '개');

console.log('\n━━━ B: 채널코퍼레이션 / FDE (회사+직무 주입) ━━━');
const instrB = await generateTailoredInstruction(jdText, '채널코퍼레이션', 'Forward Deployed Engineer');
console.log('persona:', instrB.persona);
console.log('keywords:', instrB.keywords.join(', '));
if (instrB.keywordAliases?.length) {
  console.log('aliases:');
  for (const a of instrB.keywordAliases.slice(0, 3)) {
    console.log(`  ${a.keyword} → [${a.aliases.join(', ')}]`);
  }
}
console.log('jdReqs:', instrB.jdRequirements?.length, '개');

// 차이 분석
const onlyInA = instrA.keywords.filter(k => !instrB.keywords.includes(k));
const onlyInB = instrB.keywords.filter(k => !instrA.keywords.includes(k));
console.log('\n━━━ 키워드 차이 ━━━');
console.log('A에만 있는:', onlyInA.join(', ') || '(없음)');
console.log('B에만 있는:', onlyInB.join(', ') || '(없음)');
console.log('공통:', instrA.keywords.filter(k => instrB.keywords.includes(k)).length, '개');
