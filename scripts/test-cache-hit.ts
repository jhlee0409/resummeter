import { readFileSync } from 'fs';
import { resolve } from 'path';
const envContent = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf-8');
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { researchCompany, researchJobRole } = await import('../core/research/companyResearch');

// 1차: API 호출
const t1 = Date.now();
const r1 = await researchCompany('채널코퍼레이션');
console.log(`1차 회사: ${Date.now() - t1}ms → ${r1.techStack.slice(0, 3).join(', ')}`);

// 2차: 메모리 캐시 히트
const t2 = Date.now();
const r2 = await researchCompany('채널코퍼레이션');
console.log(`2차 회사: ${Date.now() - t2}ms → ${r2.techStack.slice(0, 3).join(', ')} (캐시 ${Date.now() - t2 < 5 ? 'HIT' : 'MISS'})`);

// 직무도 테스트
const t3 = Date.now();
const j1 = await researchJobRole('Forward Deployed Engineer', '채널코퍼레이션');
console.log(`1차 직무: ${Date.now() - t3}ms → ${j1.roleKeyTraits.slice(0, 2).join(', ')}`);

const t4 = Date.now();
const j2 = await researchJobRole('Forward Deployed Engineer', '채널코퍼레이션');
console.log(`2차 직무: ${Date.now() - t4}ms → ${j2.roleKeyTraits.slice(0, 2).join(', ')} (캐시 ${Date.now() - t4 < 5 ? 'HIT' : 'MISS'})`);
