import { Type, ThinkingLevel } from "@google/genai";
import type { AtsScore, DetailedScore, CompanyContext } from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  SECURITY_RULE,
  GROUNDING_BASIC,
  RESUME_HIERARCHY,
  HR_PERSPECTIVE_ATS,
  QUANTIFICATION_ATS,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

/**
 * ATS 점수 분석: 키워드 매칭, 포맷 호환성, 약어/풀네임 병기 제안, 키워드 스터핑 감지
 */
export async function analyzeAtsScore(
  resumeText: string,
  jobDescription: string,
  instruction: string,
  companyContext?: CompanyContext | null,
): Promise<AtsScore> {
  validateResumeInput(resumeText);
  validateJDInput(jobDescription);
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  try {
    const prompt = `당신은 ATS(Applicant Tracking System) 전문가입니다.
${companyBlock}

다음 이력서를 채용 공고(JD)와 비교하여 ATS 관점에서 분석하세요.

# 채용 공고
<user-jd>
${jobDescription}
</user-jd>

# 맞춤형 지시사항
${instruction}

# 이력서
<user-resume>
${resumeText}
</user-resume>

## 분석 요구사항

1. **키워드 매칭**: JD에서 중요한 키워드를 추출하고, 이력서에서 각 키워드의 존재 여부와 빈도를 분석하세요.
   - foundInResume: 이력서에 존재하는지 (boolean)
   - frequency: 이력서에서 등장 횟수
   - context: 키워드가 사용된 맥락 (간단히)
   - suggestion: 누락된 경우 추가 제안, 과도하게 사용된 경우 경고

[키워드 최적화 기준]
- 적정 키워드 수: 15-25개 (이 범위를 벗어나면 경고)
- 매칭률 sweet spot: 75-80% (과도한 매칭은 키워드 스터핑으로 간주)
- 키워드는 자연스러운 문맥에서 사용되어야 함. 단순 나열은 감점
- 각 키워드가 성과/경험 설명 안에서 자연스럽게 등장하는지 평가하십시오

[Few-shot 예시]
GOOD 키워드 분석:
- 직무 핵심 키워드가 이력서에 구체적 맥락과 함께 등장 → foundInResume: true, frequency: 실제 횟수, context: "그 키워드가 성과/경험 안에서 쓰인 구체적 맥락", suggestion: null
- JD엔 있으나 이력서에 없는 키워드 → foundInResume: false, suggestion: "관련 경험이 있다면 ○○ 경험을 추가하세요" (실제 보유 경험이 있을 때만)
BAD 키워드 분석 (피하세요):
- keyword: "리더십", foundInResume: true, frequency: 1, context: "리더십 발휘" ← 너무 모호. 구체적 맥락 필요
- 이력서에 없는 역량을 무작정 "추가하세요"라고 제안 ← 보유하지 않은 경험을 지어내라는 건 잘못됨

[시맨틱 매칭 분석]
키워드의 정확한 텍스트 일치뿐 아니라 의미적 유사성도 평가하십시오:
- "프로젝트 관리" ≈ "PM" ≈ "프로젝트 리드" ≈ "프로젝트 매니지먼트"
- 약어 ≈ 풀네임, 상위개념 ≈ 하위개념 등 해당 직무 도메인의 동의어를 함께 인정
- 시맨틱 매칭 결과는 각 키워드의 context 필드에 "(시맨틱 매칭)" 표시
- 2026년 ATS는 NLP 기반 시맨틱 매칭을 사용하므로 정확한 텍스트 일치와 의미적 유사성을 모두 평가

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

JSON 스키마에 맞춰 반환하세요.

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. overall 점수가 keywordMatch와 formatCompliance의 가중 평균과 일치하는가?
2. keywords 배열의 각 항목이 JD 원문에 실제 등장하는가?
3. isStuffing이 true인 경우 keywordMatch가 80% 이상인가?
4. abbreviations의 각 항목에서 fullForm이 정확한가?`;

    const systemInstruction = [SECURITY_RULE, GROUNDING_BASIC, RESUME_HIERARCHY].join('\n\n');

    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
    }));

    const jsonText = response.text;
    return safeParseJSON<AtsScore>(jsonText, 'ATS 점수 분석');
  } catch (error) {
    console.error("ATS 점수 분석 중 오류 발생:", error);
    throw classifyError(error);
  }
}

