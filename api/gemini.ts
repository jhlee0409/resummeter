/**
 * Vercel Serverless Function — POST /api/gemini
 * 클라이언트의 Gemini 요청을 서버사이드에서 대리 실행한다. 키는 서버 환경변수에만 존재.
 */
// ESM(type:module) 런타임에서 상대 임포트는 확장자 필수. tsc(bundler)는 .ts로 매핑.
import { handleGemini, type GeminiProxyBody } from "./_gemini.js";

// req/res는 Vercel Node 런타임이 주입 (@vercel/node 미설치 → 구조적 타입)
interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "POST 요청만 허용됩니다." } });
    return;
  }

  // Vercel은 application/json 본문을 자동 파싱하지만, 문자열로 올 경우 대비
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: { message: "본문 JSON 파싱 실패" } });
      return;
    }
  }

  const result = await handleGemini(body as GeminiProxyBody, process.env.GEMINI_API_KEY);
  res.status(result.status).json(result.json);
}
