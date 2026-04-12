import { Type, ThinkingLevel } from "@google/genai";
import {
  CoverLetterConfig,
  CoverLetterResult,
  TailoredInstructionWithRequirements,
  CoachingResult,
  CompanyContext,
} from "../../types";
import { formatCompanyContext } from '../../core/research/companyResearch';
import { getAI, MODELS } from "../../shared/api/geminiClient";
import {
  GROUNDING_FULL,
  AI_DETECTION_KO_FULL,
  AI_DETECTION_EN,
  formatInstruction,
  buildSystemPrompt,
} from "../../shared/prompt/promptBlocks";
import { withRetry } from '../../shared/api/retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from '../../shared/lib/validation';
import { classifyError } from '../../shared/lib/errors';

// ─────────────────────────────────────────────────────────────
// Cover Letter Generation
// ─────────────────────────────────────────────────────────────

const TONE_LABELS: Record<string, { ko: string; en: string }> = {
  formal: { ko: "격식 있고 신중한 어조", en: "Professional and formal tone" },
  confident: { ko: "자신감 있고 직설적인 어조", en: "Confident and direct tone" },
  passionate: { ko: "열정적이고 적극적인 어조", en: "Passionate and enthusiastic tone" },
};

const LENGTH_GUIDE: Record<string, { chars: string; words: string }> = {
  short: { chars: "500-700자", words: "200-300 words" },
  medium: { chars: "900-1200자", words: "350-500 words" },
  long: { chars: "1400-1800자", words: "550-700 words" },
};

