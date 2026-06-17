import { Type, ThinkingLevel } from "@google/genai";
import { getAI, MODELS } from '../../shared/api/geminiClient';
import type { TailoredInstructionWithRequirements } from '../../types';
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';
import { resolveJobProfile } from '../../core/research/industryDetect';
import { SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY } from '../../shared/prompt/promptBlocks';

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

export async function generatePractitionerReview(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
): Promise<PractitionerReview> {
  validateResumeInput(resumeText);

  const profile = resolveJobProfile(instruction.jobProfile, instruction.detectedIndustry);
  const personaTitle = profile.practitionerPersona;
  const w = profile.evaluationWeights;

  const systemInstruction = [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n');

  const prompt = `당신은 ${profile.jobFamily} 직무의 ${personaTitle}입니다.
${profile.practitionerPerspective}

[핵심 평가 영역]
${profile.keyFocusAreas.join(', ')}
${profile.hardSkillTaxonomy.length ? `\n[이 직무 핵심 실무 역량/지식]\n${profile.hardSkillTaxonomy.join(', ')}` : ''}

[평가 가중치]
- 핵심 실무역량: ${w.coreSkills}%
- 경력/프로젝트: ${w.experience}%
- 자격증/교육: ${w.certifications}%
- 소프트스킬: ${w.softSkills}%
- 포트폴리오/증빙: ${w.portfolio}%

[JD 구조화 결과]
- 페르소나: ${instruction.persona}
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}

[Few-shot 예시 — 직무 무관 원칙]
GOOD strength: "구체적 행동과 수치 기반 성과가 함께 드러남 (예: '○○ 개선으로 지표 X→Y'). 실무 기여를 명확히 보여줌"
BAD strength: "다양한 업무를 수행" ← 강점이 아님. 무엇을 어떻게 했고 어떤 결과였는지가 빠져 있음
GOOD concern: "핵심 역량 경험을 언급했지만 구체적 수행 방식/규모/맥락이 빠져 검증이 필요함"
BAD concern: "경력이 짧다" ← 이력서 내용 기반이 아님. 사실 관계만 기술해야 함

아래 이력서를 ${personaTitle}의 시선으로 리뷰하세요.

<user-resume>
${resumeText}
</user-resume>

<user-jd>
${jobDescription}
</user-jd>

## 리뷰 요구사항

1. **전체 인상 (overallImpression)**: ${personaTitle}로서 이 이력서를 처음 봤을 때의 솔직한 인상을 2-3문장으로 작성하세요. 실무자 특유의 관점이 드러나야 합니다.

2. **강점 (strengths)**: ${personaTitle}의 눈에 띄는 강점 3-5개를 구체적으로 서술하세요. 단순 기술 나열이 아니라 "왜 이것이 실무에서 가치 있는가"를 설명하세요.

3. **우려 사항 (concerns)**: ${personaTitle}가 우려하는 점 3-5개를 구체적으로 서술하세요. 이력서에서 부족하거나 검증이 필요한 부분입니다.

4. **면접 질문 (interviewQuestions)**: ${personaTitle}가 면접에서 반드시 물어볼 질문 2-3개를 작성하세요. 이력서 내용을 검증하거나 심화하기 위한 질문이어야 합니다.

5. **채용 추천 (hiringRecommendation)**: strong_yes(강력 추천), yes(추천), maybe(보류), no(비추천) 중 하나를 선택하세요.

6. **추천 근거 (recommendationReason)**: 추천/비추천의 핵심 근거를 1-2문장으로 작성하세요.

perspective 필드에는 "${personaTitle}"을 그대로 넣으세요.
industry 필드에는 "${profile.jobFamily}"을 그대로 넣으세요.

JSON 스키마에 맞춰 반환하세요.

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. strengths/concerns 각 항목이 이력서 원문의 구체적 내용을 근거로 하는가?
2. interviewQuestions가 이력서에 언급된 경험에 기반하는가?
3. hiringRecommendation이 strengths/concerns 분석과 논리적으로 일치하는가?
4. overallImpression이 해당 직무 실무자 관점에서 작성되었는가?`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.flash,
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
