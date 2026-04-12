import { Type, ThinkingLevel } from "@google/genai";
import { TailoredInstructionWithRequirements, GitHubFetchResult, EvidenceBank } from "../../types";
import { getAI, MODELS } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { safeParseJSON } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
} from "../../shared/prompt/promptBlocks";

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
        systemInstruction: [SECURITY_RULE, GROUNDING_FULL].join('\n\n'),
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
