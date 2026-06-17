/**
 * 서버사이드 Gemini 프록시 핸들러 (공유 로직).
 * Vercel 함수(api/gemini.ts)와 Vite dev 미들웨어가 함께 사용한다.
 * GEMINI_API_KEY는 이 서버 컨텍스트에서만 쓰이며 클라이언트 번들에 절대 포함되지 않는다.
 */
import { GoogleGenAI } from "@google/genai";

export type GeminiProxyBody =
  | { kind: "generate"; payload: Record<string, unknown> }
  | { kind: "cacheCreate"; payload: Record<string, unknown> }
  | { kind: "cacheDelete"; payload: { name: string } };

export interface ProxyResult {
  status: number;
  json: unknown;
}

// 세션 내 동일 키 재사용 (콜드스타트마다 1회 생성)
let _ai: GoogleGenAI | null = null;
let _aiKey: string | null = null;
function client(apiKey: string): GoogleGenAI {
  if (!_ai || _aiKey !== apiKey) {
    _ai = new GoogleGenAI({ apiKey });
    _aiKey = apiKey;
  }
  return _ai;
}

export async function handleGemini(
  body: GeminiProxyBody | undefined,
  apiKey: string | undefined,
): Promise<ProxyResult> {
  if (!apiKey) {
    return { status: 500, json: { error: { message: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." } } };
  }
  if (!body || typeof body !== "object" || !("kind" in body)) {
    return { status: 400, json: { error: { message: "잘못된 요청 형식입니다." } } };
  }

  const ai = client(apiKey);

  try {
    switch (body.kind) {
      case "generate": {
        // payload = { model, contents, config } — SDK에 그대로 전달
        const res = await ai.models.generateContent(body.payload as unknown as Parameters<typeof ai.models.generateContent>[0]);
        // 클라이언트가 쓰는 필드만 반환 (text getter 평가 + grounding용 candidates)
        return { status: 200, json: { text: res.text ?? "", candidates: res.candidates ?? [] } };
      }
      case "cacheCreate": {
        const cache = await ai.caches.create(body.payload as unknown as Parameters<typeof ai.caches.create>[0]);
        return { status: 200, json: { name: cache.name ?? null } };
      }
      case "cacheDelete": {
        await ai.caches.delete({ name: body.payload.name });
        return { status: 200, json: { ok: true } };
      }
      default:
        return { status: 400, json: { error: { message: "알 수 없는 요청 종류입니다." } } };
    }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 502;
    const message = err?.message || "Gemini 요청 처리 중 오류가 발생했습니다.";
    return { status, json: { error: { message, status } } };
  }
}
