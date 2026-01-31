import { GoogleGenAI, Type } from "@google/genai";
import { OptimizationResult, GithubRepo } from "../types";

// Initialize Gemini Client
// Note: API Key must be set in environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 1단계: 채용 공고(JD)를 분석하여 맞춤형 프롬프트(페르소나)를 생성합니다.
 * Gemini Flash 모델을 사용하여 빠르게 가이드라인을 수립합니다.
 */
async function generateTailoredInstruction(jobDescription: string): Promise<string> {
  const metaPrompt = `
    당신은 세계 최고의 프롬프트 엔지니어이자 채용 컨설턴트입니다.
    아래의 [채용 공고(JD)]를 심층 분석하여, 이 포지션의 지원자를 평가할 **'AI 면접관의 페르소나'**와 **'이력서 최적화 가이드라인'**을 작성해주세요.

    [목표 채용 공고]
    ${jobDescription}

    [지시사항]
    1. **페르소나 정의**: 이 직무의 채용 담당자가 가질 법한 구체적인 성향과 배경을 정의하십시오. (예: "보안 무결성을 중시하는 핀테크 보안 팀장", "확장성과 트래픽 처리에 집착하는 이커머스 백엔드 리드", "사용자 경험(UX) 디테일에 민감한 유니콘 스타트업 프론트엔드 리더" 등)
    2. **핵심 평가 기준**: JD에서 요구하는 기술 스택(Hard Skills)과 업무 태도(Soft Skills), 우대 사항을 바탕으로 이력서에서 반드시 드러내야 할 키워드와 경험을 나열하십시오.
    3. **수정 가이드라인 (한국 정서 반영)**: 한국의 기업 문화를 고려하여 이력서의 어조와 서술 방식을 지시하십시오. (예: "겸손하지만 자신감 있는 태도", "모호한 표현 대신 구체적 수치 제시", "명사형 종결어미 사용" 등)
    4. **출력 결과 형식**: 이 결과물은 다음 단계에서 AI에게 직접 주입될 **System Instruction**입니다. 따라서 "당신은 [페르소나]입니다. [기준]에 따라 이력서를 평가하고 수정하십시오." 형태의 명령문으로 작성하십시오.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: metaPrompt,
    });
    return response.text || "당신은 한국의 IT 기업 전문 채용 담당자입니다. 주어진 JD를 바탕으로 이력서를 분석하고 최적화하십시오.";
  } catch (e) {
    console.warn("Failed to generate tailored instruction, using default.", e);
    return "당신은 한국의 IT 기업 전문 채용 담당자입니다. 주어진 JD를 바탕으로 이력서를 분석하고 최적화하십시오.";
  }
}

/**
 * 2단계: 생성된 페르소나를 바탕으로 실제 이력서 최적화를 수행합니다.
 * Gemini Pro 모델을 사용하여 깊이 있는 추론과 작문을 수행합니다.
 */
export const optimizeResume = async (
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[]
): Promise<OptimizationResult> => {
  
  // Step 1: JD 기반 맞춤형 프롬프트 생성 (AI가 AI를 위한 프롬프트 작성)
  const tailoredInstruction = await generateTailoredInstruction(jobDescription);

  // Format repo info for prompt
  const repoInfo = githubRepos.map(repo => {
    return `- 리포지토리: ${repo.url}\n  추가 설명/동기/활동 내역: ${repo.description || "설명 없음"}`;
  }).join('\n');

  // Step 2: 최적화 수행 (프롬프트 고도화: README, Issue, PR 분석 포함)
  const finalPrompt = `
    ${tailoredInstruction}

    **[핵심 임무: GitHub 활동 기반 3대 소프트 스킬 심층 분석]**
    단순히 '무엇을 개발했는지(What)'를 넘어, **'어떻게 일하는 개발자인지(How)'**를 보여주기 위해 GitHub 활동을 입체적으로 분석(추론)하여 이력서와 Insight에 반영하십시오.
    사용자가 입력한 [리포지토리 설명]을 토대로, 해당 프로젝트에서 아래 3가지 역량이 발휘되었다고 가정하고 구체적인 성과로 변환하십시오.

    1. **README.md 및 문서화 (분석 키워드: '문서화 수준')**
       - 판단 기준: 프로젝트의 설치, 사용법, 아키텍처를 제3자가 이해하기 쉽게 구조화했는지 여부.
       - 작성 예시: "상세한 API 명세서와 아키텍처 다이어그램을 README에 포함하여 신규 팀원의 온보딩 시간을 단축함."

    2. **Issue Tracker 활동 (분석 키워드: '문제 해결 기여도')**
       - 판단 기준: 버그 리포트나 기능 요청 시 논리적으로 소통하고, 이슈를 체계적으로 관리했는지 여부.
       - 작성 예시: "이슈 템플릿을 도입하여 커뮤니케이션 비용을 줄이고, 우선순위에 기반한 이슈 관리로 스프린트 목표 달성에 기여함."

    3. **Pull Requests 및 코드 리뷰 (분석 키워드: '협업 태도')**
       - 판단 기준: PR 작성 시 배경과 변경 사항을 명확히 설명하고, 동료의 코드 리뷰에 적극적/건설적으로 참여했는지 여부.
       - 작성 예시: "PR 본문에 테스트 계획과 영향을 구체적으로 명시하여 리뷰 효율을 높이고, 동료 코드 리뷰를 통해 잠재적 버그를 사전에 차단함."

    [입력 데이터]
    1. 기존 이력서:
    ${resumeText}
    
    2. GitHub 리포지토리 목록 및 설명 (이 내용을 바탕으로 위 3대 역량을 추론하십시오):
    ${repoInfo}

    [필수 요구사항]
    1. **Insight 강화**: 출력 결과의 \`insights\` 배열에는 반드시 위 3가지 요소(문서화, 문제 해결, 협업)와 관련된 관찰 내용이 포함되어야 합니다.
    2. **전문적인 어조**: "열심히 했다" 대신 "주도했다", "개선했다", "구축했다" 등의 주도적인 동사를 사용하십시오.
    3. **증거 기반 매칭**: 이력서 본문에도 위 분석 내용을 녹여내어, 기술적 역량과 소프트 스킬이 조화를 이루도록 재작성하십시오.
    4. **출력 형식**: 반드시 아래 정의된 JSON 스키마를 따르십시오.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Pro 모델 사용 (복합 추론 및 작문 능력 우수)
      contents: finalPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedResume: {
              type: Type.STRING,
              description: "최적화된 이력서 전체 텍스트 (Markdown 포맷).",
            },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fileOrCommit: {
                    type: Type.STRING,
                    description: "이력서 보강에 사용된 (추론된) GitHub 파일 경로, 커밋, Issue 번호 또는 PR. (예: README.md, Issue #12, PR #5)",
                  },
                  observation: {
                    type: Type.STRING,
                    description: "해당 소스에서 발견한 기술적 역량 또는 소프트 스킬 (예: 문서화 수준, 문제 해결 기여도, 협업 태도).",
                  },
                  impact: {
                    type: Type.STRING,
                    description: "이 발견이 채용 담당자(페르소나)에게 긍정적으로 작용하는 이유.",
                  },
                },
                required: ["fileOrCommit", "observation", "impact"],
              },
            },
          },
          required: ["optimizedResume", "insights"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
        throw new Error("No response from AI");
    }
    
    return JSON.parse(jsonText) as OptimizationResult;

  } catch (error) {
    console.error("Gemini optimization failed:", error);
    throw new Error("이력서 최적화에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