/**
 * 상세 점수 분석: 섹션별 점수, Action Verb 분석, 정량화 분석, STAR 구조 감지
 */
export async function analyzeDetailedScore(
  resumeText: string,
  jobDescription: string,
  instruction: string,
  companyContext?: CompanyContext | null,
): Promise<DetailedScore> {
  validateResumeInput(resumeText);
  validateJDInput(jobDescription);
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  try {
    const prompt = `당신은 이력서 코칭 전문가입니다.
${companyBlock}

다음 이력서를 상세히 분석하여 섹션별 점수, Action Verb 분석, 정량화 분석, STAR 구조 분석을 수행하세요.

# 채용 공고
<user-jd>
${jobDescription}
</user-jd>

# 맞춤형 지시사항
${instruction}

# 이력서
<user-resume>
${resumeText}
</user-resume>

${HR_PERSPECTIVE_ATS}

## 분석 요구사항

1. **섹션별 점수 (breakdown)**:
   - coreSkills: 직무 핵심 역량 관련성 (0-100점) — 기술직이면 기술 스택, 그 외엔 직무 핵심 실무역량/전문지식
   - experience: 경력 관련성 (0-100점)
   - impact: 임팩트/성과 (0-100점)
   - readability: 가독성/구조 (0-100점)
   - weight: 각 섹션 가중치(0~1, 합 1.0)를 **직무 특성에 맞게** 배분하세요. 위 [맞춤형 지시사항]의 jobProfile.evaluationWeights를 참고하되, 일반적으로 핵심역량 0.35~0.45 / 경력 0.20~0.30 / 임팩트 0.15~0.25 / 가독성 0.10~0.15 범위에서 조정하세요.
   - 각 섹션의 details에는 구체적인 평가 내용을 배열로 담으세요.

2. **Action Verb 분석 (actionVerbs)**:
   - weak: 약한 동사 목록 (예: "담당했다", "했다", "수행했다" 등)
     - verb: 약한 동사
     - line: 해당 문장
     - suggestion: 강한 동사로의 전환 제안 (예: "구축했다", "최적화했다", "설계했다")
   - strong: 이미 사용된 강한 동사 목록

[Action Verb Few-shot 예시]
GOOD: verb: "담당했다", line: "고객사 영업을 담당했다", suggestion: "신규 고객사 12곳을 발굴해 연 매출 3억을 신규 창출했다"
GOOD: verb: "했다", line: "캠페인을 했다", suggestion: "타겟 캠페인을 설계·집행해 전환율을 3.5%까지 끌어올렸다"
BAD (피하세요): verb: "활용했다", suggestion: "사용했다" ← 단순 동의어 교체는 의미 없음. 구체적 성과 동사로 바꿔야 함

3. **정량화 분석 (quantification)**:
   - quantified: 이미 정량적 성과가 잘 표현된 문장 목록
   - needsQuantification: 수치화가 필요한 문장
     - line: 해당 문장
     - suggestion: 수치화 제안 (예: "사용자 수, 성능 개선 %, 처리 시간 단축 등")

${QUANTIFICATION_ATS}

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

JSON 스키마에 맞춰 반환하세요.

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. overall 점수가 breakdown 4개 항목의 score×weight 가중합과 일치하는가? (weight 합 = 1.0)
2. actionVerbs.weak의 각 동사가 실제 이력서에 등장하는가?
3. quantification.needsQuantification의 각 항목이 실제 이력서에 수치 없이 등장하는가?
4. starAnalysis의 completeness 점수가 hasS/hasT/hasA/hasR와 논리적으로 일치하는가?`;

    const systemInstruction = [SECURITY_RULE, GROUNDING_BASIC, RESUME_HIERARCHY].join('\n\n');

    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.pro,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall: { type: Type.NUMBER },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                coreSkills: {
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
              required: ["coreSkills", "experience", "impact", "readability"],
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
    }));

    const jsonText = response.text;
    return safeParseJSON<DetailedScore>(jsonText, '상세 점수 분석');
  } catch (error) {
    console.error("상세 점수 분석 중 오류 발생:", error);
    throw classifyError(error);
  }
}
