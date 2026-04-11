import { Type, ThinkingLevel } from "@google/genai";
import { getAI } from './promptCache';
import type { TailoredInstructionWithRequirements, Industry } from '../types';
import { withRetry } from './retry';
import { validateResumeInput, safeParseJSON } from './validation';
import { classifyError } from './errors';
import { INDUSTRY_PROFILES } from './industryDetect';
import { SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY } from './promptBlocks';

export interface PractitionerReview {
  perspective: string;  // "CTO" | "리스크관리팀장" | etc.
  industry: string;
  overallImpression: string;  // 2-3 sentences
  strengths: string[];  // 3-5 items
  concerns: string[];   // 3-5 items
  interviewQuestions: string[];  // 2-3 questions this practitioner would ask
  hiringRecommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
  recommendationReason: string;
}

/** 업종별 실무자 페르소나 매핑 */
const PRACTITIONER_PERSONAS: Record<Industry, { title: string; description: string }> = {
  it: {
    title: 'CTO',
    description: '기술 조직을 이끄는 CTO로서, 기술적 깊이, 아키텍처 이해도, 문제 해결 접근법, 기술 선택의 근거를 중심으로 평가합니다.',
  },
  finance: {
    title: '리스크관리팀장',
    description: '금융기관 리스크관리팀장으로서, 금융 도메인 지식, 규제/컴플라이언스 이해도, 디지털 전환 역량, 리스크 감수성을 중심으로 평가합니다.',
  },
  manufacturing: {
    title: '생산기술파트장',
    description: '제조 대기업 생산기술파트장으로서, 전공 깊이, 공정 이해도, 품질 관리 역량, 문제 해결 사례를 중심으로 평가합니다.',
  },
  public: {
    title: 'NCS 면접관',
    description: '공공기관 NCS 면접관으로서, 직업기초능력 10개 항목(의사소통, 문제해결, 자원관리 등), 경험기술서 STAR 구조 완성도를 중심으로 평가합니다.',
  },
  general: {
    title: '팀장급 실무자',
    description: '실무 팀장으로서, "이 사람이 우리 팀에 합류하면 바로 기여할 수 있는가?"를 기준으로 평가합니다.',
  },
};

export async function generatePractitionerReview(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
): Promise<PractitionerReview> {
  validateResumeInput(resumeText);

  const industry: Industry = instruction.detectedIndustry ?? 'general';
  const profile = INDUSTRY_PROFILES[industry];
  const persona = PRACTITIONER_PERSONAS[industry];

  const systemInstruction = [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n');

  const prompt = `당신은 ${profile.label} 업계의 ${persona.title}입니다.
${persona.description}

[업종 실무자 관점]
${profile.practitionerPerspective}

[핵심 평가 영역]
${profile.keyFocusAreas.join(', ')}

[평가 가중치]
- 기술 역량: ${profile.evaluationWeights.technicalSkills}%
- 경력/프로젝트: ${profile.evaluationWeights.experience}%
- 자격증/교육: ${profile.evaluationWeights.certifications}%
- 소프트스킬: ${profile.evaluationWeights.softSkills}%
- 포트폴리오: ${profile.evaluationWeights.portfolio}%

[JD 구조화 결과]
- 페르소나: ${instruction.persona}
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}

[Few-shot 예시 — IT/CTO 관점]
GOOD strength: "Redis 캐싱 도입으로 API 응답시간 3.2초→0.4초 단축. 이런 수치 기반 성과는 실무 역량을 명확히 보여줌"
BAD strength: "다양한 기술을 활용" ← 이건 강점이 아님. 무엇을 어떻게 활용했는지가 빠져 있음
GOOD concern: "MSA 전환 경험을 언급했지만 서비스 간 통신 방식(gRPC? REST? 이벤트 기반?)을 명시하지 않음. 아키텍처 이해 수준이 불분명"
BAD concern: "경력이 짧다" ← 이건 이력서 내용 기반이 아님. 사실 관계만 기술해야 함

아래 이력서를 ${persona.title}의 시선으로 리뷰하세요.

<user-resume>
${resumeText}
</user-resume>

<user-jd>
${jobDescription}
</user-jd>

## 리뷰 요구사항

1. **전체 인상 (overallImpression)**: ${persona.title}로서 이 이력서를 처음 봤을 때의 솔직한 인상을 2-3문장으로 작성하세요. 실무자 특유의 관점이 드러나야 합니다.

2. **강점 (strengths)**: ${persona.title}의 눈에 띄는 강점 3-5개를 구체적으로 서술하세요. 단순 기술 나열이 아니라 "왜 이것이 실무에서 가치 있는가"를 설명하세요.

3. **우려 사항 (concerns)**: ${persona.title}가 우려하는 점 3-5개를 구체적으로 서술하세요. 이력서에서 부족하거나 검증이 필요한 부분입니다.

4. **면접 질문 (interviewQuestions)**: ${persona.title}가 면접에서 반드시 물어볼 질문 2-3개를 작성하세요. 이력서 내용을 검증하거나 심화하기 위한 질문이어야 합니다.

5. **채용 추천 (hiringRecommendation)**: strong_yes(강력 추천), yes(추천), maybe(보류), no(비추천) 중 하나를 선택하세요.

6. **추천 근거 (recommendationReason)**: 추천/비추천의 핵심 근거를 1-2문장으로 작성하세요.

perspective 필드에는 "${persona.title}"을 그대로 넣으세요.
industry 필드에는 "${profile.label}"을 그대로 넣으세요.

JSON 스키마에 맞춰 반환하세요.

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. strengths/concerns 각 항목이 이력서 원문의 구체적 내용을 근거로 하는가?
2. interviewQuestions가 이력서에 언급된 경험에 기반하는가?
3. hiringRecommendation이 strengths/concerns 분석과 논리적으로 일치하는가?
4. overallImpression이 업종 실무자 관점에서 작성되었는가?`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            perspective: { type: Type.STRING },
            industry: { type: Type.STRING },
            overallImpression: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            concerns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            interviewQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            hiringRecommendation: {
              type: Type.STRING,
              enum: ['strong_yes', 'yes', 'maybe', 'no'],
            },
            recommendationReason: { type: Type.STRING },
          },
          required: [
            "perspective",
            "industry",
            "overallImpression",
            "strengths",
            "concerns",
            "interviewQuestions",
            "hiringRecommendation",
            "recommendationReason",
          ],
        },
      },
    }));

    const jsonText = response.text;
    return safeParseJSON<PractitionerReview>(jsonText, '실무자 시뮬레이션');
  } catch (error) {
    console.error("실무자 시뮬레이션 분석 중 오류 발생:", error);
    throw classifyError(error);
  }
}
