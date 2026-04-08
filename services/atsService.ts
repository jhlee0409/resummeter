import { GoogleGenAI, Type } from "@google/genai";
import type { AtsScore, DetailedScore } from "../types";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/**
 * ATS 점수 분석: 키워드 매칭, 포맷 호환성, 약어/풀네임 병기 제안, 키워드 스터핑 감지
 */
export async function analyzeAtsScore(
  resumeText: string,
  jobDescription: string,
  instruction: string
): Promise<AtsScore> {
  try {
    const prompt = `당신은 ATS(Applicant Tracking System) 전문가입니다.

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

다음 이력서를 채용 공고(JD)와 비교하여 ATS 관점에서 분석하세요.

# 채용 공고
${jobDescription}

# 맞춤형 지시사항
${instruction}

# 이력서
${resumeText}

## 분석 요구사항

1. **키워드 매칭**: JD에서 중요한 키워드를 추출하고, 이력서에서 각 키워드의 존재 여부와 빈도를 분석하세요.
   - foundInResume: 이력서에 존재하는지 (boolean)
   - frequency: 이력서에서 등장 횟수
   - context: 키워드가 사용된 맥락 (간단히)
   - suggestion: 누락된 경우 추가 제안, 과도하게 사용된 경우 경고

2. **키워드 스터핑 감지**:
   - 전체 키워드 개수를 세고, 적정 범위(recommendedRange)를 제시
   - 부자연스러운 키워드 반복이 있으면 isStuffing = true, stuffingWarnings에 경고 메시지 추가

3. **약어 병기 제안**:
   - 이력서에 약어만 있거나 풀네임만 있는 경우, 둘 다 병기할 것을 제안
   - 예: "React" → "React (ReactJS)", "AI" → "AI (Artificial Intelligence)"

4. **포맷 이슈**:
   - ATS가 파싱하기 어려운 포맷 요소를 탐지 (예: 표, 이미지, 복잡한 레이아웃, 특수문자 남용 등)
   - formatIssues 배열에 문제점 나열

5. **점수 산출**:
   - overall: 전체 ATS 친화도 점수 (0-100)
   - keywordMatch: 키워드 매칭 점수 (0-100)
   - formatCompliance: 포맷 준수 점수 (0-100)

JSON 스키마에 맞춰 반환하세요.`;

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall: { type: Type.NUMBER },
            keywordMatch: { type: Type.NUMBER },
            formatCompliance: { type: Type.NUMBER },
            keywordCount: { type: Type.NUMBER },
            recommendedRange: {
              type: Type.OBJECT,
              properties: {
                min: { type: Type.NUMBER },
                max: { type: Type.NUMBER },
              },
              required: ["min", "max"],
            },
            isStuffing: { type: Type.BOOLEAN },
            stuffingWarnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING },
                  foundInResume: { type: Type.BOOLEAN },
                  frequency: { type: Type.NUMBER },
                  context: { type: Type.STRING },
                  suggestion: { type: Type.STRING, nullable: true },
                },
                required: [
                  "keyword",
                  "foundInResume",
                  "frequency",
                  "context",
                ],
              },
            },
            abbreviations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  expanded: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ["original", "expanded", "suggestion"],
              },
            },
            formatIssues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "overall",
            "keywordMatch",
            "formatCompliance",
            "keywordCount",
            "recommendedRange",
            "isStuffing",
            "stuffingWarnings",
            "keywords",
            "abbreviations",
            "formatIssues",
          ],
        },
      },
    });

    const jsonText = response.text;
    return JSON.parse(jsonText) as AtsScore;
  } catch (error) {
    console.error("ATS 점수 분석 중 오류 발생:", error);
    throw new Error("ATS 점수 분석에 실패했습니다.");
  }
}

/**
 * 상세 점수 분석: 섹션별 점수, Action Verb 분석, 정량화 분석, STAR 구조 감지
 */
