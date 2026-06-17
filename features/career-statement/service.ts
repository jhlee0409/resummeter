import { Type, ThinkingLevel } from "@google/genai";
import {
  CareerStatement,
  CareerStatementResult,
  TailoredInstructionWithRequirements,
  GitHubFetchResult,
  CompanyContext,
} from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { formatRepoInfo } from "../../shared/prompt/formatters";
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  GROUNDING_FULL,
  AI_DETECTION_KO_BRIEF,
  QUANTIFICATION_CAREER,
  formatInstruction,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

// ─────────────────────────────────────────────────────────────
// Career Statements (STAR-based NCS format)
// ─────────────────────────────────────────────────────────────

export async function generateCareerStatements(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubData?: GitHubFetchResult[],
  companyContext?: CompanyContext | null,
): Promise<CareerStatementResult> {
  const today = new Date().toISOString().split('T')[0];
  const repoInfo = githubData ? formatRepoInfo(
    githubData.filter(d => d.status === 'success').map(d => ({ url: d.repoUrl, description: '' })),
    githubData
  ) : '';
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const prompt = `[역할]
당신은 한국 공공기관 및 대기업 채용 프로세스 전문가입니다.
STAR 구조 기반 경력기술서 작성에 특화되어 있으며, NCS 블라인드 채용 형식에 정통합니다.
${companyBlock}

[현재 날짜]
${today}

[핵심 원칙]
원칙 1: STAR 구조를 엄격히 준수하십시오 (Situation, Task, Action, Result).
원칙 2: 정량적 성과 지표를 반드시 포함하십시오 (숫자, 비율, 기간 등).
원칙 3: JD 키워드를 자연스럽게 녹여내되, 키워드 스터핑을 피하십시오.
원칙 4: NCS 블라인드 채용 형식에 부합하도록 학력, 출신 학교, 나이, 성별 등 인적 사항을 배제하십시오.
원칙 5: 이력서와 GitHub 데이터에 명시된 내용만 활용하십시오.

${formatInstruction(instruction)}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고]
<user-jd>
${jobDescription}
</user-jd>

${repoInfo ? `[GitHub 리포지토리 (참고용)]\n${repoInfo}` : ''}

${AI_DETECTION_KO_BRIEF}

[작성 태스크]
1. 이력서에서 3-5개의 핵심 경력/프로젝트를 선정하십시오.
2. 각 경력을 STAR 구조로 분해하십시오:
   - S (Situation): 상황/배경 (언제, 어떤 프로젝트/조직에서)
   - T (Task): 본인이 맡은 과제/목표
   - A (Action): 수행한 구체적 행동과 실무 역량
   - R (Result): 정량적 성과 (숫자, 비율, 개선 수치 등)
3. 각 항목에 제목을 붙이십시오 (예: "신규 채널 개척으로 분기 매출 40% 향상").
4. JD 키워드를 각 항목과 매핑하십시오.
5. 정량화된 성과를 별도로 추출하십시오.

[NCS 블라인드 채용 체크리스트]
- 학력, 출신 학교명 제외
- 나이, 성별 제외
- 사진, 가족관계 제외
- 오직 직무 역량과 성과만 포함

[NCS 직업기초능력 매핑]
각 경력기술서 항목이 아래 NCS 직업기초능력 중 어떤 것을 증명하는지 명시하십시오:
의사소통능력, 수리능력, 문제해결능력, 자기개발능력, 자원관리능력,
대인관계능력, 정보능력, 기술능력, 조직이해능력, 직업윤리
각 항목의 relatedJdKeywords에 해당 NCS 능력을 태그로 포함하십시오.

[STAR 작성 가이드]
- S: 2-3문장으로 배경 설명
- T: 1-2문장으로 목표 명시
- A: 3-5문장으로 구체적 행동과 사용 기술 서술
- R: 1-2문장으로 정량적 성과 제시 (반드시 숫자 포함)

${QUANTIFICATION_CAREER}

[글자 수 가이드]
각 경력기술서 항목: 400-600자 (공백 포함)`;

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
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "고유 ID (statement-1, statement-2, ...)" },
                  title: { type: Type.STRING, description: "경력 항목 제목 (핵심 성과를 드러내는 제목)" },
                  content: {
                    type: Type.STRING,
                    description: "STAR 구조로 작성된 전체 내용. S-T-A-R 순서로 자연스럽게 연결된 하나의 완성된 글. 400-600자."
                  },
                  starBreakdown: {
                    type: Type.OBJECT,
                    properties: {
                      situation: { type: Type.STRING, description: "S: 상황/배경 (2-3문장)" },
                      task: { type: Type.STRING, description: "T: 과제/목표 (1-2문장)" },
                      action: { type: Type.STRING, description: "A: 구체적 행동과 기술적 역량 (3-5문장)" },
                      result: { type: Type.STRING, description: "R: 정량적 성과 (1-2문장, 반드시 숫자 포함)" },
                    },
                    required: ["situation", "task", "action", "result"],
                  },
                  quantifiedResults: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "정량화된 성과 목록 (예: '처리 시간 8초→4초 단축', 'MAU 20% 증가')",
                  },
                  relatedJdKeywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "이 항목에서 다룬 JD 키워드 목록",
                  },
                },
                required: ["id", "title", "content", "starBreakdown", "quantifiedResults", "relatedJdKeywords"],
              },
            },
            ncsCompatible: {
              type: Type.BOOLEAN,
              description: "NCS 블라인드 채용 형식 준수 여부 (학력/나이/성별 배제됨)"
            },
          },
          required: ["statements", "ncsCompatible"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("경력기술서 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ statements: CareerStatement[]; ncsCompatible?: boolean }>(jsonText, '경력기술서 생성');
    return {
      statements: parsed.statements || [],
      ncsCompatible: parsed.ncsCompatible ?? true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("Career statement generation failed:", error);
    throw classifyError(error);
  }
}
