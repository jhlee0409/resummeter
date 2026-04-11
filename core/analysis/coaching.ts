import { Type, ThinkingLevel } from "@google/genai";
import { CoachingResult, TailoredInstructionWithRequirements, GithubRepo, GitHubFetchResult, Evidence, GapMapItem, ActionItem, CompanyContext } from "../../types";
import { getAI, type SessionCache } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { safeParseJSON, validateOutput, CoachingOutputSchema } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import { formatRepoInfo, formatCompanyContext } from "../../shared/prompt/formatters";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  AI_DETECTION_KO_BASE,
  formatInstruction,
} from "../../shared/prompt/promptBlocks";
import { analyzeResume, type AnalysisIntermediate, type AnalysisItem } from "./resumeAnalysis";

// ─────────────────────────────────────────────────────────────
// Stage 2b: generateCoaching (Pro) — 코칭 생성 전용
// ─────────────────────────────────────────────────────────────

async function generateCoaching(
  analysis: AnalysisIntermediate,
  resumeText: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  companyContext?: CompanyContext | null,
  sessionCache?: SessionCache | null,
): Promise<CoachingResult> {
  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const today = new Date().toISOString().split('T')[0];
  const { buildIndustryContext } = await import('../../services/industryDetect');
  const industryContext = instruction.detectedIndustry ? buildIndustryContext(instruction.detectedIndustry) : '';
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const prompt = `[역할]
당신은 이력서 코칭 전문가입니다.
${industryContext}
${companyBlock}

[현재 날짜]
${today} — 이 날짜 기준으로 과거/현재/미래를 판단하십시오.

[핵심 원칙 — 모든 생성의 기초]
원칙 1: 아래 [분석 결과]에 명시된 항목만 코칭합니다.
원칙 2: after는 before 문장의 단어를 재배열/압축/구체화한 결과입니다. 새로운 내용 창작이 아닙니다.
원칙 3: 이력서 원문에 없는 기술명/회사명/수치는 반드시 [플레이스홀더]로 표시합니다.
${repoInfo ? '원칙 4: GitHub 데이터는 evidence.content에만 기재합니다. after 문장에는 포함하지 않습니다.' : ''}

[Few-shot 예시 — GOOD vs BAD]

=== 예시 1: 표현 개선 (GOOD) ===
{
  "before": "백엔드 API 개발 및 유지보수",
  "suggestion": "구체적인 규모감을 드러내세요. 이력서에 언급된 기술만 활용하세요.",
  "after": "백엔드 API 설계, 개발 및 유지보수 [처리 규모/성과 수치 기입]",
  "category": "quantify"
}

=== 예시 1: 같은 입력에 대한 BAD ===
{
  "before": "백엔드 API 개발 및 유지보수",
  "after": "Spring Boot + Kotlin 기반 MSA 백엔드 API 설계/개발, 일 100만 건 트래픽 처리",
  "문제": "Spring Boot, Kotlin, MSA, 100만 건 — 모두 원문에 없는 날조"
}

=== 예시 2: 키워드 갭 (GOOD) ===
{
  "before": "팀 프로젝트에서 협업 경험",
  "suggestion": "JD에서 요구하는 'Agile/Scrum' 키워드가 이력서에 부족합니다. 관련 경험이 있다면 추가를 고려하세요.",
  "after": "팀 프로젝트에서 협업 경험 [Agile/Scrum 관련 경험이 있다면 기입]",
  "category": "keyword-gap"
}

=== 예시 2: 같은 입력에 대한 BAD ===
{
  "before": "팀 프로젝트에서 협업 경험",
  "after": "Agile/Scrum 기반 크로스펑셔널 팀에서 스프린트 플래닝 및 회고 주도",
  "문제": "Agile, Scrum, 크로스펑셔널, 스프린트 — 모두 원문에 없는 날조. 원문+플레이스홀더 패턴을 사용해야 함"
}

=== 예시 3: 수치 추가 (GOOD) ===
{
  "before": "결제 시스템 개발 및 운영",
  "suggestion": "처리 규모나 성과를 수치로 드러내세요.",
  "after": "결제 시스템 개발 및 운영 [월간 처리 건수/금액 기입]",
  "category": "quantify"
}

=== 예시 3: 같은 입력에 대한 BAD ===
{
  "before": "결제 시스템 개발 및 운영",
  "after": "월 100억 원 규모 결제 시스템 설계 및 운영, 99.99% 가용성 달성",
  "문제": "100억 원, 99.99% — 이력서에 없는 수치 날조"
}

=== 예시 4: 항목 추가 (GOOD) ===
{
  "before": "(이력서에 관련 내용 없음)",
  "suggestion": "JD에서 요구하는 '상태관리' 경험이 이력서에 없습니다. 관련 경험이 있다면 추가를 권장합니다.",
  "after": "[Redux/Zustand 등 상태관리 라이브러리 사용 경험이 있다면 기입]",
  "category": "add-missing"
}

[분석 결과 (Stage 2a 출력)]
- matchScore: ${analysis.matchScore}
- summary: ${analysis.summary}
- gapMap:
${JSON.stringify(analysis.gapMap, null, 2)}
- analysisItems:
${JSON.stringify(analysis.analysisItems, null, 2)}
- quickWins: ${JSON.stringify(analysis.quickWins)}

[이력서 원문 (before 검증용)]
<user-resume>
${resumeText}
</user-resume>

${repoInfo ? `[GitHub 리포지토리 (evidence 작성용)]\n${repoInfo}\n` : ''}[생성 태스크]
각 analysisItem에 대해:
1. before: 분석 결과의 before를 그대로 복사하십시오.
2. **suggestion (필수)**: analysisItem의 issue + direction을 조합하여 2-3문장 코칭 지시("~하세요" 형태)로 작성하십시오. 이 필드를 빠뜨리지 마십시오.
3. after: before 문장을 suggestion에 따라 표현만 개선하십시오. 새 기술/경험 삽입 시 반드시 구체적인 예시가 포함된 [플레이스홀더]를 사용하십시오.
   - BAD: "[적용한 아키텍처]" ← 너무 추상적
   - GOOD: "[예: 마이크로 프론트엔드, 디자인 시스템, 모노레포 등 적용한 아키텍처]" ← 지원자가 바로 선택 가능
   - BAD: "[비즈니스 문제]" ← 무엇을 써야 할지 모름
   - GOOD: "[예: 이탈률 감소, 전환율 개선, 처리시간 단축 등 해결한 문제]" ← 구체적 방향 제시
4. evidence: JD 원문 인용 또는 GitHub 데이터 인용을 근거로 제시하십시오.
5. optimizedResume: 모든 after를 적용한 완성된 이력서 (Markdown 형식).

[insights 작성 규칙]
insights 배열의 각 항목은 반드시 다음 필드를 포함:
- source: 근거 출처 (이력서 문장 인용)
- confidence: verified | analyzed | inferred
- category: documentation | problem-solving | collaboration | technical | soft-skill
- **observation (필수)**: 발견한 강점/약점 요약 (1-2문장)
- **impact (필수)**: 이 관찰이 지원자의 적합도에 미치는 영향 (1문장)

[톤 가이드]
- 스타일: ${instruction.toneGuide.style}
- 종결: ${instruction.toneGuide.endings}
- 피할 표현: ${instruction.toneGuide.avoidPatterns.join(', ')}
- 원문의 문체(명사형/서술형, 존댓말/평어, 간결/상세)를 분석하고 after에서 동일하게 유지하십시오.

${AI_DETECTION_KO_BASE}

[검증 규칙]
- after에 이력서 원문에 없는 고유명사(기술명, 회사명, 프레임워크명)가 등장하면 해당 항목은 무효입니다.
${repoInfo ? '- GitHub 데이터는 evidence.content에만 기재하십시오. after 문장에 직접 삽입하지 마십시오.' : ''}
- after가 원문과 완전히 다른 문장이 되어서는 안 됩니다. 원문의 골격을 유지하면서 표현만 개선하십시오.
- quickWins에 이력서에 없는 기술/라이브러리/자격증을 추가하라는 제안은 절대 금지입니다.
- 이름, 이메일, 연락처 같은 기본 개인정보는 수정 대상이 아닙니다. actionItems에서 제외하십시오.

[자기 검증 — 반드시 수행]
생성 완료 후 모든 actionItem에 대해 검증하십시오:
1. before가 이력서 원문에 실제로 존재하는가?
2. after에 이력서에 없는 고유명사가 [플레이스홀더] 없이 삽입되었는가?
3. evidence.content가 실제 JD 원문 또는 GitHub 데이터에서 확인 가능한가?
위반 항목이 있으면 해당 항목을 수정한 후 최종 결과를 반환하십시오.`;

  const coachCacheFields = sessionCache?.cacheName
    ? { cachedContent: sessionCache.cacheName }
    : { systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n') };

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        ...coachCacheFields,
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedResume: { type: Type.STRING, description: "모든 after를 적용한 완성된 이력서 (Markdown)" },
            summary: { type: Type.STRING, description: "전체 분석 요약 3문장: 1문장 강점 + 1문장 약점/보완 필요 영역 + 1문장 코칭 적용 시 기대 효과. 긍정만 쓰지 마십시오." },
            gapMap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  requirement: { type: Type.STRING, description: "JD 요구사항" },
                  category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                  currentLevel: { type: Type.STRING, description: "strong(명확히 충족), weak(부분 충족), missing(전혀 언급 없음)" },
                  jdMentions: { type: Type.NUMBER },
                  resumeMentions: { type: Type.NUMBER },
                  relatedActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "관련 ActionItem ID 목록" },
                  suggestion: { type: Type.STRING, description: "이 gap에 대한 한 줄 개선 제안" },
                },
                required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "relatedActions", "suggestion"],
              },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  targetSection: { type: Type.STRING },
                  before: { type: Type.STRING, description: "이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장. 원문에 없는 내용 포함 시 무효" },
                  suggestion: { type: Type.STRING, description: "코칭 지시. ~하세요 형태. 2-3문장" },
                  after: { type: Type.STRING, description: "before 문장의 표현만 개선한 결과. 원문에 없는 기술명/경험 삽입 시 [플레이스홀더] 사용 필수" },
                  evidence: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "jd, github, best-practice 중 하나" },
                        content: { type: Type.STRING, description: "JD 원문 직접 인용, GitHub 실제 데이터, 또는 일반적 채용 best practice" },
                        source: { type: Type.STRING },
                        confidence: { type: Type.STRING, description: "verified(직접 확인) 또는 inferred(추론)" },
                      },
                      required: ["type", "content", "confidence"],
                    },
                  },
                  priority: { type: Type.STRING, description: "critical, high, medium, low 중 하나" },
                  category: { type: Type.STRING, description: "keyword-gap, quantify, reframe, add-missing, remove 중 하나" },
                },
                required: ["id", "targetSection", "before", "suggestion", "after", "evidence", "priority", "category"],
              },
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "근거 출처" },
                  confidence: { type: Type.STRING, description: "verified, analyzed, inferred 중 하나" },
                  category: { type: Type.STRING, description: "documentation, problem-solving, collaboration, technical, soft-skill 중 하나" },
                  observation: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                },
                required: ["source", "confidence", "category", "observation", "impact"],
              },
            },
          },
          required: ["optimizedResume", "summary", "gapMap", "actionItems", "quickWins", "insights"],
        },
      },
    }));

    const jsonText = response.text;
    const parsed = safeParseJSON<CoachingResult>(jsonText, '코칭 생성');
    validateOutput(parsed, CoachingOutputSchema, '코칭 생성');
    return parsed;

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('schema') || errorMsg.includes('depth')) {
      console.warn("Nested schema failed, trying fallback schema...");
      return generateCoachingWithFallbackSchema(prompt, coachCacheFields);
    }
    throw classifyError(error);
  }
}

