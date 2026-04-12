import { Type, ThinkingLevel } from "@google/genai";
import {
  TailoredInstructionWithRequirements,
  CoachingResult,
  AboutStatementResult,
  AboutStatementVersion,
  CompanyContext,
} from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  GROUNDING_FULL,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

// ─────────────────────────────────────────────────────────────
// About Statement Refinement (한 줄 자기소개 고도화)
// ─────────────────────────────────────────────────────────────

const TONE_DEFINITIONS = {
  professional: {
    id: 'professional',
    label: '격식있는',
    description: '공식적이고 신뢰감 있는 톤. 대기업, 공공기관 지원에 적합.',
    guide: '격식체 어미 사용 (~합니다, ~입니다). 전문 용어를 적절히 활용. 객관적 성과 중심.',
  },
  friendly: {
    id: 'friendly',
    label: '친근한',
    description: '따뜻하고 접근하기 쉬운 톤. 스타트업, 팀 문화 중시 기업에 적합.',
    guide: '부드러운 표현 사용. 협업과 소통 강조. 인간적인 면모 드러내기.',
  },
  impactful: {
    id: 'impactful',
    label: '임팩트있는',
    description: '강렬하고 기억에 남는 톤. 리더십 포지션, 차별화 필요 시 적합.',
    guide: '핵심 성과를 앞세움. 숫자와 수치 강조. 짧고 강한 문장.',
  },
};

export async function refineAboutStatement(
  originalStatement: string,
  resumeText: string,
  _jobDescription: string,
  _instruction: TailoredInstructionWithRequirements,
  coachingResult?: CoachingResult,
  companyContext?: CompanyContext | null,
): Promise<AboutStatementResult> {
  validateResumeInput(resumeText);

  const today = new Date().toISOString().split('T')[0];
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const strengthsContext = coachingResult
    ? coachingResult.gapMap
        .filter(g => g.currentLevel === 'strong')
        .slice(0, 5)
        .map(g => g.requirement)
        .join(', ')
    : '';

  const prompt = `[역할]
당신은 개인 브랜딩 전문가입니다.
이력서를 분석하여 그 사람을 가장 잘 표현하는 한 줄 자기소개를 다듬는 전문가입니다.
특정 채용 공고에 맞추지 않고, 범용적으로 본인의 핵심 역량과 차별점을 드러내는 것이 목표입니다.
${companyBlock}

[현재 날짜]
${today}

[핵심 원칙]
원칙 1 (의도 보존): 원본 문장의 핵심 메시지와 정체성을 반드시 유지하십시오.
원칙 2 (날조 금지): 이력서에 명시된 내용만 활용하십시오. 없는 경력이나 기술을 만들어내지 마십시오.
원칙 3 (범용성): 특정 회사나 직무에 맞추지 말고, 이 사람의 현재 역량을 가장 잘 표현하십시오.
원칙 4 (간결함): 한 줄 자기소개는 50-100자 내외로 유지하십시오.
원칙 5 (톤 차별화): 각 톤별로 명확하게 다른 느낌의 문장을 작성하십시오.

[입력 품질 가드]
원본 자기소개가 10자 미만이면: 고도화를 시도하지 말고, "자기소개 내용이 너무 짧습니다. 본인의 직무와 핵심 역량을 포함하여 작성해주세요."를 반환하십시오.

[원본 자기소개]
<user-input>
${originalStatement}
</user-input>
${strengthsContext ? `\n[지원자 주요 강점]\n${strengthsContext}` : ''}

[이력서 원문]
<user-resume>
${resumeText.slice(0, 2000)}
</user-resume>

[톤별 작성 가이드]
1. professional (격식있는): ${TONE_DEFINITIONS.professional.guide}
2. friendly (친근한): ${TONE_DEFINITIONS.friendly.guide}
3. impactful (임팩트있는): ${TONE_DEFINITIONS.impactful.guide}

[작성 태스크]
1. 원본 문장을 분석하여 핵심 의도와 개선 가능한 점을 파악하십시오.
2. 3가지 톤(professional, friendly, impactful)으로 각각 고도화된 버전을 작성하십시오.
3. 각 버전에서:
   - 원본의 핵심 의도를 보존하면서 더 명확하고 매력적으로 다듬으십시오.
   - 이력서에서 확인된 구체적 강점이나 수치를 자연스럽게 녹여내십시오.
   - 이력서의 핵심 기술과 도메인 키워드를 자연스럽게 녹여내십시오.
   - 50-100자 내외로 간결하게 유지하십시오.
4. 가장 추천하는 버전을 선정하고 그 이유를 설명하십시오.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.pro,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_FULL }),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalAnalysis: {
              type: Type.STRING,
              description: "원본 문장 분석: 핵심 의도, 강점, 개선 가능한 점",
            },
            versions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "버전 ID (professional, friendly, impactful)" },
                  tone: { type: Type.STRING, description: "톤 타입" },
                  toneLabel: { type: Type.STRING, description: "톤 라벨 (격식있는, 친근한, 임팩트있는)" },
                  content: { type: Type.STRING, description: "고도화된 한 줄 자기소개 (50-100자)" },
                  charCount: { type: Type.NUMBER, description: "글자 수" },
                  improvements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "원본 대비 개선된 포인트 목록 (2-4개)",
                  },
                  keywordsUsed: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "반영된 JD 키워드 목록",
                  },
                  strengthsHighlighted: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "강조된 이력서 강점 목록",
                  },
                },
                required: ["id", "tone", "toneLabel", "content", "charCount", "improvements", "keywordsUsed", "strengthsHighlighted"],
              },
            },
            bestVersion: {
              type: Type.STRING,
              description: "가장 추천하는 버전 ID와 선정 이유 (예: 'professional - 해당 포지션의 성격상...')",
            },
          },
          required: ["originalAnalysis", "versions", "bestVersion"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("한 줄 자기소개 고도화 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ originalAnalysis?: string; versions?: AboutStatementVersion[]; bestVersion?: string }>(jsonText, '한줄소개 고도화');
    return {
      originalInput: originalStatement,
      originalAnalysis: parsed.originalAnalysis || '',
      versions: parsed.versions || [],
      bestVersion: parsed.bestVersion || '',
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("About statement refinement failed:", error);
    throw classifyError(error);
  }
}
