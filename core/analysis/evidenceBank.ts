import { Type, ThinkingLevel } from "@google/genai";
import { TailoredInstructionWithRequirements, GitHubFetchResult, EvidenceBank, Evidence, EvidenceInput } from "../../types";
import { getAI, MODELS } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { safeParseJSON } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import {
  GROUNDING_FULL,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { resolveJobProfile } from "../research/industryDetect";

// ─────────────────────────────────────────────────────────────
// Stage 3: enrichEvidenceBank (Flash) — 긍정 프레이밍 적용
// ─────────────────────────────────────────────────────────────

export async function enrichEvidenceBank(
  instruction: TailoredInstructionWithRequirements,
  githubData: GitHubFetchResult[],
): Promise<EvidenceBank> {
  const successfulData = githubData.filter(d => d.status === 'success' && d.data);
  if (successfulData.length === 0) {
    return { repos: [], techStack: {}, highlights: [] };
  }

  const githubDataFormatted = successfulData.map(d => {
    const data = d.data!;
    const langList = Object.entries(data.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang)
      .join(', ');
    return `## ${data.metadata.name} (${d.repoUrl})
- 설명: ${data.metadata.description || '없음'}
- 언어: ${langList}
- 스타: ${data.metadata.stars}, 포크: ${data.metadata.forks}
- 토픽: ${data.metadata.topics.join(', ') || '없음'}
${data.readme ? `- README (최대 2000자):\n${data.readme.slice(0, 2000)}` : ''}`;
  }).join('\n\n---\n\n');

  const prompt = `당신은 GitHub 활동 분석 전문가입니다.
아래 GitHub 레포지토리 데이터를 분석하여 채용 공고의 요구사항과 매핑하십시오.

[핵심 원칙]
실제 데이터에서 직접 확인 가능한 내용만 포함하십시오.
각 근거의 confidence를 정확히 판정하십시오: verified(코드/커밋에서 직접 확인), inferred(README/설명에서 추론).

[JD 요구사항]
${instruction.jdRequirements.map(r => `- [${r.category}] ${r.text}`).join('\n')}

[GitHub 데이터]
${githubDataFormatted}

[임무]
1. 각 레포지토리가 어떤 JD 요구사항을 뒷받침하는지 매핑하십시오.
2. 기술 스택을 레포별로 정리하십시오.
3. 레포지토리 데이터에서 직접 확인할 수 있는 내용만 evidence로 작성하십시오.
`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_FULL, includeHierarchy: false }),
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            repos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "레포지토리 이름" },
                  url: { type: Type.STRING, description: "레포지토리 URL" },
                  relevantTo: { type: Type.ARRAY, items: { type: Type.STRING }, description: "이 레포가 뒷받침하는 JD 요구사항 목록" },
                  evidences: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "jd, github, best-practice 중 하나" },
                        content: { type: Type.STRING, description: "레포지토리 데이터에서 직접 확인한 근거 내용" },
                        source: { type: Type.STRING, description: "근거 출처 (레포명, 커밋, README 등)" },
                        confidence: { type: Type.STRING, description: "verified(코드/커밋에서 직접 확인) 또는 inferred(README/설명에서 추론)" },
                      },
                      required: ["type", "content", "confidence"],
                    },
                  },
                },
                required: ["name", "url", "relevantTo", "evidences"],
              },
            },
            highlights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "근거 유형" },
                  content: { type: Type.STRING, description: "주요 하이라이트 내용" },
                  source: { type: Type.STRING, description: "출처" },
                  confidence: { type: Type.STRING, description: "verified 또는 inferred" },
                },
                required: ["type", "content", "confidence"],
              },
            },
          },
          required: ["repos", "highlights"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) return { repos: [], techStack: {}, highlights: [] };
    const parsed = safeParseJSON<Record<string, unknown>>(jsonText, 'GitHub 근거 분석');
    return { repos: (parsed.repos as EvidenceBank['repos']) ?? [], techStack: (parsed.techStack as EvidenceBank['techStack']) ?? {}, highlights: (parsed.highlights as EvidenceBank['highlights']) ?? [] };
  } catch (e) {
    console.warn("Evidence bank enrichment failed:", classifyError(e));
    return { repos: [], techStack: {}, highlights: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// 범용 증빙 해석 (Flash, 멀티모달) — 파일(PDF/이미지)/텍스트/링크
// 직무 무관. GitHub 외 모든 직무의 포트폴리오·실적·발행물을 해석.
// ─────────────────────────────────────────────────────────────

export async function interpretEvidence(
  instruction: TailoredInstructionWithRequirements,
  evidenceInputs: EvidenceInput[],
): Promise<Evidence[]> {
  const inputs = (evidenceInputs ?? []).filter(e =>
    (e.kind === 'file' && e.dataBase64) ||
    (e.kind === 'text' && (e.text ?? '').trim()) ||
    (e.kind === 'link' && ((e.url ?? '').trim() || (e.text ?? '').trim())),
  );
  if (inputs.length === 0) return [];

  const profile = resolveJobProfile(instruction.jobProfile, instruction.detectedIndustry);

  const header = `당신은 채용 증빙 자료 해석 전문가입니다.
첨부된 자료를 분석하여, "${profile.jobFamily}" 직무 지원자의 역량을 보여주는 증빙을 구조화하여 추출하십시오.

[규칙]
- 자료에 실제로 있는 내용만 추출하십시오. 없는 수치나 사실을 절대 지어내지 마십시오.
- 표/차트/이미지의 시각 정보(숫자, 추세)도 읽어내십시오.
- 각 증빙은 가능한 구체적 수치를 포함하십시오.
- confidence: verified(자료에 명시됨) 또는 inferred(추론).
- type: 'portfolio'(포트폴리오/작업물), 'document'(문서/실적/자격), 'link'(링크) 중 자료 성격에 맞게.

[JD 요구사항]
${instruction.jdRequirements.map(r => `- [${r.category}] ${r.text}`).join('\n')}`;

  // 멀티모달 parts 구성: 헤더 + 각 증빙(파일은 inlineData, 텍스트/링크는 text)
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: header },
  ];
  for (const e of inputs) {
    const label = e.label || e.fileName || '자료';
    if (e.kind === 'file' && e.dataBase64) {
      parts.push({ text: `\n[첨부 파일 — ${label}]` });
      parts.push({ inlineData: { mimeType: e.mimeType || 'application/octet-stream', data: e.dataBase64 } });
    } else if (e.kind === 'link') {
      parts.push({ text: `\n[링크 증빙 — ${label}] URL: ${e.url || '(없음)'} / 설명: ${e.text || '(없음)'}` });
    } else if (e.kind === 'text') {
      parts.push({ text: `\n[텍스트 증빙 — ${label}] ${e.text}` });
    }
  }

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_FULL, includeHierarchy: false }),
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evidences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "portfolio, document, link 중 하나" },
                  content: { type: Type.STRING, description: "자료에서 직접 확인한 증빙 내용 (구체적 수치 포함)" },
                  source: { type: Type.STRING, description: "출처 (파일/링크 라벨, 자료 내 위치)" },
                  confidence: { type: Type.STRING, description: "verified 또는 inferred" },
                },
                required: ["type", "content", "confidence"],
              },
            },
          },
          required: ["evidences"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) return [];
    const parsed = safeParseJSON<{ evidences?: Evidence[] }>(jsonText, '증빙 자료 해석');
    return parsed.evidences ?? [];
  } catch (e) {
    console.warn("Evidence interpretation failed:", classifyError(e));
    return [];
  }
}
