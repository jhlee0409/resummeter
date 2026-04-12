import { Type, ThinkingLevel } from "@google/genai";
import { TailoredInstructionWithRequirements } from "../../types";
import { getAI, MODELS } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { validateJDInput } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import {
  GROUNDING_FULL,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";

export const DEFAULT_INSTRUCTION: TailoredInstructionWithRequirements = {
  persona: "한국 IT 기업의 전문 채용 담당자",
  keywords: [],
  evaluationCriteria: {
    hardSkills: [],
    softSkills: [],
    preferredExperience: [],
  },
  toneGuide: {
    style: "겸손하지만 자신감 있는 어조",
    endings: "명사형 종결어미",
    avoidPatterns: ["과도한 자기 PR", "근거 없는 수치"],
  },
  jdRequirements: [],
};

// ─────────────────────────────────────────────────────────────
// Stage 1: JD 분석 (Flash) — Schema description 강화
// ─────────────────────────────────────────────────────────────

export async function generateTailoredInstruction(
  jobDescription: string,
  companyName?: string,
  jobTitle?: string,
): Promise<TailoredInstructionWithRequirements> {
  validateJDInput(jobDescription);

  // 업종 자동 감지
  const { detectIndustry, buildIndustryContext } = await import('../research/industryDetect');
  const detectedIndustry = detectIndustry(jobDescription);
  const industryContext = buildIndustryContext(detectedIndustry);

  const companyLine = companyName ? `\n    [지원 회사] ${companyName}` : '';
  const jobTitleLine = jobTitle ? `\n    [지원 직무] ${jobTitle}` : '';

  const metaPrompt = `
    당신은 세계 최고의 프롬프트 엔지니어이자 채용 컨설턴트입니다.
    아래의 [채용 공고(JD)]를 심층 분석하여, 이 포지션의 지원자를 평가할 **'AI 면접관의 페르소나'**와 **'이력서 최적화 가이드라인'**을 작성해주세요.
    ${companyLine}${jobTitleLine}

    [입력 품질 가드]
    JD가 50자 미만이면 기본 페르소나와 빈 키워드 배열을 반환하십시오. 부족한 정보를 추론하지 마십시오.

    [목표 채용 공고]
    <user-jd>
    ${jobDescription}
    </user-jd>

    [지시사항]
    1. **페르소나 정의**: 이 직무의 채용 담당자가 가질 법한 구체적인 성향과 배경을 정의하십시오.
    2. **핵심 평가 기준**: JD에서 요구하는 기술 스택(Hard Skills)과 업무 태도(Soft Skills), 우대 사항을 바탕으로 이력서에서 반드시 드러내야 할 키워드와 경험을 나열하십시오.
    3. **수정 가이드라인 (한국 정서 반영)**: 한국의 기업 문화를 고려하여 이력서의 어조와 서술 방식을 지시하십시오.
    4. **출력 결과 형식**: JSON 형식으로 구조화된 분석 결과를 반환하십시오.
    5. **JD 요구사항 구조화**: 채용공고의 각 요구사항을 개별 항목으로 분리.
       - 자격요건(required)과 우대사항(preferred) 구분
       - 각 항목에서 핵심 키워드 추출
       - 카테고리: hard-skill, soft-skill, experience, education
    6. **키워드 추출 원칙**: JD 원문에서 직접 등장하는 단어만 키워드로 추출하십시오. 유추하거나 확장한 키워드는 포함하지 마십시오.
    7. **키워드 시맨틱 동의어(keywordAliases)**: 각 키워드에 대해 동일하거나 매우 유사한 기술/개념을 매핑하십시오.
       - 예: "Fabric.js" → ["Canvas", "HTML5 Canvas", "캔버스"], "TypeScript" → ["TS"], "React Native" → ["RN", "리액트 네이티브"]
       - 프레임워크 ↔ 기반 기술: "Next.js" → ["React", "SSR"], "NestJS" → ["Node.js", "Express"]
       - 약어/한글 변환: "CI/CD" → ["지속적 통합", "GitHub Actions", "Jenkins"], "REST API" → ["RESTful", "API 개발"]
       - 상위/하위 기술 관계: "Kubernetes" → ["K8s", "Docker", "컨테이너"], "GraphQL" → ["Apollo", "Relay"]
       - 키워드당 2-5개 alias. 무관한 기술은 포함하지 마십시오.
  `;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: metaPrompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_FULL, includeHierarchy: false }),
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            persona: { type: Type.STRING, description: "채용 담당자 페르소나 (1-2문장)" },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD 원문에서 직접 추출한 키워드만 포함. 유추하거나 확장한 키워드는 포함하지 않음" },
            keywordAliases: {
              type: Type.ARRAY,
              description: "각 키워드의 시맨틱 동의어/관련 기술 매핑",
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING, description: "JD 원문 키워드 (keywords 배열의 항목과 동일)" },
                  aliases: { type: Type.ARRAY, items: { type: Type.STRING }, description: "동의어/관련 기술 2-5개" },
                },
                required: ["keyword", "aliases"],
              },
            },
            evaluationCriteria: {
              type: Type.OBJECT,
              properties: {
                hardSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 기술 스택" },
                softSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 소프트 스킬" },
                preferredExperience: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 우대 경험" },
              },
              required: ["hardSkills", "softSkills", "preferredExperience"],
            },
            toneGuide: {
              type: Type.OBJECT,
              properties: {
                style: { type: Type.STRING, description: "어조 스타일" },
                endings: { type: Type.STRING, description: "종결어미 스타일" },
                avoidPatterns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "피해야 할 표현" },
              },
              required: ["style", "endings", "avoidPatterns"],
            },
            jdRequirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "요구사항 원문" },
                  category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                  importance: { type: Type.STRING, description: "required 또는 preferred" },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD 텍스트에 명시적으로 등장하는 단어만 포함" },
                },
                required: ["text", "category", "importance", "keywords"],
              },
            },
          },
          required: ["persona", "keywords", "keywordAliases", "evaluationCriteria", "toneGuide", "jdRequirements"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) return DEFAULT_INSTRUCTION;
    try {
      const parsed = JSON.parse(jsonText) as TailoredInstructionWithRequirements;
      return { ...parsed, detectedIndustry };
    } catch {
      return { ...DEFAULT_INSTRUCTION, detectedIndustry };
    }
  } catch (e) {
    console.warn("Failed to generate tailored instruction, using default.", classifyError(e));
    return DEFAULT_INSTRUCTION;
  }
}
