/**
 * keywordAliases 단일 테스트 — 채널톡 JD
 * 실행: npx tsx scripts/test-keyword-aliases.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { generateTailoredInstruction } = await import('../services/geminiService');
const { calculateScore, LEVEL_LABELS } = await import('../core/scoring/scoringEngine');

const resumeText = readFileSync('/tmp/resummeter-resume.txt', 'utf-8');
const jdText = readFileSync('/tmp/resummeter-jd.txt', 'utf-8');

console.log('=== keywordAliases 테스트 ===\n');

const instruction = await generateTailoredInstruction(jdText);

console.log('키워드:', instruction.keywords);
console.log('\nkeywordAliases:');
if (instruction.keywordAliases && instruction.keywordAliases.length > 0) {
  for (const entry of instruction.keywordAliases) {
    console.log(`  ${entry.keyword} → [${entry.aliases.join(', ')}]`);
  }
} else {
  console.log('  (없음 — 스키마 미반영?)');
}

console.log('\njdRequirements importance:');
if (instruction.jdRequirements) {
  for (const req of instruction.jdRequirements) {
    console.log(`  [${req.importance}] ${req.category}: ${req.text.slice(0, 60)}`);
  }
}

console.log('\n--- Scoring ---');
const scoring = calculateScore(
  [
    { requirement: 'TypeScript', category: 'hard-skill', currentLevel: 'strong', jdMentions: 3, resumeMentions: 5, relatedActions: [], suggestion: '' },
    { requirement: 'AI 경험', category: 'hard-skill', currentLevel: 'strong', jdMentions: 2, resumeMentions: 3, relatedActions: [], suggestion: '' },
    { requirement: '커뮤니케이션', category: 'soft-skill', currentLevel: 'strong', jdMentions: 2, resumeMentions: 2, relatedActions: [], suggestion: '' },
    { requirement: '경력', category: 'experience', currentLevel: 'strong', jdMentions: 1, resumeMentions: 1, relatedActions: [], suggestion: '' },
  ],
  instruction,
  resumeText,
  jdText
);

const levelInfo = LEVEL_LABELS[scoring.level];
console.log(`점수: ${scoring.matchScore} → ${levelInfo.label}`);
console.log(`감점 내역:`);
for (const p of scoring.penalties) {
  console.log(`  -${p.points} [${p.category}] ${p.reason}`);
}
console.log(`breakdown: HR=${scoring.breakdown.hardRequirement} HS=${scoring.breakdown.hardSkill} EX=${scoring.breakdown.experience} SS=${scoring.breakdown.softSkill} DM=${scoring.breakdown.domain}`);
