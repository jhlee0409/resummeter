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

import { GoogleGenAI } from "@google/genai";
import type { TailoredInstructionWithRequirements, GithubRepo } from "../../types";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  formatInstruction,
} from "../prompt/promptBlocks";

// ── 싱글톤 AI 인스턴스 (geminiService.ts와 공유) ─────────────
let _ai: GoogleGenAI | null = null;
export function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요."
      );
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
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
export type ModelTier = "flash" | "pro";

const MODEL_MAP: Record<ModelTier, string> = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3-pro-preview",
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
    // 캐시 생성 실패 (최소 토큰 미달 등) → 인라인 폴백
    console.warn(
      `[promptCache] ${tier} 캐시 생성 실패, 인라인 폴백 사용`
    );
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
 * generateContent 호출에 캐시를 적용합니다.
 * 캐시가 있으면 cachedContent를 사용하고,
 * 없으면 systemInstruction + 인라인 컨텍스트로 폴백합니다.
 */
export function applyCacheToConfig(
  session: SessionCache,
  taskPrompt: string,
  config: Record<string, unknown>
): { contents: string; config: Record<string, unknown> } {
  if (session.cacheName) {
    // 캐시 히트: 태스크 프롬프트만 전송
    return {
      contents: taskPrompt,
      config: { ...config, cachedContent: session.cacheName },
    };
  }

  // 캐시 미스: systemInstruction으로 공통 블록 분리 + 컨텍스트 인라인
  return {
    contents: `${session.contextBlock}\n\n${taskPrompt}`,
    config: { ...config, systemInstruction: session.systemPrompt },
  };
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

/**
 * systemInstruction만 사용하는 간단한 config 생성.
 * 캐싱이 불필요한 1회성 호출(JD 분석 등)에 사용합니다.
 */
export function withSystemInstruction(
  config: Record<string, unknown>,
  systemPrompt?: string
): Record<string, unknown> {
  return {
    ...config,
    systemInstruction: systemPrompt || COMMON_SYSTEM_PROMPT,
  };
}
