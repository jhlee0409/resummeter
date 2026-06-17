import { Type, ThinkingLevel } from "@google/genai";
import { TailoredInstructionWithRequirements, GithubRepo, GitHubFetchResult, JdRequirement, CompanyContext } from "../../types";
import { getAI, MODELS, getCacheFields, type SessionCache } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { validateResumeInput, validateJDInput, safeParseJSON, validateOutput, AnalysisOutputSchema } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import { formatRepoInfo, formatCompanyContext } from "../../shared/prompt/formatters";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  HR_PERSPECTIVE_ANALYSIS,
  formatInstruction,
} from "../../shared/prompt/promptBlocks";

// ─────────────────────────────────────────────────────────────
// Stage 2a Internal Types
// ─────────────────────────────────────────────────────────────

export interface IntermediateGapItem {
  requirement: string;
  category: 'hard-skill' | 'soft-skill' | 'experience' | 'education';
  currentLevel: 'strong' | 'weak' | 'missing';
  jdMentions: number;
  resumeMentions: number;
  suggestion: string;
}

export interface AnalysisItem {
  id: string;
  targetSection: string;
  before: string;
  issue: string;
  direction: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'keyword-gap' | 'quantify' | 'reframe' | 'add-missing' | 'remove';
  relevantJdKeywords: string[];
}

export interface AnalysisIntermediate {
  matchScore?: number; // deprecated: Scoring Engine이 대체
  summary: string;
  gapMap: IntermediateGapItem[];
  analysisItems: AnalysisItem[];
  quickWins: string[];
}

// ─────────────────────────────────────────────────────────────
// Stage 2a: analyzeResume (Pro) — 분석 전용
// ─────────────────────────────────────────────────────────────

export async function analyzeResume(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  companyContext?: CompanyContext | null,
  sessionCache?: SessionCache | null,
): Promise<AnalysisIntermediate> {
  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const today = new Date().toISOString().split('T')[0];
  const { buildJobProfileContext, resolveJobProfile } = await import('../research/industryDetect');
  const industryContext = buildJobProfileContext(resolveJobProfile(instruction));
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  // 캐시 히트 시 context(이력서/JD/instruction/repos)는 캐시에서 로드됨 → prompt에서 제외
  const cached = !!sessionCache?.cacheName;
  const contextBlock = cached ? '' : `
${formatInstruction(instruction)}
- 요구사항:
${instruction.jdRequirements.map((r: JdRequirement, i: number) =>
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

${repoInfo ? `[GitHub 리포지토리 (참고용)]\n${repoInfo}\n` : ''}`;

  const prompt = `[역할]
당신은 이력서 분석 전문가입니다.
${industryContext}
${companyBlock}

[현재 날짜]
${today} — 이 날짜 기준으로 과거/현재/미래를 판단하십시오.

[입력 품질 가드]
이력서가 100자 미만이면: 분석을 중단하고 "이력서 내용이 부족합니다. 최소 경력/프로젝트 1개 이상을 포함해주세요."를 summary에 반환하십시오.
JD가 50자 미만이면: "채용 공고 내용이 부족합니다. 자격요건과 직무 설명을 포함해주세요."를 summary에 반환하십시오.
분석에 필요한 정보가 부족하면 추론하지 말고, 부족한 항목을 명시하십시오.

[핵심 원칙 — 모든 분석의 기초]
원칙 1: 이력서 원문에 명시된 내용만 분석 대상입니다.
원칙 2: 이력서에 없는 기술/경험/성과는 존재하지 않는 것으로 취급합니다.
원칙 3: before 필드는 이력서에서 복사-붙여넣기한 원문이어야 합니다.
${contextBlock}
${HR_PERSPECTIVE_ANALYSIS}

[분석 태스크]
각 JD 요구사항에 대해:
1. 이력서에서 관련 문장을 정확히 찾아 before에 원문 그대로 인용하십시오.
2. strong(명확히 충족) / weak(부분 충족) / missing(전혀 언급 없음)으로 판정하십시오.
3. 개선 방향을 1줄로 요약하십시오 (수정 예시는 작성하지 마십시오).
4. 관련 JD 키워드를 relevantJdKeywords에 기재하십시오.

[검증 규칙]
- before 필드에는 이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장만 허용됩니다.
- 이력서에 없는 기술명이 before에 등장하면 해당 분석 항목은 무효입니다.
- missing인 경우 before는 가장 관련성 높은 이력서 문장을 인용하거나, 해당 영역이 완전히 없으면 "(이력서에 관련 내용 없음)"으로 표시하십시오.

[매칭 정밀도 규칙]
- "고객과 직접 소통하며", "사용자 관점에서 재구성" 같은 이력서 문장은 "고객 중심 사고"의 직접적 증거입니다. 이러한 문장이 있으면 weak가 아닌 strong으로 판정하십시오.
- 동사+목적어 패턴이 JD 요구사항과 의미적으로 일치하면 strong입니다. 정확한 키워드가 없어도 행동 증거가 있으면 인정하십시오.
- weak는 "관련 경험이 있지만 구체적 증거/수치가 부족한 경우"에만 사용하십시오.`;

  try {
    const cacheFields = getCacheFields(sessionCache, [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY]);
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.pro,
      contents: prompt,
      config: {
        ...cacheFields,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "전체 분석 요약 2-3문장" },
          gapMap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirement: { type: Type.STRING, description: "JD 요구사항 원문" },
                category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                currentLevel: { type: Type.STRING, description: "strong(이력서에 명확히 충족), weak(부분 충족), missing(전혀 언급 없음)" },
                jdMentions: { type: Type.NUMBER, description: "JD에서 이 요구사항 관련 언급 횟수" },
                resumeMentions: { type: Type.NUMBER, description: "이력서에서 이 요구사항 관련 언급 횟수" },
                  suggestion: { type: Type.STRING, description: "이 gap에 대한 한 줄 개선 방향" },
                },
                required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "suggestion"],
              },
            },
            analysisItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "고유 식별자 (action-1, action-2, ...)" },
                  targetSection: { type: Type.STRING, description: "이력서에서 해당 내용이 위치한 섹션명" },
                  before: { type: Type.STRING, description: "이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장. 원문에 없는 내용 포함 시 무효" },
                  issue: { type: Type.STRING, description: "이 문장의 문제점 1줄 요약" },
                  direction: { type: Type.STRING, description: "개선 방향 1줄 요약. 수정 예시는 작성하지 않음" },
                  priority: { type: Type.STRING, description: "critical(JD 필수요건 미충족), high(우대사항), medium(표현 개선), low(선택적)" },
                  category: { type: Type.STRING, description: "keyword-gap, quantify, reframe, add-missing, remove 중 하나" },
                  relevantJdKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "이 항목과 관련된 JD 키워드" },
                },
                required: ["id", "targetSection", "before", "issue", "direction", "priority", "category", "relevantJdKeywords"],
              },
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "즉시 적용 가능한 개선 포인트 3-5개. 반드시 이력서에 이미 있는 내용의 표현 개선만 제안. 이력서에 없는 기술/경험/자격증을 추가하라는 제안 금지. 이름/연락처 같은 기본 정보 수정 제안 금지." },
          },
          required: ["summary", "gapMap", "analysisItems", "quickWins"],
        },
      },
    }));

    const jsonText = response.text;
    const parsed = safeParseJSON<AnalysisIntermediate>(jsonText, '이력서 분석');
    validateOutput(parsed, AnalysisOutputSchema, '이력서 분석');
    return parsed;
  } catch (e) {
    throw classifyError(e);
  }
}
