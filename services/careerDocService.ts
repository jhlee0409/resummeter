import { Type } from "@google/genai";
import {
  CareerStatementResult,
  CoverLetterConfig,
  CoverLetterResult,
  TailoredInstructionWithRequirements,
  GitHubFetchResult,
  CoachingResult,
  AboutStatementResult,
} from "../types";
import { formatRepoInfo } from "./geminiService";
import { getAI } from "./promptCache";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  AI_DETECTION_KO_BRIEF,
  AI_DETECTION_KO_FULL,
  AI_DETECTION_EN,
  QUANTIFICATION_CAREER,
  formatInstruction,
} from "./promptBlocks";
import { withRetry } from './retry';
import { validateResumeInput, validateJDInput, safeParseJSON } from './validation';
import { classifyError } from './errors';

// ─────────────────────────────────────────────────────────────
// Career Statements (STAR-based NCS format)
// ─────────────────────────────────────────────────────────────

export async function generateCareerStatements(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubData?: GitHubFetchResult[]
): Promise<CareerStatementResult> {
  const today = new Date().toISOString().split('T')[0];
  const repoInfo = githubData ? formatRepoInfo(
    githubData.filter(d => d.status === 'success').map(d => ({ url: d.repoUrl, description: '' })),
    githubData
  ) : '';

  validateResumeInput(resumeText);
  validateJDInput(jobDescription);

  const prompt = `[역할]
당신은 한국 공공기관 및 대기업 채용 프로세스 전문가입니다.
STAR 구조 기반 경력기술서 작성에 특화되어 있으며, NCS 블라인드 채용 형식에 정통합니다.

[현재 날짜]
${today}

[핵심 원칙]
원칙 1: STAR 구조를 엄격히 준수하십시오 (Situation, Task, Action, Result).
원칙 2: 정량적 성과 지표를 반드시 포함하십시오 (숫자, 비율, 기간 등).
원칙 3: JD 키워드를 자연스럽게 녹여내되, 키워드 스터핑을 피하십시오.
원칙 4: NCS 블라인드 채용 형식에 부합하도록 학력, 출신 학교, 나이, 성별 등 인적 사항을 배제하십시오.
원칙 5: 이력서와 GitHub 데이터에 명시된 내용만 활용하십시오.

${formatInstruction(instruction)}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고]
<user-jd>
${jobDescription}
</user-jd>

${repoInfo ? `[GitHub 리포지토리 (참고용)]\n${repoInfo}` : ''}

${AI_DETECTION_KO_BRIEF}

[작성 태스크]
1. 이력서에서 3-5개의 핵심 경력/프로젝트를 선정하십시오.
2. 각 경력을 STAR 구조로 분해하십시오:
   - S (Situation): 상황/배경 (언제, 어떤 프로젝트/조직에서)
   - T (Task): 본인이 맡은 과제/목표
   - A (Action): 수행한 구체적 행동과 기술적 역량
   - R (Result): 정량적 성과 (숫자, 비율, 개선 수치 등)
3. 각 항목에 제목을 붙이십시오 (예: "MSA 전환으로 시스템 안정성 40% 향상").
4. JD 키워드를 각 항목과 매핑하십시오.
5. 정량화된 성과를 별도로 추출하십시오.

[NCS 블라인드 채용 체크리스트]
- 학력, 출신 학교명 제외
- 나이, 성별 제외
- 사진, 가족관계 제외
- 오직 직무 역량과 성과만 포함

[NCS 직업기초능력 매핑]
각 경력기술서 항목이 아래 NCS 직업기초능력 중 어떤 것을 증명하는지 명시하십시오:
의사소통능력, 수리능력, 문제해결능력, 자기개발능력, 자원관리능력,
대인관계능력, 정보능력, 기술능력, 조직이해능력, 직업윤리
각 항목의 relatedJdKeywords에 해당 NCS 능력을 태그로 포함하십시오.

[STAR 작성 가이드]
- S: 2-3문장으로 배경 설명
- T: 1-2문장으로 목표 명시
- A: 3-5문장으로 구체적 행동과 사용 기술 서술
- R: 1-2문장으로 정량적 성과 제시 (반드시 숫자 포함)

${QUANTIFICATION_CAREER}

[글자 수 가이드]
각 경력기술서 항목: 400-600자 (공백 포함)`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n'),
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "고유 ID (statement-1, statement-2, ...)" },
                  title: { type: Type.STRING, description: "경력 항목 제목 (핵심 성과를 드러내는 제목)" },
                  content: {
                    type: Type.STRING,
                    description: "STAR 구조로 작성된 전체 내용. S-T-A-R 순서로 자연스럽게 연결된 하나의 완성된 글. 400-600자."
                  },
                  starBreakdown: {
                    type: Type.OBJECT,
                    properties: {
                      situation: { type: Type.STRING, description: "S: 상황/배경 (2-3문장)" },
                      task: { type: Type.STRING, description: "T: 과제/목표 (1-2문장)" },
                      action: { type: Type.STRING, description: "A: 구체적 행동과 기술적 역량 (3-5문장)" },
                      result: { type: Type.STRING, description: "R: 정량적 성과 (1-2문장, 반드시 숫자 포함)" },
                    },
                    required: ["situation", "task", "action", "result"],
                  },
                  quantifiedResults: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "정량화된 성과 목록 (예: '처리 시간 8초→4초 단축', 'MAU 20% 증가')",
                  },
                  relatedJdKeywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "이 항목에서 다룬 JD 키워드 목록",
                  },
                },
                required: ["id", "title", "content", "starBreakdown", "quantifiedResults", "relatedJdKeywords"],
              },
            },
            ncsCompatible: {
              type: Type.BOOLEAN,
              description: "NCS 블라인드 채용 형식 준수 여부 (학력/나이/성별 배제됨)"
            },
          },
          required: ["statements", "ncsCompatible"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("경력기술서 생성 결과가 비어있습니다.");

    const parsed = safeParseJSON(jsonText, '경력기술서 생성');
    return {
      statements: parsed.statements || [],
      ncsCompatible: parsed.ncsCompatible ?? true,
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("Career statement generation failed:", error);
    throw classifyError(error);
  }
}

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
  coachingResult?: CoachingResult
): Promise<CoverLetterResult> {
  const today = new Date().toISOString().split('T')[0];
  const isKorean = config.language === 'ko';
  const toneDesc = TONE_LABELS[config.tone][config.language];
  const lengthGuide = LENGTH_GUIDE[config.length][isKorean ? 'chars' : 'words'];

  const coachingContext = coachingResult
    ? `\n[분석 요약]\n- 매칭 점수: ${coachingResult.matchScore}/100\n- 요약: ${coachingResult.summary}\n- 주요 강점:\n${coachingResult.gapMap.filter(g => g.currentLevel === 'strong').slice(0, 3).map(g => `  - ${g.requirement}`).join('\n')}\n- 개선이 필요한 영역:\n${coachingResult.gapMap.filter(g => g.currentLevel === 'weak' || g.currentLevel === 'missing').slice(0, 3).map(g => `  - ${g.requirement}: ${g.suggestion}`).join('\n')}`
    : '';

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
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n'),
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

    const parsed = safeParseJSON(jsonText, '커버레터 생성');
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

// ─────────────────────────────────────────────────────────────
// About Statement Refinement (한 줄 자기소개 고도화)
// ─────────────────────────────────────────────────────────────

const TONE_DEFINITIONS = {
  professional: {
    id: 'professional',
    label: '격식있는',
    description: '공식적이고 신뢰감 있는 톤. 대기업, 공공기관 지원에 적합.',
    guide: '격식체 어미 사용 (~합니다, ~입니다). 전문 용어를 적절히 활용. 객관적 성과 중심.',
  },
  friendly: {
    id: 'friendly',
    label: '친근한',
    description: '따뜻하고 접근하기 쉬운 톤. 스타트업, 팀 문화 중시 기업에 적합.',
    guide: '부드러운 표현 사용. 협업과 소통 강조. 인간적인 면모 드러내기.',
  },
  impactful: {
    id: 'impactful',
    label: '임팩트있는',
    description: '강렬하고 기억에 남는 톤. 리더십 포지션, 차별화 필요 시 적합.',
    guide: '핵심 성과를 앞세움. 숫자와 수치 강조. 짧고 강한 문장.',
  },
};

export async function refineAboutStatement(
  originalStatement: string,
  resumeText: string,
  _jobDescription: string,
  _instruction: TailoredInstructionWithRequirements,
  coachingResult?: CoachingResult
): Promise<AboutStatementResult> {
  validateResumeInput(resumeText);

  const today = new Date().toISOString().split('T')[0];

  const strengthsContext = coachingResult
    ? coachingResult.gapMap
        .filter(g => g.currentLevel === 'strong')
        .slice(0, 5)
        .map(g => g.requirement)
        .join(', ')
    : '';

  const prompt = `[역할]
당신은 개인 브랜딩 전문가입니다.
이력서를 분석하여 그 사람을 가장 잘 표현하는 한 줄 자기소개를 다듬는 전문가입니다.
특정 채용 공고에 맞추지 않고, 범용적으로 본인의 핵심 역량과 차별점을 드러내는 것이 목표입니다.

[현재 날짜]
${today}

[핵심 원칙]
원칙 1 (의도 보존): 원본 문장의 핵심 메시지와 정체성을 반드시 유지하십시오.
원칙 2 (날조 금지): 이력서에 명시된 내용만 활용하십시오. 없는 경력이나 기술을 만들어내지 마십시오.
원칙 3 (범용성): 특정 회사나 직무에 맞추지 말고, 이 사람의 현재 역량을 가장 잘 표현하십시오.
원칙 4 (간결함): 한 줄 자기소개는 50-100자 내외로 유지하십시오.
원칙 5 (톤 차별화): 각 톤별로 명확하게 다른 느낌의 문장을 작성하십시오.

[입력 품질 가드]
원본 자기소개가 10자 미만이면: 고도화를 시도하지 말고, "자기소개 내용이 너무 짧습니다. 본인의 직무와 핵심 역량을 포함하여 작성해주세요."를 반환하십시오.

[원본 자기소개]
<user-input>
${originalStatement}
</user-input>
${strengthsContext ? `\n[지원자 주요 강점]\n${strengthsContext}` : ''}

[이력서 원문]
<user-resume>
${resumeText.slice(0, 2000)}
</user-resume>

[톤별 작성 가이드]
1. professional (격식있는): ${TONE_DEFINITIONS.professional.guide}
2. friendly (친근한): ${TONE_DEFINITIONS.friendly.guide}
3. impactful (임팩트있는): ${TONE_DEFINITIONS.impactful.guide}

[작성 태스크]
1. 원본 문장을 분석하여 핵심 의도와 개선 가능한 점을 파악하십시오.
2. 3가지 톤(professional, friendly, impactful)으로 각각 고도화된 버전을 작성하십시오.
3. 각 버전에서:
   - 원본의 핵심 의도를 보존하면서 더 명확하고 매력적으로 다듬으십시오.
   - 이력서에서 확인된 구체적 강점이나 수치를 자연스럽게 녹여내십시오.
   - 이력서의 핵심 기술과 도메인 키워드를 자연스럽게 녹여내십시오.
   - 50-100자 내외로 간결하게 유지하십시오.
4. 가장 추천하는 버전을 선정하고 그 이유를 설명하십시오.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n'),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalAnalysis: {
              type: Type.STRING,
              description: "원본 문장 분석: 핵심 의도, 강점, 개선 가능한 점",
            },
            versions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "버전 ID (professional, friendly, impactful)" },
                  tone: { type: Type.STRING, description: "톤 타입" },
                  toneLabel: { type: Type.STRING, description: "톤 라벨 (격식있는, 친근한, 임팩트있는)" },
                  content: { type: Type.STRING, description: "고도화된 한 줄 자기소개 (50-100자)" },
                  charCount: { type: Type.NUMBER, description: "글자 수" },
                  improvements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "원본 대비 개선된 포인트 목록 (2-4개)",
                  },
                  keywordsUsed: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "반영된 JD 키워드 목록",
                  },
                  strengthsHighlighted: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "강조된 이력서 강점 목록",
                  },
                },
                required: ["id", "tone", "toneLabel", "content", "charCount", "improvements", "keywordsUsed", "strengthsHighlighted"],
              },
            },
            bestVersion: {
              type: Type.STRING,
              description: "가장 추천하는 버전 ID와 선정 이유 (예: 'professional - 해당 포지션의 성격상...')",
            },
          },
          required: ["originalAnalysis", "versions", "bestVersion"],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("한 줄 자기소개 고도화 결과가 비어있습니다.");

    const parsed = safeParseJSON(jsonText, '한줄소개 고도화');
    return {
      originalInput: originalStatement,
      originalAnalysis: parsed.originalAnalysis || '',
      versions: parsed.versions || [],
      bestVersion: parsed.bestVersion || '',
      generatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("About statement refinement failed:", error);
    throw classifyError(error);
  }
}
