/**
 * 서술형 아웃풋 품질 점검 — 전문 출력 + AI탐지 + HR 관점 체크
 */
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { getCached } from './testCache';
import type { NarrativeSectionResult } from '../types';

const CACHE_DIR = '/tmp/resummeter-test-cache';
const narrativeFiles = readdirSync(CACHE_DIR).filter(f => f.startsWith('narrative-'));

// AI 탐지 금지 단어
const AI_BANNED = ['활용하여', '기반으로', '통해', '바탕으로'];
const AI_CLICHES = ['열정적으로', '끊임없이', '다양한 경험을 통해', '폭넓은 시야', '항상 도전'];
const VAGUE = ['다양한', '효율적인', '체계적인', '적극적으로', '주도적으로'];

for (const file of narrativeFiles) {
  const raw = JSON.parse(readFileSync(`${CACHE_DIR}/${file}`, 'utf-8'));
  const r = raw.data as NarrativeSectionResult;
  
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`📝 ${r.title || r.specId} (${r.framework}, ${r.charCount}/${r.charLimit}자)`);
  console.log(`${'━'.repeat(60)}`);
  
  // 전문 출력
  console.log(`\n${r.content}\n`);
  
  // 구조 분해
  if (r.kStarKBreakdown) {
    const b = r.kStarKBreakdown;
    console.log(`[K-STAR-K 구조]`);
    console.log(`  K(결론): ${b.conclusion.slice(0, 60)}...`);
    console.log(`  S(상황): ${b.situation.slice(0, 60)}...`);
    console.log(`  T(과제): ${b.task.slice(0, 60)}...`);
    console.log(`  A(행동): ${b.action.slice(0, 60)}...`);
    console.log(`  R(결과): ${b.result.slice(0, 60)}...`);
    if (b.potential) console.log(`  K(잠재력): ${b.potential.slice(0, 60)}...`);
  }
  if (r.techNarrativeBreakdown) {
    const b = r.techNarrativeBreakdown;
    console.log(`[Tech Narrative 구조]`);
    console.log(`  문제정의: ${b.problemDefinition.slice(0, 60)}...`);
    console.log(`  기술접근: ${b.technicalApproach.slice(0, 60)}...`);
    console.log(`  구현: ${b.implementation.slice(0, 60)}...`);
    console.log(`  임팩트: ${b.impact.slice(0, 60)}...`);
  }
  
  // 품질 체크
  const content = r.content || '';
  const issues: string[] = [];
  
  // 1. AI 금지 단어 빈도
  for (const word of AI_BANNED) {
    const count = (content.match(new RegExp(word, 'g')) || []).length;
    if (count > 1) issues.push(`"${word}" ${count}회 (1회 이하 권장)`);
  }
  
  // 2. AI 클리셰
  for (const phrase of AI_CLICHES) {
    if (content.includes(phrase)) issues.push(`클리셰: "${phrase}"`);
  }
  
  // 3. 모호한 표현
  const vagueCount = VAGUE.filter(v => content.includes(v)).length;
  if (vagueCount >= 3) issues.push(`모호한 표현 ${vagueCount}개: ${VAGUE.filter(v => content.includes(v)).join(', ')}`);
  
  // 4. 구체적 수치 존재 여부
  const numbers = content.match(/\d+[%명건초개월주일시간만억원]/g) || [];
  if (numbers.length === 0) issues.push('구체적 수치 없음');
  
  // 5. 문장 길이 변화 (perplexity/burstiness)
  const sentences = content.split(/[.!?。]\s*/).filter(s => s.length > 5);
  const lengths = sentences.map(s => s.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = Math.sqrt(lengths.reduce((a, b) => a + (b - avgLen) ** 2, 0) / lengths.length);
  if (stdDev < 8) issues.push(`문장 길이 편차 ${stdDev.toFixed(1)} (너무 균일, AI냄새)`);
  
  // 6. 첫 문장이 구체적인가
  const firstSentence = sentences[0] || '';
  if (firstSentence.includes('저는') && firstSentence.includes('입니다')) {
    issues.push(`첫 문장 패턴: "저는 ~입니다" (뻔한 서론)`);
  }
  
  // 7. 플레이스홀더 잔존
  const placeholders = content.match(/\[.*?\]/g) || [];
  if (placeholders.length > 0) issues.push(`플레이스홀더 ${placeholders.length}개: ${placeholders.join(', ')}`);
  
  // 8. keywords 자연 삽입
  console.log(`[키워드] ${r.keywordsUsed.join(', ')}`);
  console.log(`[수치] ${numbers.length > 0 ? numbers.join(', ') : '없음'}`);
  console.log(`[문장수] ${sentences.length}개, 평균 ${avgLen.toFixed(0)}자, 편차 ${stdDev.toFixed(1)}`);
  
  if (issues.length === 0) {
    console.log(`[품질] ✅ 이슈 없음`);
  } else {
    console.log(`[품질] ⚠️ ${issues.length}건:`);
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }
}