export async function analyzeDetailedScore(
  resumeText: string,
  jobDescription: string,
  instruction: string
): Promise<DetailedScore> {
  try {
    const prompt = `당신은 이력서 코칭 전문가입니다.

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

다음 이력서를 상세히 분석하여 섹션별 점수, Action Verb 분석, 정량화 분석, STAR 구조 분석을 수행하세요.

# 채용 공고
${jobDescription}

# 맞춤형 지시사항
${instruction}

# 이력서
${resumeText}

## 분석 요구사항

1. **섹션별 점수 (breakdown)**:
   - techStack: 기술 스택 관련성 (가중치 40%, 0-100점)
   - experience: 경력 관련성 (가중치 25%, 0-100점)
   - impact: 임팩트/성과 (가중치 20%, 0-100점)
   - readability: 가독성/구조 (가중치 15%, 0-100점)
   - 각 섹션의 details에는 구체적인 평가 내용을 배열로 담으세요.

2. **Action Verb 분석 (actionVerbs)**:
   - weak: 약한 동사 목록 (예: "담당했다", "했다", "수행했다" 등)
     - verb: 약한 동사
     - line: 해당 문장
     - suggestion: 강한 동사로의 전환 제안 (예: "구축했다", "최적화했다", "설계했다")
   - strong: 이미 사용된 강한 동사 목록

3. **정량화 분석 (quantification)**:
   - quantified: 이미 정량적 성과가 잘 표현된 문장 목록
   - needsQuantification: 수치화가 필요한 문장
     - line: 해당 문장
     - suggestion: 수치화 제안 (예: "사용자 수, 성능 개선 %, 처리 시간 단축 등")

4. **STAR 구조 분석 (starAnalysis)**:
   - 이력서의 각 주요 경력 항목에 대해:
     - section: 경력 항목 제목 또는 요약
     - hasS: Situation(상황) 포함 여부
     - hasT: Task(과제) 포함 여부
     - hasA: Action(행동) 포함 여부
     - hasR: Result(결과) 포함 여부
     - completeness: STAR 완성도 (0-100, 4개 요소가 모두 있으면 100)
     - suggestion: 부족한 요소가 있으면 추가 제안

5. **전체 점수 (overall)**:
   - 섹션별 점수를 가중 평균하여 산출 (0-100)

JSON 스키마에 맞춰 반환하세요.`;

    const response = await getAI().models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall: { type: Type.NUMBER },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                techStack: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    weight: { type: Type.NUMBER },
                    details: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["score", "weight", "details"],
                },
                experience: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    weight: { type: Type.NUMBER },
                    details: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["score", "weight", "details"],
                },
                impact: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    weight: { type: Type.NUMBER },
                    details: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["score", "weight", "details"],
                },
                readability: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    weight: { type: Type.NUMBER },
                    details: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["score", "weight", "details"],
                },
              },
              required: ["techStack", "experience", "impact", "readability"],
            },
            actionVerbs: {
              type: Type.OBJECT,
              properties: {
                weak: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      verb: { type: Type.STRING },
                      line: { type: Type.STRING },
                      suggestion: { type: Type.STRING },
                    },
                    required: ["verb", "line", "suggestion"],
                  },
                },
                strong: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["weak", "strong"],
            },
            quantification: {
              type: Type.OBJECT,
              properties: {
                quantified: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                needsQuantification: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      line: { type: Type.STRING },
                      suggestion: { type: Type.STRING },
                    },
                    required: ["line", "suggestion"],
                  },
                },
              },
              required: ["quantified", "needsQuantification"],
            },
            starAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  hasS: { type: Type.BOOLEAN },
                  hasT: { type: Type.BOOLEAN },
                  hasA: { type: Type.BOOLEAN },
                  hasR: { type: Type.BOOLEAN },
                  completeness: { type: Type.NUMBER },
                  suggestion: { type: Type.STRING, nullable: true },
                },
                required: [
                  "section",
                  "hasS",
                  "hasT",
                  "hasA",
                  "hasR",
                  "completeness",
                ],
              },
            },
          },
          required: [
            "overall",
            "breakdown",
            "actionVerbs",
            "quantification",
            "starAnalysis",
          ],
        },
      },
    });

    const jsonText = response.text;
    return JSON.parse(jsonText) as DetailedScore;
  } catch (error) {
    console.error("상세 점수 분석 중 오류 발생:", error);
    throw new Error("상세 점수 분석에 실패했습니다.");
  }
}
