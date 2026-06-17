/**
 * POC-B: 멀티모달 증빙 해석 검증 (throwaway)
 *
 * 검증 질문: PDF/이미지를 inlineData로 Gemini에 직접 넘겨
 * 직무 맥락의 구조화 증빙을 환각 없이 뽑는가?
 *
 * 사전 준비(헤드리스 Chrome으로 생성됨):
 *   /tmp/poc-sales-record.png  — 영업 실적표(표+막대차트) 이미지
 *   /tmp/poc-portfolio.pdf     — 디자이너 포트폴리오 PDF(레이아웃/색상)
 *
 * 실행: npx tsx scripts/poc-multimodal.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const apiKey = envContent.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY not found");
  process.exit(1);
}
process.env.GEMINI_API_KEY = apiKey;
process.env.API_KEY = apiKey;

const { Type, ThinkingLevel } = await import("@google/genai");
const { getAI, MODELS } = await import("../shared/api/geminiClient");

// 기존 Evidence 타입과 동일한 형태로 추출
const evidenceSchema = {
  type: Type.OBJECT,
  properties: {
    fileSummary: { type: Type.STRING, description: "이 파일이 무엇인지 1문장 요약" },
    evidences: {
      type: Type.ARRAY,
      description: "파일에서 추출한 직무 관련 증빙 항목들",
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "증빙 내용 (구체적 수치/사실 포함)" },
          source: { type: Type.STRING, description: "파일 내 출처 (예: '실적표 3Q 행', '결제 플로우 케이스')" },
          confidence: { type: Type.STRING, description: "'verified'(파일에 명시됨) | 'inferred'(추론)" },
        },
        required: ["content", "source", "confidence"],
      },
    },
    hallucinationCheck: {
      type: Type.STRING,
      description: "파일에 없는 내용을 지어내지 않았는지 자기검증 결과 1문장",
    },
  },
  required: ["fileSummary", "evidences", "hallucinationCheck"],
};

async function interpret(filePath: string, mimeType: string, jobContext: string) {
  const data = readFileSync(filePath).toString("base64");
  const prompt = `당신은 채용 증빙 자료를 해석하는 전문가다. 첨부된 파일을 분석하여, "${jobContext}" 직무 지원자의 역량을 보여주는 증빙을 구조화하여 추출하라.

[규칙]
- 파일에 실제로 있는 내용만 추출하라. 없는 수치나 사실을 절대 지어내지 마라.
- 표/차트/이미지의 시각 정보(숫자, 추세)도 읽어내라.
- 각 증빙은 가능한 구체적 수치를 포함하라.`;

  const res = await getAI().models.generateContent({
    model: MODELS.flash,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType, data } }],
      },
    ],
    config: {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: "application/json",
      responseSchema: evidenceSchema,
    },
  });
  return JSON.parse(res.text ?? "{}");
}

function dump(title: string, r: any) {
  console.log(`\n━━━━━━━━━━ ${title} ━━━━━━━━━━`);
  console.log(`fileSummary : ${r.fileSummary}`);
  console.log(`증빙 ${r.evidences?.length ?? 0}개:`);
  for (const e of r.evidences ?? []) {
    console.log(`  • [${e.confidence}] ${e.content}`);
    console.log(`      ↳ 출처: ${e.source}`);
  }
  console.log(`환각 자기검증: ${r.hallucinationCheck}`);
}

console.log("═══════════ POC-B: 멀티모달 증빙 해석 검증 ═══════════");

try {
  const png = await interpret("/tmp/poc-sales-record.png", "image/png", "B2B 엔터프라이즈 영업");
  dump("① 영업 실적표 PNG (표+막대차트 → 시각 정보 판독)", png);
} catch (e) {
  console.error(`① ❌ PNG 실패: ${(e as Error).message}`);
}

try {
  const pdf = await interpret("/tmp/poc-portfolio.pdf", "application/pdf", "프로덕트 디자이너");
  dump("② 디자이너 포트폴리오 PDF (레이아웃/색상)", pdf);
} catch (e) {
  console.error(`② ❌ PDF 실패: ${(e as Error).message}`);
}

console.log("\n═══════════ 완료 — 위 결과 수동 검수 ═══════════");
console.log("검수 포인트: (1) 차트의 131% 등 시각 수치를 읽었나 (2) 파일에 없는 내용 지어내지 않았나");
