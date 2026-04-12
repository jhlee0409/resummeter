import { Type, ThinkingLevel } from "@google/genai";
import { InterviewQuestion, InterviewFeedback, TailoredInstructionWithRequirements, CompanyContext } from "../../types";
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  GROUNDING_BASIC,
  HR_PERSPECTIVE_INTERVIEW,
  formatInstruction,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

// ─────────────────────────────────────────────────────────────
// Generate Interview Questions (Pro Model)
// ─────────────────────────────────────────────────────────────

export async function generateInterviewQuestions(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  companyContext?: CompanyContext | null,
): Promise<InterviewQuestion[]> {
  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const today = new Date().toISOString().split('T')[0];
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const prompt = `[역할]
당신은 한국 IT 기업의 면접관입니다. 이력서와 채용 공고를 분석하여 실전 모의 면접 질문을 생성해주세요.
${companyBlock}
이력서에 언급되지 않은 기술이나 경험을 질문에 포함하지 마십시오.

[현재 날짜]
${today}

${formatInstruction(instruction)}
- 요구사항:
${instruction.jdRequirements.map((r, i) =>
  `  ${i+1}. [${r.importance}] [${r.category}] ${r.text} (키워드: ${r.keywords.join(', ')})`
).join('\n')}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고 원문]
<user-jd>
${jobDescription}
</user-jd>

[임무]
총 10개의 면접 질문을 생성하십시오:
1. 기술 면접 (technical) 4개: JD의 Hard Skills를 검증하는 질문. 이력서의 기술 경험과 연결하십시오.
2. 인성 면접 (behavioral) 3개: JD의 Soft Skills와 업무 태도를 검증하는 질문. 이력서의 경험과 연결하십시오.
3. 상황판단형 (technical) 2개: "~한 상황에서 어떻게 하시겠습니까?" 형태. 이력서의 경험을 기반으로 실무 판단력을 검증하십시오.
4. 심화 질문 (technical) 1개: 이력서에서 가장 인상적인 프로젝트/성과에 대해 깊이 파고드는 질문.

${HR_PERSPECTIVE_INTERVIEW}

[질문 생성 원칙]
- 각 질문은 JD의 특정 요구사항과 연결되어야 합니다.
- 이력서에 언급된 경험을 기반으로 구체적으로 파고드는 질문을 만드십시오.
- intent: 이 질문으로 무엇을 평가하려는지 1줄로 명확히 기술하십시오.
- sampleAnswer: 모범 답변 예시를 2-3문장으로 작성하십시오.
- starGuide: STAR 방식으로 답변 구조화 가이드를 제공하십시오 (각 항목 1-2문장).

[STAR 방식 답변 가이드 작성 규칙]
- Situation: 구체적인 상황/배경을 설명하도록 안내
- Task: 본인이 맡은 과제/목표를 명시하도록 안내
- Action: 수행한 구체적 행동과 기술을 설명하도록 안내
- Result: 정량적 성과를 제시하도록 안내

[Few-shot 예시]
GOOD 기술 질문: "이력서에서 Redis 캐싱으로 API 응답시간을 단축했다고 하셨는데, 캐시 무효화 전략은 어떻게 설계하셨나요?" (이력서 내용 기반, 구체적, 심화)
BAD 기술 질문: "Redis에 대해 설명해주세요" (너무 일반적, 이력서와 무관)
GOOD 인성 질문: "이력서에서 코드 리뷰 프로세스를 제안했다고 하셨는데, 팀원 중 코드 리뷰에 부정적인 반응이 있었다면 어떻게 대처하셨나요?" (경험 기반 + 소프트스킬 검증)
BAD 인성 질문: "팀워크에 대해 어떻게 생각하시나요?" (이력서와 무관, 범용적)

[금지 사항]
- 지나치게 일반적인 질문 금지 (예: "본인의 장단점을 말씀해주세요")
- 이력서에 없는 기술/경험을 언급하는 질문 금지
- JD 요구사항과 무관한 질문 금지`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.pro,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_BASIC }),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "고유 식별자 (q-1, q-2, ...)" },
                  type: { type: Type.STRING, description: "technical 또는 behavioral" },
                  question: { type: Type.STRING, description: "면접 질문 (한국어)" },
                  intent: { type: Type.STRING, description: "이 질문으로 평가하려는 것 (1줄)" },
                  sampleAnswer: { type: Type.STRING, description: "모범 답변 예시 (2-3문장)" },
                  starGuide: {
                    type: Type.OBJECT,
                    description: "STAR 방식 답변 가이드",
                    properties: {
                      situation: { type: Type.STRING, description: "상황 설명 가이드 (1-2문장)" },
                      task: { type: Type.STRING, description: "과제 명시 가이드 (1-2문장)" },
                      action: { type: Type.STRING, description: "행동 설명 가이드 (1-2문장)" },
                      result: { type: Type.STRING, description: "성과 제시 가이드 (1-2문장)" },
                    },
                    required: ["situation", "task", "action", "result"],
                  },
                  relatedJdRequirements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "이 질문과 관련된 JD 요구사항 목록",
                  },
                },
                required: ["id", "type", "question", "intent", "sampleAnswer", "starGuide", "relatedJdRequirements"],
              },
            },
          },
          required: ["questions"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("면접 질문 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ questions: InterviewQuestion[] }>(jsonText, '면접 질문 생성');
    return parsed.questions || [];
  } catch (error: unknown) {
    console.error("면접 질문 생성 실패:", error);
    throw classifyError(error);
  }
}