export async function generateCoverLetter(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  config: CoverLetterConfig,
  coachingResult?: CoachingResult,
  companyContext?: CompanyContext | null,
): Promise<CoverLetterResult> {
  const today = new Date().toISOString().split('T')[0];
  const isKorean = config.language === 'ko';
  const toneDesc = TONE_LABELS[config.tone][config.language];
  const lengthGuide = LENGTH_GUIDE[config.length][isKorean ? 'chars' : 'words'];

  const coachingContext = coachingResult
    ? `\n[분석 요약]\n- 매칭 점수: ${coachingResult.matchScore}/100\n- 요약: ${coachingResult.summary}\n- 주요 강점:\n${coachingResult.gapMap.filter(g => g.currentLevel === 'strong').slice(0, 3).map(g => `  - ${g.requirement}`).join('\n')}\n- 개선이 필요한 영역:\n${coachingResult.gapMap.filter(g => g.currentLevel === 'weak' || g.currentLevel === 'missing').slice(0, 3).map(g => `  - ${g.requirement}: ${g.suggestion}`).join('\n')}`
    : '';

  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';

  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const styleGuide = isKorean
    ? `[한국어 지원동기서 스타일]
구조:
1. 도입부 (10%): 지원 동기와 회사에 대한 관심 표현
2. 본론 1 (30%): 본인의 핵심 역량과 경험 (JD 요구사항과 연결)
3. 본론 2 (30%): 구체적 프로젝트/성과 사례 (정량적 성과 포함)
4. 결론 (30%): 입사 후 기여 방향 및 성장 계획

어조 규칙:
- 모든 문장은 격식체 "~합니다", "~했습니다", "~입니다"로 종결
- 금지: "~해요", "~했어요", "~예요", "~함.", "~임."
- ${toneDesc}

필수 포함 요소:
- JD 필수 키워드 5-7개 자연스럽게 포함
- 정량적 성과 2-3개 (예: "처리 시간 50% 단축", "사용자 만족도 4.2→4.7 향상")
- 지원 직무에 대한 구체적 이해 표현`
    : `[English Cover Letter Style (US Format)]
Structure:
1. Opening (10%): Express interest in the position and company
2. Body Paragraph 1 (30%): Highlight relevant skills and experiences aligned with JD requirements
3. Body Paragraph 2 (30%): Provide concrete project examples with quantified achievements
4. Closing (30%): Emphasize future contributions and growth potential

Tone Guidelines:
- ${toneDesc}
- Use active voice and strong action verbs
- Professional yet personable language
- Avoid clichés ("team player", "think outside the box")

Required Elements:
- Naturally incorporate 5-7 JD keywords
- Include 2-3 quantified achievements (e.g., "Reduced API response time by 50%", "Increased user engagement by 35%")
- Demonstrate specific understanding of the role`;

  const prompt = isKorean
    ? `[역할]
당신은 한국 IT 기업 채용 전문가입니다.
지원동기서 작성에 특화되어 있으며, JD 요구사항과 지원자 경험의 연결점을 자연스럽게 풀어내는 전문가입니다.
${companyBlock}

[현재 날짜]
${today}

[핵심 원칙]
원칙 1: 이력서와 코칭 결과에 명시된 내용만 활용하십시오.
원칙 2: 정량적 성과를 반드시 포함하십시오.
원칙 3: JD 키워드를 자연스럽게 녹여내되, 키워드 스터핑을 피하십시오.
원칙 4: 구체적이고 진정성 있는 표현을 사용하십시오.

${AI_DETECTION_KO_FULL}

${styleGuide}

글자 수: ${lengthGuide} (엄격히 준수)

${formatInstruction(instruction)}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고]
<user-jd>
${jobDescription}
</user-jd>
${coachingContext}

[자기 검증]
작성 완료 후 검증하십시오:
1. 이력서에 없는 경험/수치가 포함되었는가? → 삭제 또는 [기입] 처리
2. "활용하여/기반으로/통해/바탕으로"가 각 1회 이하인가?
3. 문장 길이가 균일하지 않은가? (짧은/긴 문장 혼재 필요)
4. 뻔한 서론으로 시작하지 않았는가?

[작성 태스크]
위 구조에 따라 완성도 높은 지원동기서를 작성하십시오.
반드시 Markdown 형식으로 작성하되, 섹션 구분은 자연스럽게 문단으로 연결하십시오.`
    : `[Role]
You are an expert in crafting compelling cover letters for IT positions.
You specialize in connecting candidate experiences with job requirements in a natural, persuasive manner.
${companyBlock}

[Current Date]
${today}

[Core Principles]
Principle 1: Only use information explicitly stated in the resume and coaching results.
Principle 2: Include quantified achievements (numbers, percentages, timeframes).
Principle 3: Naturally incorporate JD keywords without keyword stuffing.
Principle 4: Use specific, authentic expressions.

${AI_DETECTION_EN}

${styleGuide}

Length: ${lengthGuide} (strictly adhere)

[JD Analysis]
- Persona: ${instruction.persona}
- Key Keywords: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}

[Resume]
<user-resume>
${resumeText}
</user-resume>

[Job Description]
<user-jd>
${jobDescription}
</user-jd>
${coachingContext}

[Task]
Write a compelling cover letter following the structure above.
Format in Markdown with natural paragraph flow.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: MODELS.pro,
      contents: prompt,
      config: {
        systemInstruction: buildSystemPrompt({ grounding: GROUNDING_FULL }),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: {
              type: Type.STRING,
              description: isKorean
                ? "Markdown 형식의 완성된 지원동기서 전문"
                : "Complete cover letter in Markdown format"
            },
            charCount: {
              type: Type.NUMBER,
              description: isKorean
                ? "content의 실제 글자 수 (공백 포함)"
                : "Actual character count of content (including spaces)"
            },
            keywordsUsed: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: isKorean
                ? "본문에 포함된 JD 키워드 목록"
                : "List of JD keywords incorporated in the letter",
            },
          },
          required: ["content", "charCount", "keywordsUsed"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("커버레터 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON<{ content: string; charCount?: number; keywordsUsed?: string[] }>(jsonText, '커버레터 생성');
    return {
      content: parsed.content || '',
      language: config.language,
      charCount: parsed.charCount || 0,
      keywordsUsed: parsed.keywordsUsed || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("Cover letter generation failed:", error);
    throw classifyError(error);
  }
}