// Fallback: flatten evidence out of actionItems (schema depth 에러 대비)
async function generateCoachingWithFallbackSchema(prompt: string, cacheOverride?: Record<string, unknown>): Promise<CoachingResult> {
  const response = await getAI().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      ...(cacheOverride || {}),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedResume: { type: Type.STRING },
          summary: { type: Type.STRING },
          gapMap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirement: { type: Type.STRING },
                category: { type: Type.STRING },
                currentLevel: { type: Type.STRING },
                jdMentions: { type: Type.NUMBER },
                resumeMentions: { type: Type.NUMBER },
                relatedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestion: { type: Type.STRING },
              },
              required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "relatedActions", "suggestion"],
            },
          },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                targetSection: { type: Type.STRING },
                before: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                after: { type: Type.STRING },
                evidenceRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                priority: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["id", "targetSection", "before", "suggestion", "after", "evidenceRefs", "priority", "category"],
            },
          },
          evidenceList: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                actionItemId: { type: Type.STRING },
                evidenceType: { type: Type.STRING },
                content: { type: Type.STRING },
                source: { type: Type.STRING },
                confidence: { type: Type.STRING },
              },
              required: ["actionItemId", "evidenceType", "content", "confidence"],
            },
          },
          quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                confidence: { type: Type.STRING },
                category: { type: Type.STRING },
                observation: { type: Type.STRING },
                impact: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
              required: ["source", "confidence", "category", "observation", "impact"],
            },
          },
        },
        required: ["optimizedResume", "summary", "gapMap", "actionItems", "evidenceList", "quickWins", "insights"],
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("No response from AI (fallback)");

  const raw = JSON.parse(jsonText);

  // Remap evidenceList back into actionItems
  const evidenceByAction: Record<string, Evidence[]> = {};
  for (const e of raw.evidenceList || []) {
    (evidenceByAction[e.actionItemId] ??= []).push({
      type: e.evidenceType as Evidence['type'],
      content: e.content,
      source: e.source,
      confidence: e.confidence as Evidence['confidence'],
    });
  }

  const actionItems = (raw.actionItems || []).map((a: Record<string, unknown>) => ({
    ...a,
    evidence: evidenceByAction[a.id as string] ?? [],
  }));

  return { ...raw, actionItems, evidenceList: undefined } as CoachingResult;
}