// ─────────────────────────────────────────────────────────────
// Evaluate User Answer (Flash Model)
// ─────────────────────────────────────────────────────────────

export async function evaluateAnswer(
  question: InterviewQuestion,
  userAnswer: string,
  resumeText: string,
  jobDescription: string
): Promise<InterviewFeedback> {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `[역할]
당신은 한국 IT 기업의 면접관입니다. 지원자의 면접 답변을 평가하고 피드백을 제공해주세요.
이력서에 언급되지 않은 기술이나 경험을 질문에 포함하지 마십시오.

[현재 날짜]
${today}

[면접 질문]
${question.question}

[질문 의도]
${question.intent}

[지원자 답변]
<user-input>
${userAnswer}
</user-input>

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고 원문]
<user-jd>
${jobDescription}
</user-jd>

[STAR 평가 기준]
- Situation: 상황 설명이 구체적인가?
- Task: 본인의 역할과 목표가 명확한가?
- Action: 수행한 행동과 기술이 구체적으로 설명되었는가?
- Result: 정량적 성과가 제시되었는가?

[평가 임무]
1. 점수 (0-100): STAR 기준 충족도, JD 연관성, 구체성을 종합 평가
2. 강점 (3-5개): 답변에서 잘한 점을 구체적으로 나열
3. 개선점 (3-5개): 보완이 필요한 부분을 구체적으로 나열
4. 수정 답변 제안: STAR 기준을 모두 충족하는 개선된 답변 예시를 작성하십시오 (3-5문장)
5. 수치화 피드백: 답변에 구체적 수치가 부족한 경우, 어떤 수치를 추가하면 좋을지 구체적으로 제안하십시오.
   예: "처리량", "개선 비율", "팀 규모", "소요 기간" 등

[평가 원칙]
- 이력서에 없는 내용을 날조한 경우 감점
- JD 요구사항과 무관한 내용인 경우 감점
- STAR 구조가 명확하지 않은 경우 감점
- 구체적 수치가 없는 경우 감점
- 강점과 개선점은 구체적이고 실용적인 조언이어야 함

[자기 검증]
평가 완료 후 검증하십시오:
1. 강점/개선점이 구체적인가? ("잘했다"가 아닌 "STAR 구조의 Action 부분이 구체적이다")
2. 수정 답변에 이력서에 없는 내용이 포함되지 않았는가?
3. 점수가 답변 내용과 일치하는가? (구체적 수치 없이 80점 이상은 부적절)`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_BASIC }),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "점수 (0-100)" },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "강점 목록 (3-5개, 각 항목 1문장)",
            },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "개선점 목록 (3-5개, 각 항목 1문장)",
            },
            revisedAnswer: {
              type: Type.STRING,
              description: "STAR 기준을 충족하는 수정된 답변 제안 (3-5문장)",
            },
          },
          required: ["score", "strengths", "improvements", "revisedAnswer"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("답변 평가 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ score?: number; strengths?: string[]; improvements?: string[]; revisedAnswer?: string }>(jsonText, '답변 평가');
    return {
      questionId: question.id,
      score: parsed.score || 0,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      revisedAnswer: parsed.revisedAnswer || "",
    };
  } catch (error: unknown) {
    console.error("답변 평가 실패:", error);
    throw classifyError(error);
  }
}
