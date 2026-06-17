// ─────────────────────────────────────────────────────────────
// Context Caching — 세션별 공통 프롬프트 캐싱
// ─────────────────────────────────────────────────────────────
//
// Gemini Context Caching을 사용하여 동일 세션 내 반복 호출 시
// 공통 컨텍스트(시스템 프롬프트 + 이력서 + JD + instruction)를
// 한 번만 전송하고 캐시를 재사용합니다.
//
// 사용 흐름:
// 1. Stage 1(JD 분석) 완료 후 getOrCreateSessionCache() 호출
// 2. 이후 모든 API 호출에서 cachedContent를 config에 전달
// 3. 새 세션 시작 시 invalidateCache() 호출
//
// 참고: Gemini 캐싱은 최소 토큰 제한이 있을 수 있으며,
// 실패 시 자동으로 인라인 폴백합니다.
// ─────────────────────────────────────────────────────────────

import type { TailoredInstructionWithRequirements, GithubRepo } from "../../types";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  formatInstruction,
} from "../prompt/promptBlocks";

// ── Gemini 프록시 클라이언트 ─────────────────────────────────
// 키는 서버(/api/gemini)에만 존재. 클라이언트는 동일 인터페이스 shim을 통해
// 모든 호출을 서버사이드로 위임한다 (브라우저 번들에 키 노출 없음).
export interface ProxyGenerateResponse {
  text: string;
  // grounding metadata 등 SDK 응답 구조를 그대로 통과 → 소비처 호환 위해 any[]
  candidates?: any[];
}

async function callProxy(kind: string, payload: unknown): Promise<any> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // retry.ts/classifyError가 메시지 문자열로 판별(429/timeout 등) → 상태코드 포함해 throw
    const message = (data as { error?: { message?: string } })?.error?.message || "Gemini 요청 실패";
    throw new Error(`${res.status} ${message}`);
  }
  return data;
}

/** GoogleGenAI와 동일한 호출 형태를 유지하는 프록시 shim */
export function getAI() {
  return {
    models: {
      generateContent: (params: unknown): Promise<ProxyGenerateResponse> =>
        callProxy("generate", params),
    },
    caches: {
      create: (params: unknown): Promise<{ name: string | null }> =>
        callProxy("cacheCreate", params),
      delete: (params: { name: string }): Promise<{ ok: boolean }> =>
        callProxy("cacheDelete", params),
    },
  };
}

// ── 캐시 상태 ────────────────────────────────────────────────
export interface SessionCache {
  /** Gemini 캐시 리소스 이름 (e.g., "cachedContents/abc123") */
  cacheName: string | null;
  /** 캐시 생성에 사용된 데이터의 해시 (변경 감지용) */
  fingerprint: string;
  /** 캐시 생성에 실패했을 때 인라인 폴백용 시스템 프롬프트 */
  systemPrompt: string;
  /** 캐시 생성에 실패했을 때 인라인 폴백용 컨텍스트 */
  contextBlock: string;
}

let _flashCache: SessionCache | null = null;
let _proCache: SessionCache | null = null;

// ── 공통 시스템 프롬프트 (모든 프롬프트에 공통) ──────────────
const COMMON_SYSTEM_PROMPT = [
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
].join("\n\n");

// ── 해시 생성 (간단한 fingerprint) ───────────────────────────
function fingerprint(
  resume: string,
  jd: string,
  instruction: TailoredInstructionWithRequirements
): string {
  // 간단한 해시: 길이 + 앞 100자로 변경 감지
  return `${resume.length}:${jd.length}:${resume.slice(0, 100)}:${jd.slice(0, 100)}:${instruction.persona}`;
}

// ── 컨텍스트 블록 생성 ───────────────────────────────────────
function buildContextBlock(
  resume: string,
  jd: string,
  instruction: TailoredInstructionWithRequirements,
  repos?: GithubRepo[]
): string {
  const parts = [
    formatInstruction(instruction),
    `<user-resume>\n${resume}\n</user-resume>`,
    `<user-jd>\n${jd}\n</user-jd>`,
  ];
  if (repos && repos.length > 0) {
    const repoInfo = repos
      .map(
        (r) =>
          `- ${r.name}: ${r.description || "설명 없음"} (${r.language || "N/A"}, ⭐${r.stars || 0})`
      )
      .join("\n");
    parts.push(`<github-repos>\n${repoInfo}\n</github-repos>`);
  }
  return parts.join("\n\n");
}

