import { GoogleGenAI, Type } from "@google/genai";
import type {
  GapMapItem,
  TailoredInstructionWithRequirements,
  LearningRoadmap,
  SkillGapItem,
  LearningResource,
  LinkedInOptimization,
} from "../types";

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

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: learningResourcesSchema,
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("학습 로드맵 생성 결과가 비어있습니다.");

  const parsed = JSON.parse(jsonText);

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
}

/**
 * LinkedIn 프로필 최적화 생성
 */
export async function generateLinkedInOptimization(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements
): Promise<LinkedInOptimization> {
  const prompt = `
당신은 LinkedIn 프로필 최적화 전문가입니다.

# 입력 정보
## 이력서
${resumeText}

## 채용 공고
${jobDescription}

## 맞춤형 가이드라인
${JSON.stringify(instruction, null, 2)}

# 요청사항
다음을 생성하세요:

1. **Headline 최적화** (120자 이내)
   - 현재 직무 + 핵심 기술 스택
   - 채용 공고 키워드 포함
   - 검색 최적화

2. **About 섹션 최적화** (2000자 이내)
   - 전문성과 경험 요약
   - 주요 성과와 임팩트
   - 채용 공고와 정렬
   - 개인적인 톤 유지

3. **Experience 하이라이트 최적화**
   - 각 주요 경험에 대한 최적화된 설명
   - 정량적 성과 강조
   - 키워드 밀도 고려

4. **키워드 밀도 분석**
   - 채용 공고의 핵심 키워드
   - 현재 프로필에서의 등장 횟수
   - 권장 등장 횟수

모든 내용은 한국어로 작성하세요.
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

  const response = await getAI().models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: linkedInSchema,
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("LinkedIn 최적화 생성 결과가 비어있습니다.");

  const parsed = JSON.parse(jsonText);

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}
