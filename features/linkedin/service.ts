import { Type, ThinkingLevel } from "@google/genai";
import type {
  TailoredInstructionWithRequirements,
  LinkedInOptimization,
  CompanyContext,
} from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  GROUNDING_RESUME_ONLY,
  AI_DETECTION_LINKEDIN,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

/**
 * LinkedIn 프로필 최적화 생성
 */
export async function generateLinkedInOptimization(
  resumeText: string,
  _jobDescription: string,
  _instruction: TailoredInstructionWithRequirements,
  companyContext?: CompanyContext | null,
): Promise<LinkedInOptimization> {
  validateResumeInput(resumeText);
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const prompt = `
당신은 LinkedIn 프로필 최적화 전문가입니다.
${companyBlock}

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
      model: MODELS.pro,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_RESUME_ONLY }),
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