// ── 캐시 생성/조회 ──────────────────────────────────────────
export type ModelTier = "flash" | "pro" | "flash-lite";

export const MODELS = {
  flash: "gemini-3.5-flash",
  pro: "gemini-3.1-pro-preview",
  flashLite: "gemini-2.5-flash-lite",
} as const;

const MODEL_MAP: Record<ModelTier, string> = {
  flash: MODELS.flash,
  pro: MODELS.pro,
  "flash-lite": MODELS.flashLite,
};

/**
 * 세션 캐시를 생성하거나 기존 캐시를 반환합니다.
 * 캐시 생성 실패 시 null cacheName으로 폴백합니다.
 */
export async function getOrCreateSessionCache(
  tier: ModelTier,
  resume: string,
  jd: string,
  instruction: TailoredInstructionWithRequirements,
  repos?: GithubRepo[]
): Promise<SessionCache> {
  const fp = fingerprint(resume, jd, instruction);
  const existing = tier === "flash" ? _flashCache : _proCache;

  // 동일 데이터면 기존 캐시 재사용
  if (existing && existing.fingerprint === fp) {
    return existing;
  }

  const systemPrompt = COMMON_SYSTEM_PROMPT;
  const contextBlock = buildContextBlock(resume, jd, instruction, repos);

  let cacheName: string | null = null;

  // Gemini Context Caching은 모델별 최소 토큰(현재 pro ≈1024, 2.5-pro ≈2048)이 있어
  // 작은 입력은 400을 반환한다. 미달이 명백하면 생성 시도(불필요한 round-trip + 콘솔
  // 노이즈)를 건너뛰고 바로 인라인 폴백한다. 큰 입력만 캐싱 → 경계값은 try/catch가 처리.
  const MIN_CACHE_CHARS = 4000; // ≈ 1024+ 토큰 (한/영 혼합 보수 추정)
  if (systemPrompt.length + contextBlock.length >= MIN_CACHE_CHARS) {
    try {
      const cache = await getAI().caches.create({
        model: MODEL_MAP[tier],
        config: {
          displayName: `resummeter-${tier}-session`,
          systemInstruction: systemPrompt,
          contents: [{ role: "user", parts: [{ text: contextBlock }] }],
          ttl: "1800s", // 30분
        },
      });
      cacheName = cache.name ?? null;
    } catch {
      // 캐시 생성 실패 (추정과 달리 최소 토큰 미달 등) → 인라인 폴백
      console.warn(
        `[promptCache] ${tier} 캐시 생성 실패, 인라인 폴백 사용`
      );
    }
  }

  const session: SessionCache = {
    cacheName,
    fingerprint: fp,
    systemPrompt,
    contextBlock,
  };

  if (tier === "flash") _flashCache = session;
  else _proCache = session;

  return session;
}

/**
 * 세션 캐시가 있으면 cachedContent, 없으면 systemInstruction 반환.
 * analyzeResume, generateCoaching처럼 프롬프트에 컨텍스트가 인라인으로 있는 경우 사용.
 */
export function getCacheFields(
  sessionCache: SessionCache | null | undefined,
  systemBlocks: string[],
): { cachedContent: string } | { systemInstruction: string } {
  if (sessionCache?.cacheName) return { cachedContent: sessionCache.cacheName };
  return { systemInstruction: systemBlocks.join('\n\n') };
}

/**
 * 세션 캐시를 무효화합니다.
 * 새 이력서/JD 입력 시 호출하세요.
 */
export async function invalidateCache(): Promise<void> {
  const ai = getAI();

  for (const cache of [_flashCache, _proCache]) {
    if (cache?.cacheName) {
      try {
        await ai.caches.delete({ name: cache.cacheName });
      } catch {
        // 이미 만료되었거나 삭제된 캐시 무시
      }
    }
  }

  _flashCache = null;
  _proCache = null;
}