// ─────────────────────────────────────────────────────────────
// relatedActions Backfill
// ─────────────────────────────────────────────────────────────

function backfillRelatedActions(
  gapMap: GapMapItem[],
  actionItems: ActionItem[],
  analysisItems: AnalysisItem[]
): GapMapItem[] {
  return gapMap.map(gap => {
    // Find analysisItems whose relevantJdKeywords overlap with this gap's requirement
    const gapReq = gap.requirement.toLowerCase();
    const matchingActionIds: string[] = [];

    for (const ai of analysisItems) {
      const keywordsMatch = ai.relevantJdKeywords.some(kw =>
        gapReq.includes(kw.toLowerCase()) || kw.toLowerCase().includes(gapReq.split(' ')[0])
      );
      if (keywordsMatch && actionItems.some(a => a.id === ai.id)) {
        matchingActionIds.push(ai.id);
      }
    }

    return {
      ...gap,
      relatedActions: matchingActionIds.length > 0 ? matchingActionIds : gap.relatedActions,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// coachResume Wrapper: Stage 2a → Stage 2b → Backfill
// ─────────────────────────────────────────────────────────────

export const coachResume = async (
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  onStageChange?: (stage: 'resume-analysis' | 'coaching') => void,
  companyContext?: CompanyContext | null,
  sessionCache?: SessionCache | null,
): Promise<CoachingResult> => {
  // Stage 2a: 분석
  onStageChange?.('resume-analysis');
  const analysis = await analyzeResume(resumeText, jobDescription, instruction, githubRepos, githubData, companyContext, sessionCache);

  // Stage 2b: 코칭 생성
  onStageChange?.('coaching');
  const result = await generateCoaching(analysis, resumeText, instruction, githubRepos, githubData, companyContext, sessionCache);

  // Backfill relatedActions using analysis intermediate data
  const enrichedGapMap = backfillRelatedActions(result.gapMap, result.actionItems, analysis.analysisItems);

  // Use analysis matchScore/summary if Stage 2b didn't override meaningfully
  return {
    ...result,
    gapMap: enrichedGapMap,
    matchScore: 0, // Scoring Engine이 규칙 기반으로 재계산
    summary: analysis.summary || result.summary,
    quickWins: analysis.quickWins.length > 0 ? analysis.quickWins : result.quickWins,
  };
};
