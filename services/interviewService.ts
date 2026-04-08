import { GoogleGenAI, Type } from "@google/genai";
import { InterviewQuestion, InterviewFeedback, TailoredInstructionWithRequirements } from "../types";

// Initialize Gemini Client lazily to avoid breaking the app when API key is missing
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요.");
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ─────────────────────────────────────────────────────────────
// Generate Interview Questions (Pro Model)
// ─────────────────────────────────────────────────────────────

export async function generateInterviewQuestions(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements
): Promise<InterviewQuestion[]> {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `[역할]
당신은 한국 IT 기업의 면접관입니다. 이력서와 채용 공고를 분석하여 실전 모의 면접 질문을 생성해주세요.

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

[현재 날짜]
${today}

[JD 구조화 결과]
- 페르소나: ${instruction.persona}
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}
- 요구사항:
${instruction.jdRequirements.map((r, i) =>
  `  ${i+1}. [${r.importance}] [${r.category}] ${r.text} (키워드: ${r.keywords.join(', ')})`
).join('\n')}

[이력서 원문]
${resumeText}

[채용 공고 원문]
${jobDescription}

[임무]
총 10개의 면접 질문을 생성하십시오:
1. 기술 면접 (technical) 5개: JD의 Hard Skills를 검증하는 질문. 이력서의 기술 경험과 연결하십시오.
2. 인성 면접 (behavioral) 5개: JD의 Soft Skills와 업무 태도를 검증하는 질문. 이력서의 경험과 연결하십시오.

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

[금지 사항]
- 지나치게 일반적인 질문 금지 (예: "본인의 장단점을 말씀해주세요")
- 이력서에 없는 기술/경험을 언급하는 질문 금지
- JD 요구사항과 무관한 질문 금지`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.5,
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
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("면접 질문 생성 결과가 비어있습니다.");

    const parsed = JSON.parse(jsonText);
    return parsed.questions || [];
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("면접 질문 생성 실패:", errorMsg);
    throw new Error(`면접 질문 생성 중 오류가 발생했습니다: ${errorMsg}`);
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

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

[현재 날짜]
${today}

[면접 질문]
${question.question}

[질문 의도]
${question.intent}

[지원자 답변]
${userAnswer}

[이력서 원문]
${resumeText}

[채용 공고 원문]
${jobDescription}

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

[평가 원칙]
- 이력서에 없는 내용을 날조한 경우 감점
- JD 요구사항과 무관한 내용인 경우 감점
- STAR 구조가 명확하지 않은 경우 감점
- 구체적 수치가 없는 경우 감점
- 강점과 개선점은 구체적이고 실용적인 조언이어야 함`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.3,
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
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("답변 평가 결과가 비어있습니다.");

    const parsed = JSON.parse(jsonText);
    return {
      questionId: question.id,
      score: parsed.score || 0,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      revisedAnswer: parsed.revisedAnswer || "",
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("답변 평가 실패:", errorMsg);
    throw new Error(`답변 평가 중 오류가 발생했습니다: ${errorMsg}`);
  }
}
