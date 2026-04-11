/**
 * 테스트용 디스크 캐시 — API 호출 결과를 /tmp에 저장하여 재사용.
 * 같은 입력이면 API 안 치고 파일에서 로드.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const CACHE_DIR = '/tmp/resummeter-test-cache';

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function hashKey(...parts: string[]): string {
  return createHash('md5').update(parts.join('|')).digest('hex').slice(0, 12);
}

export function getCached<T>(namespace: string, ...keyParts: string[]): T | null {
  const file = `${CACHE_DIR}/${namespace}-${hashKey(...keyParts)}.json`;
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf-8');
    const { data, ts } = JSON.parse(raw);
    // 24시간 TTL
    if (Date.now() - ts > 24 * 60 * 60 * 1000) return null;
    console.log(`  [cache] ${namespace} HIT`);
    return data as T;
  } catch {
    return null;
  }
}

export function setCache<T>(namespace: string, data: T, ...keyParts: string[]): T {
  const file = `${CACHE_DIR}/${namespace}-${hashKey(...keyParts)}.json`;
  try {
    writeFileSync(file, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* silent */ }
  return data;
}

/**
 * 캐시 래퍼: 캐시에 있으면 반환, 없으면 fn() 실행 후 저장.
 */
export async function cached<T>(namespace: string, keyParts: string[], fn: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(namespace, ...keyParts);
  if (hit) return hit;
  const result = await fn();
  return setCache(namespace, result, ...keyParts);
}
