import { Type, ThinkingLevel } from "@google/genai";
import type {
  GapMapItem,
  TailoredInstructionWithRequirements,
  LearningRoadmap,
  SkillGapItem,
  LearningResource,
  LinkedInOptimization,
} from "../types";
import { getAI } from "./promptCache";
import {
  RESUME_HIERARCHY,
  GROUNDING_SKILLGAP,
  GROUNDING_RESUME_ONLY,
  SECURITY_RULE,
  AI_DETECTION_LINKEDIN,
} from "./promptBlocks";
import { withRetry } from './retry';
import { validateResumeInput, safeParseJSON } from './validation';
import { classifyError } from './errors';

/**
 * 스킬 갭에 대한 학습 로드맵 생성
 */
export async function analyzeLearningRoadmap(
  gapMap: GapMapItem[],
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements
): Promise<LearningRoadmap> {
  // missing/weak 항목만 필터링
  const gaps = gapMap.filter((item) => item.currentLevel === "missing" || item.currentLevel === "weak");

  const prompt = `
당신은 개발자 커리어 코칭 전문가입니다.

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
      model: "gemini-3-flash-preview",
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

/**
 * LinkedIn 프로필 최적화 생성
 */
export async function generateLinkedInOptimization(
  resumeText: string,
  _jobDescription: string,
  _instruction: TailoredInstructionWithRequirements
): Promise<LinkedInOptimization> {
  validateResumeInput(resumeText);

  const prompt = `
당신은 LinkedIn 프로필 최적화 전문가입니다.

# 입력 정보
## 이력서
<user-resume>
${resumeText}
</user-resume>

${AI_DETECTION_LINKEDIN}

# 요청사항
이력서를 기반으로 범용 LinkedIn 프로필을 최적화하세요.
특정 채용 공고에 맞추지 말고, 이 사람의 현재 역량과 경험을 가장 잘 드러내는 프로필을 만드세요.

1. **Headline 최적화** (120자 이내)
   - 현재 직무 + 핵심 기술 스택
   - LinkedIn 검색 최적화 (업계에서 많이 검색되는 키워드)
   - 전문성이 한눈에 드러나도록

2. **About 섹션 최적화** (2000자 이내)
   - 전문성과 경험 요약
   - 주요 성과와 임팩트
   - 개인적이고 진정성 있는 톤 유지
   - 커리어 비전 포함

3. **Experience 하이라이트 최적화**
   - 각 주요 경험에 대한 최적화된 설명
   - 정량적 성과 강조
   - 업계 표준 키워드 활용

4. **키워드 밀도 분석**
   - 이력서에서 추출한 핵심 기술/역량 키워드
   - 현재 프로필에서의 등장 횟수
   - 권장 등장 횟수

[Few-shot 예시]
GOOD headline: "백엔드 개발자 | 대용량 트래픽 처리 전문 | Redis, Kafka, Spring Boot" (역할 + 전문성 + 기술 스택)
BAD headline: "열정적인 개발자입니다" (구체성 없음, 검색 불가)
GOOD experience highlight: "일 50만건 주문 처리 API 설계, 응답시간 3.2초→0.4초 단축 (Redis 캐싱 + Kafka 비동기 큐)" (수치 + 기술 + 임팩트)
BAD experience highlight: "서버 개발 담당" (성과 없음, 기술 없음)

모든 내용은 한국어로 작성하세요.

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. headline이 120자 이내인가?
2. about이 2000자 이내인가?
3. experienceHighlights 각 항목이 이력서에 실제 존재하는 경험인가?
4. keywordDensity의 각 keyword가 이력서 원문에 등장하는가?
`;

  const linkedInSchema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING },
      about: { type: Type.STRING },
      experienceHighlights: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING },
            optimizedDescription: { type: Type.STRING }
          },
          required: ["role", "optimizedDescription"]
        }
      },
      keywordDensity: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            keyword: { type: Type.STRING },
            count: { type: Type.NUMBER },
            recommended: { type: Type.NUMBER }
          },
          required: ["keyword", "count", "recommended"]
        }
      }
    },
    required: ["headline", "about", "experienceHighlights", "keywordDensity"]
  };

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: [SECURITY_RULE, GROUNDING_RESUME_ONLY, RESUME_HIERARCHY].join('\n\n'),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: linkedInSchema,
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("LinkedIn 최적화 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON<LinkedInOptimization>(jsonText, 'LinkedIn 최적화');

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("LinkedIn 최적화 생성 실패:", error);
    throw classifyError(error);
  }
}
