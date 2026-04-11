/**
 * 역량 갭 분석 서비스.
 * 회사가 원하는 것 vs 이력서에 있는 것을 정밀 매핑.
 */

import { Type, ThinkingLevel } from '@google/genai';
import { getAI } from './promptCache';
import { withRetry } from './retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from './validation';
import { classifyError } from './errors';
import { SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY, AI_DETECTION_KO_BASE, HR_PERSPECTIVE_ANALYSIS } from './promptBlocks';
import { formatCompanyContext } from './companyResearchService';
import type { CompanyContext, GapAnalysisResult, GapMatch, TailoredInstructionWithRequirements } from '../types';

export async function analyzeGap(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  companyContext?: CompanyContext | null,
): Promise<GapAnalysisResult> {
  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  const prompt = `당신은 채용 전문 컨설턴트입니다. 이력서와 채용 공고를 비교하여 역량 갭을 정밀 분석하세요.

# 채용 공고
<user-jd>
${jobDescription}
</user-jd>

# JD 구조화 결과
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}

${companyBlock}

# 이력서
<user-resume>
${resumeText}
</user-resume>

## 분석 요구사항

JD와 회사 컨텍스트에서 요구하는 **모든 역량/경험/자격**을 추출하고, 각각에 대해 이력서에서 증거를 찾으세요.

각 항목에 대해:
1. **requirement**: 회사가 원하는 역량/경험 (JD 원문 기반)
2. **severity**: JD에서의 중요도
   - "required": "필수", "자격요건", "~해야 합니다" 등으로 명시된 항목
   - "preferred": "우대", "~하면 좋습니다", "~경험자 환영" 등으로 명시된 항목
   - "bonus": 부가적으로 언급된 항목
3. **evidence**: 이력서에서 이 역량을 증명하는 구체적 문장이나 경험. 없으면 null.
4. **matched**: 이력서에 증거가 있으면 true, 없으면 false
5. **reframeSuggestion**: matched가 true일 때, 이력서의 해당 문장을 이 회사/직무 맥락에 맞게 어떻게 수정하면 좋을지 구체적 수정안을 제시. 반드시 이력서 원문을 인용한 뒤 수정 방향을 제시하십시오. 추상적 방향("~를 강조하세요")이 아닌 구체적 문장 수정안("A를 B로 바꾸세요")을 쓰십시오. matched가 false면 생략.

[Few-shot 예시]
GOOD match:
  requirement: "고객 현장에서 문제를 발견하고 해결한 경험"
  severity: "required"
  evidence: "아임셀러에서 고객과 직접 소통하며 유저 플로우 문제점을 진단하고 최적의 대안을 제안 및 구현"
  matched: true
  reframeSuggestion: "원문 '유저 플로우의 문제점을 진단'을 '고객 현장에서 [예: 결제 이탈, 온보딩 중단 등] 문제를 직접 발견하고 데이터 기반으로 진단'으로 수정. 채널톡 FDE의 '현장 문제 발견→진단→해결' 역할과 직결됨."

BAD reframeSuggestion (피하세요):
  "고객 중심 사고를 강조하세요" ← 너무 추상적. 이력서 어떤 문장을 어떻게 바꾸라는 건지 모름

GOOD gap:
  requirement: "대규모/복잡한 고객사와 직접 커뮤니케이션 경험"
  severity: "required"
  evidence: null
  matched: false

BAD (피하세요):
  evidence: "다양한 프로젝트 경험" ← 너무 모호. 이력서의 구체적 문장을 인용해야 함

## 종합 평가 (overallAssessment)
- 3문장으로 솔직하게 평가: 1문장 강점 + 1문장 약점/위험 요소 + 1문장 구체적 보완 방향
- 긍정만 쓰지 마십시오. 채용담당자는 약점을 알고 싶어 합니다.
- "~하면 좋겠습니다" 같은 모호한 제안 대신 "이력서의 X 문장을 Y로 수정하세요" 같은 실행 가능한 제안

## missingEvidence
- 이력서에 없지만 추가하면 좋을 경험/성과 (최대 5개)
- 구체적이어야 함: "리더십 경험 추가" ✗ → "팀 3명 이상 리딩한 프로젝트 경험, 의사결정 과정 기술" ✓

[자기검증 체크리스트]
응답 전 반드시 확인하십시오:
1. evidence 필드가 이력서 원문의 실제 내용을 반영하는가?
2. severity가 JD 원문의 표현과 일치하는가?
3. matched=true인 항목에 reframeSuggestion이 있는가?
4. overallAssessment가 matches 분석과 논리적으로 일치하는가?`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY, AI_DETECTION_KO_BASE, HR_PERSPECTIVE_ANALYSIS].join('\n\n'),
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  requirement: { type: Type.STRING },
                  severity: { type: Type.STRING, description: 'required | preferred | bonus' },
                  evidence: { type: Type.STRING, nullable: true },
                  matched: { type: Type.BOOLEAN },
                  reframeSuggestion: { type: Type.STRING },
                },
                required: ['requirement', 'severity', 'matched'],
              },
            },
            overallAssessment: { type: Type.STRING },
            missingEvidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['matches', 'overallAssessment', 'missingEvidence'],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error('역량 갭 분석 결과가 비어있습니다.');

    const parsed = safeParseJSON<{
      matches: GapMatch[];
      overallAssessment: string;
      missingEvidence: string[];
    }>(jsonText, '역량 갭 분석');

    const matches = parsed.matches || [];
    // evidence 검증: LLM이 인용한 증거가 실제 이력서에 있는지 확인
    const resumeLower = resumeText.toLowerCase();
    for (const m of matches) {
      if (m.matched && m.evidence) {
        const evidenceWords = m.evidence.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const foundRatio = evidenceWords.filter(w => resumeLower.includes(w)).length / Math.max(evidenceWords.length, 1);
        if (foundRatio < 0.5) {
          m.evidence = `[확인 필요] ${m.evidence}`;
        }
      }
    }

    const totalCount = matches.length;
    const matchedCount = matches.filter(m => m.matched).length;
    const requiredItems = matches.filter(m => m.severity === 'required');
    const requiredMatched = requiredItems.filter(m => m.matched).length;

    return {
      matches,
      matchRate: totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0,
      requiredMatchRate: requiredItems.length > 0 ? Math.round((requiredMatched / requiredItems.length) * 100) : 0,
      missingEvidence: parsed.missingEvidence || [],
      overallAssessment: parsed.overallAssessment || '',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Gap analysis failed:', error);
    throw classifyError(error);
  }
}
