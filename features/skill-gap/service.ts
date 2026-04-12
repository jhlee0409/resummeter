import { Type, ThinkingLevel } from "@google/genai";
import type {
  GapMapItem,
  TailoredInstructionWithRequirements,
  LearningRoadmap,
  SkillGapItem,
  CompanyContext,
} from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  RESUME_HIERARCHY,
  GROUNDING_SKILLGAP,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

/**
 * 스킬 갭에 대한 학습 로드맵 생성
 */
export async function analyzeLearningRoadmap(
  gapMap: GapMapItem[],
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  companyContext?: CompanyContext | null,
): Promise<LearningRoadmap> {
  // missing/weak 항목만 필터링
  const gaps = gapMap.filter((item) => item.currentLevel === "missing" || item.currentLevel === "weak");
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const prompt = `
당신은 개발자 커리어 코칭 전문가입니다.
${companyBlock}

# 입력 정보
## 채용 공고
${jobDescription}

## 현재 스킬 갭 분석
${JSON.stringify(gaps, null, 2)}

## 맞춤형 평가 기준
${JSON.stringify(instruction, null, 2)}

# 요청사항
각 스킬 갭에 대해 학습 로드맵을 생성하세요.
- 각 갭의 우선순위를 평가하고 (critical, high, medium, low)
- 학습 리소스를 최소 3개 이상 추천하세요
- 플랫폼: 인프런, Udemy, Coursera, YouTube, 공식문서
- URL은 검색 링크 형태로 제공 (예: https://www.inflearn.com/courses?s=keyword)
- 각 리소스의 난이도를 명시하세요 (beginner, intermediate, advanced)
- 예상 학습 노력도를 추정하세요 (예: "2-3주", "1개월", "3개월")

우선순위별로 정렬하여 반환하세요 (critical → high → medium → low).
`;

  const learningResourcesSchema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            requirement: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: ["hard-skill", "soft-skill", "experience", "education"]
            },
            currentLevel: {
              type: Type.STRING,
              enum: ["strong", "weak", "missing"]
            },
            jdMentions: { type: Type.NUMBER },
            resumeMentions: { type: Type.NUMBER },
            relatedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestion: { type: Type.STRING },
            priority: {
              type: Type.STRING,
              enum: ["critical", "high", "medium", "low"]
            },
            learningResources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  platform: {
                    type: Type.STRING,
                    enum: ["inflearn", "udemy", "coursera", "youtube", "docs"]
                  },
                  url: { type: Type.STRING },
                  level: {
                    type: Type.STRING,
                    enum: ["beginner", "intermediate", "advanced"]
                  }
                },
                required: ["title", "platform", "url", "level"]
              }
            },
            estimatedEffort: { type: Type.STRING }
          },
          required: [
            "requirement",
            "category",
            "currentLevel",
            "jdMentions",
            "resumeMentions",
            "relatedActions",
            "suggestion",
            "priority",
            "learningResources",
            "estimatedEffort"
          ]
        }
      }
    },
    required: ["items"]
  };

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction: [RESUME_HIERARCHY, GROUNDING_SKILLGAP].join('\n\n'),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: learningResourcesSchema,
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("학습 로드맵 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ items: SkillGapItem[] }>(jsonText, '학습 로드맵 생성');

    // 우선순위별 정렬
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedItems: SkillGapItem[] = parsed.items.sort(
      (a: SkillGapItem, b: SkillGapItem) =>
        priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    const criticalGaps = sortedItems.filter(item => item.priority === "critical").length;

    return {
      items: sortedItems,
      totalSkillGaps: sortedItems.length,
      criticalGaps,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("학습 로드맵 생성 실패:", error);
    throw classifyError(error);
  }
}
