import { GoogleGenAI, Type } from "@google/genai";
import { CoachingResult, GithubRepo, TailoredInstructionWithRequirements, GitHubFetchResult, JdRequirement, Evidence, EvidenceBank, GapMapItem, ActionItem, NarrativeFramework, NarrativeSectionSpec, NarrativeSectionResult, NarrativeGenerationResult, KStarKBreakdown, TechNarrativeBreakdown } from "../types";

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

const DEFAULT_INSTRUCTION: TailoredInstructionWithRequirements = {
  persona: "한국 IT 기업의 전문 채용 담당자",
  keywords: [],
  evaluationCriteria: {
    hardSkills: [],
    softSkills: [],
    preferredExperience: [],
  },
  toneGuide: {
    style: "겸손하지만 자신감 있는 어조",
    endings: "명사형 종결어미",
    avoidPatterns: ["과도한 자기 PR", "근거 없는 수치"],
  },
  jdRequirements: [],
};

// ─────────────────────────────────────────────────────────────
// Stage 2a Internal Types
// ─────────────────────────────────────────────────────────────

interface IntermediateGapItem {
  requirement: string;
  category: 'hard-skill' | 'soft-skill' | 'experience' | 'education';
  currentLevel: 'strong' | 'weak' | 'missing';
  jdMentions: number;
  resumeMentions: number;
  suggestion: string;
}

interface AnalysisItem {
  id: string;
  targetSection: string;
  before: string;
  issue: string;
  direction: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'keyword-gap' | 'quantify' | 'reframe' | 'add-missing' | 'remove';
  relevantJdKeywords: string[];
}

interface AnalysisIntermediate {
  matchScore: number;
  summary: string;
  gapMap: IntermediateGapItem[];
  analysisItems: AnalysisItem[];
  quickWins: string[];
}

// ─────────────────────────────────────────────────────────────
// Stage 1: JD 분석 (Flash) — Schema description 강화
// ─────────────────────────────────────────────────────────────

export async function generateTailoredInstruction(jobDescription: string): Promise<TailoredInstructionWithRequirements> {
  const metaPrompt = `
    당신은 세계 최고의 프롬프트 엔지니어이자 채용 컨설턴트입니다.
    아래의 [채용 공고(JD)]를 심층 분석하여, 이 포지션의 지원자를 평가할 **'AI 면접관의 페르소나'**와 **'이력서 최적화 가이드라인'**을 작성해주세요.

    [Grounding 규칙]
    제공된 이력서, JD, GitHub 데이터만 사용하십시오. 외부 지식이나 일반 상식으로 추론하지 마십시오.
    확인할 수 없는 정보는 "[확인 필요]"로 표시하십시오.

    [목표 채용 공고]
    ${jobDescription}

    [지시사항]
    1. **페르소나 정의**: 이 직무의 채용 담당자가 가질 법한 구체적인 성향과 배경을 정의하십시오.
    2. **핵심 평가 기준**: JD에서 요구하는 기술 스택(Hard Skills)과 업무 태도(Soft Skills), 우대 사항을 바탕으로 이력서에서 반드시 드러내야 할 키워드와 경험을 나열하십시오.
    3. **수정 가이드라인 (한국 정서 반영)**: 한국의 기업 문화를 고려하여 이력서의 어조와 서술 방식을 지시하십시오.
    4. **출력 결과 형식**: JSON 형식으로 구조화된 분석 결과를 반환하십시오.
    5. **JD 요구사항 구조화**: 채용공고의 각 요구사항을 개별 항목으로 분리.
       - 자격요건(required)과 우대사항(preferred) 구분
       - 각 항목에서 핵심 키워드 추출
       - 카테고리: hard-skill, soft-skill, experience, education
    6. **키워드 추출 원칙**: JD 원문에서 직접 등장하는 단어만 키워드로 추출하십시오. 유추하거나 확장한 키워드는 포함하지 마십시오.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: metaPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            persona: { type: Type.STRING, description: "채용 담당자 페르소나 (1-2문장)" },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD 원문에서 직접 추출한 키워드만 포함. 유추하거나 확장한 키워드는 포함하지 않음" },
            evaluationCriteria: {
              type: Type.OBJECT,
              properties: {
                hardSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 기술 스택" },
                softSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 소프트 스킬" },
                preferredExperience: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD에 명시된 우대 경험" },
              },
              required: ["hardSkills", "softSkills", "preferredExperience"],
            },
            toneGuide: {
              type: Type.OBJECT,
              properties: {
                style: { type: Type.STRING, description: "어조 스타일" },
                endings: { type: Type.STRING, description: "종결어미 스타일" },
                avoidPatterns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "피해야 할 표현" },
              },
              required: ["style", "endings", "avoidPatterns"],
            },
            jdRequirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "요구사항 원문" },
                  category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                  importance: { type: Type.STRING, description: "required 또는 preferred" },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "JD 텍스트에 명시적으로 등장하는 단어만 포함" },
                },
                required: ["text", "category", "importance", "keywords"],
              },
            },
          },
          required: ["persona", "keywords", "evaluationCriteria", "toneGuide", "jdRequirements"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return DEFAULT_INSTRUCTION;
    try {
      return JSON.parse(jsonText) as TailoredInstructionWithRequirements;
    } catch {
      return DEFAULT_INSTRUCTION;
    }
  } catch (e) {
    console.warn("Failed to generate tailored instruction, using default.", e);
    return DEFAULT_INSTRUCTION;
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: GitHub 레포 정보 포맷팅
// ─────────────────────────────────────────────────────────────

export function formatRepoInfo(githubRepos: GithubRepo[], githubData?: GitHubFetchResult[]): string {
  const validRepos = githubRepos.filter(r => r.url.trim() !== '');
  if (validRepos.length === 0) return '';
  return validRepos.map((repo, idx) => {
    const fetchResult = githubData?.find(d => d.repoUrl === repo.url);
    const hasVerifiedData = fetchResult?.status === 'success' && fetchResult.data;

    let section = `## 리포지토리 ${idx + 1}: ${repo.url}\n`;

    if (hasVerifiedData) {
      const d = fetchResult!.data!;
      const langList = Object.entries(d.languages)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([lang]) => lang)
        .join(', ');
      const commitSummary = d.recentCommits
        .slice(0, 5)
        .map(c => `  - ${c.message} (${c.date.split('T')[0]})`)
        .join('\n');

      section += `[검증된 데이터 - confidence: verified]\n`;
      section += `- 프로젝트명: ${d.metadata.name}\n`;
      if (d.metadata.description) section += `- 설명: ${d.metadata.description}\n`;
      if (langList) section += `- 주요 언어: ${langList}\n`;
      section += `- 스타: ${d.metadata.stars}, 포크: ${d.metadata.forks}\n`;
      if (d.metadata.topics.length > 0) section += `- 토픽: ${d.metadata.topics.join(', ')}\n`;
      if (commitSummary) section += `- 최근 커밋:\n${commitSummary}\n`;
      if (d.readme) section += `- README 요약 (최대 3000자):\n${d.readme}\n`;
    } else if (fetchResult?.status === 'not-found') {
      section += `[데이터 수집 실패 - 비공개이거나 존재하지 않는 리포지토리]\n`;
    } else if (fetchResult?.status === 'rate-limited') {
      section += `[데이터 수집 실패 - API 요청 한도 도달]\n`;
    }

    section += `\n[사용자 제공 설명 - confidence: analyzed]\n`;
    section += repo.description || "설명 없음";

    return section;
  }).join('\n\n---\n\n');
}

// ─────────────────────────────────────────────────────────────
// Stage 2a: analyzeResume (Pro) — 분석 전용
// ─────────────────────────────────────────────────────────────

async function analyzeResume(
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[]
): Promise<AnalysisIntermediate> {
  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const today = new Date().toISOString().split('T')[0];

  const prompt = `[역할]
당신은 이력서 분석 전문가입니다.

[현재 날짜]
${today} — 이 날짜 기준으로 과거/현재/미래를 판단하십시오.

[Grounding 규칙]
제공된 이력서, JD, GitHub 데이터만 사용하십시오. 외부 지식이나 일반 상식으로 추론하지 마십시오.
확인할 수 없는 정보는 "[확인 필요]"로 표시하십시오.

[핵심 원칙 — 모든 분석의 기초]
원칙 1: 이력서 원문에 명시된 내용만 분석 대상입니다.
원칙 2: 이력서에 없는 기술/경험/성과는 존재하지 않는 것으로 취급합니다.
원칙 3: before 필드는 이력서에서 복사-붙여넣기한 원문이어야 합니다.

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

[JD 구조화 결과]
- 페르소나: ${instruction.persona}
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}
- 요구사항:
${instruction.jdRequirements.map((r: JdRequirement, i: number) =>
  `  ${i+1}. [${r.importance}] [${r.category}] ${r.text} (키워드: ${r.keywords.join(', ')})`
).join('\n')}

[이력서 원문]
${resumeText}

[채용 공고 원문]
${jobDescription}

${repoInfo ? `[GitHub 리포지토리 (참고용)]\n${repoInfo}\n` : ''}[분석 태스크]
각 JD 요구사항에 대해:
1. 이력서에서 관련 문장을 정확히 찾아 before에 원문 그대로 인용하십시오.
2. strong(명확히 충족) / weak(부분 충족) / missing(전혀 언급 없음)으로 판정하십시오.
3. 개선 방향을 1줄로 요약하십시오 (수정 예시는 작성하지 마십시오).
4. 관련 JD 키워드를 relevantJdKeywords에 기재하십시오.

[검증 규칙]
- before 필드에는 이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장만 허용됩니다.
- 이력서에 없는 기술명이 before에 등장하면 해당 분석 항목은 무효입니다.
- missing인 경우 before는 가장 관련성 높은 이력서 문장을 인용하거나, 해당 영역이 완전히 없으면 "(이력서에 관련 내용 없음)"으로 표시하십시오.`;

  const response = await getAI().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: { type: Type.NUMBER, description: "0-100. JD 필수 요구사항 대비 이력서 충족 비율. 이력서에 없는 내용을 있는 것처럼 점수에 반영하지 않음" },
          summary: { type: Type.STRING, description: "전체 분석 요약 2-3문장" },
          gapMap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirement: { type: Type.STRING, description: "JD 요구사항 원문" },
                category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                currentLevel: { type: Type.STRING, description: "strong(이력서에 명확히 충족), weak(부분 충족), missing(전혀 언급 없음)" },
                jdMentions: { type: Type.NUMBER, description: "JD에서 이 요구사항 관련 언급 횟수" },
                resumeMentions: { type: Type.NUMBER, description: "이력서에서 이 요구사항 관련 언급 횟수" },
                suggestion: { type: Type.STRING, description: "이 gap에 대한 한 줄 개선 방향" },
              },
              required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "suggestion"],
            },
          },
          analysisItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "고유 식별자 (action-1, action-2, ...)" },
                targetSection: { type: Type.STRING, description: "이력서에서 해당 내용이 위치한 섹션명" },
                before: { type: Type.STRING, description: "이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장. 원문에 없는 내용 포함 시 무효" },
                issue: { type: Type.STRING, description: "이 문장의 문제점 1줄 요약" },
                direction: { type: Type.STRING, description: "개선 방향 1줄 요약. 수정 예시는 작성하지 않음" },
                priority: { type: Type.STRING, description: "critical(JD 필수요건 미충족), high(우대사항), medium(표현 개선), low(선택적)" },
                category: { type: Type.STRING, description: "keyword-gap, quantify, reframe, add-missing, remove 중 하나" },
                relevantJdKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "이 항목과 관련된 JD 키워드" },
              },
              required: ["id", "targetSection", "before", "issue", "direction", "priority", "category", "relevantJdKeywords"],
            },
          },
          quickWins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "즉시 적용 가능한 개선 포인트 3-5개" },
        },
        required: ["matchScore", "summary", "gapMap", "analysisItems", "quickWins"],
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("Stage 2a: 분석 결과가 비어있습니다.");
  return JSON.parse(jsonText) as AnalysisIntermediate;
}

// ─────────────────────────────────────────────────────────────
// Stage 2b: generateCoaching (Pro) — 코칭 생성 전용
// ─────────────────────────────────────────────────────────────

async function generateCoaching(
  analysis: AnalysisIntermediate,
  resumeText: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[]
): Promise<CoachingResult> {
  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const today = new Date().toISOString().split('T')[0];

  const prompt = `[역할]
당신은 이력서 코칭 전문가입니다.

[현재 날짜]
${today} — 이 날짜 기준으로 과거/현재/미래를 판단하십시오.

[Grounding 규칙]
제공된 이력서, JD, GitHub 데이터만 사용하십시오. 외부 지식이나 일반 상식으로 추론하지 마십시오.
확인할 수 없는 정보는 "[확인 필요]"로 표시하십시오.

[핵심 원칙 — 모든 생성의 기초]
원칙 1: 아래 [분석 결과]에 명시된 항목만 코칭합니다.
원칙 2: after는 before 문장의 단어를 재배열/압축/구체화한 결과입니다. 새로운 내용 창작이 아닙니다.
원칙 3: 이력서 원문에 없는 기술명/회사명/수치는 반드시 [플레이스홀더]로 표시합니다.
${repoInfo ? '원칙 4: GitHub 데이터는 evidence.content에만 기재합니다. after 문장에는 포함하지 않습니다.' : ''}

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

[Few-shot 예시 — GOOD vs BAD]

=== 예시 1: 표현 개선 (GOOD) ===
{
  "before": "백엔드 API 개발 및 유지보수",
  "suggestion": "구체적인 규모감을 드러내세요. 이력서에 언급된 기술만 활용하세요.",
  "after": "백엔드 API 설계, 개발 및 유지보수 [처리 규모/성과 수치 기입]",
  "category": "quantify"
}

=== 예시 1: 같은 입력에 대한 BAD ===
{
  "before": "백엔드 API 개발 및 유지보수",
  "after": "Spring Boot + Kotlin 기반 MSA 백엔드 API 설계/개발, 일 100만 건 트래픽 처리",
  "문제": "Spring Boot, Kotlin, MSA, 100만 건 — 모두 원문에 없는 날조"
}

=== 예시 2: 키워드 갭 (GOOD) ===
{
  "before": "팀 프로젝트에서 협업 경험",
  "suggestion": "JD에서 요구하는 'Agile/Scrum' 키워드가 이력서에 부족합니다. 관련 경험이 있다면 추가를 고려하세요.",
  "after": "팀 프로젝트에서 협업 경험 [Agile/Scrum 관련 경험이 있다면 기입]",
  "category": "keyword-gap"
}

=== 예시 2: 같은 입력에 대한 BAD ===
{
  "before": "팀 프로젝트에서 협업 경험",
  "after": "Agile/Scrum 기반 크로스펑셔널 팀에서 스프린트 플래닝 및 회고 주도",
  "문제": "Agile, Scrum, 크로스펑셔널, 스프린트 — 모두 원문에 없는 날조. 원문+플레이스홀더 패턴을 사용해야 함"
}

=== 예시 3: 수치 추가 (GOOD) ===
{
  "before": "결제 시스템 개발 및 운영",
  "suggestion": "처리 규모나 성과를 수치로 드러내세요.",
  "after": "결제 시스템 개발 및 운영 [월간 처리 건수/금액 기입]",
  "category": "quantify"
}

=== 예시 3: 같은 입력에 대한 BAD ===
{
  "before": "결제 시스템 개발 및 운영",
  "after": "월 100억 원 규모 결제 시스템 설계 및 운영, 99.99% 가용성 달성",
  "문제": "100억 원, 99.99% — 이력서에 없는 수치 날조"
}

=== 예시 4: 항목 추가 (GOOD) ===
{
  "before": "(이력서에 관련 내용 없음)",
  "suggestion": "JD에서 요구하는 '상태관리' 경험이 이력서에 없습니다. 관련 경험이 있다면 추가를 권장합니다.",
  "after": "[Redux/Zustand 등 상태관리 라이브러리 사용 경험이 있다면 기입]",
  "category": "add-missing"
}

[분석 결과 (Stage 2a 출력)]
- matchScore: ${analysis.matchScore}
- summary: ${analysis.summary}
- gapMap:
${JSON.stringify(analysis.gapMap, null, 2)}
- analysisItems:
${JSON.stringify(analysis.analysisItems, null, 2)}
- quickWins: ${JSON.stringify(analysis.quickWins)}

[이력서 원문 (before 검증용)]
${resumeText}

${repoInfo ? `[GitHub 리포지토리 (evidence 작성용)]\n${repoInfo}\n` : ''}[생성 태스크]
각 analysisItem에 대해:
1. before: 분석 결과의 before를 그대로 복사하십시오.
2. suggestion: issue + direction을 2-3문장 코칭 지시("~하세요" 형태)로 확장하십시오.
3. after: before 문장을 direction에 따라 표현만 개선하십시오. 새 기술/경험 삽입 시 반드시 [플레이스홀더]를 사용하십시오.
4. evidence: JD 원문 인용 또는 GitHub 데이터 인용을 근거로 제시하십시오.
5. optimizedResume: 모든 after를 적용한 완성된 이력서 (Markdown 형식).

[톤 가이드]
- 스타일: ${instruction.toneGuide.style}
- 종결: ${instruction.toneGuide.endings}
- 피할 표현: ${instruction.toneGuide.avoidPatterns.join(', ')}
- 원문의 문체(명사형/서술형, 존댓말/평어, 간결/상세)를 분석하고 after에서 동일하게 유지하십시오.

[AI 탐지 회피]
- 과도한 열정 표현 금지 ("열정적으로", "끊임없이 노력하는")
- 추상적 미사여구 금지 ("다양한 경험을 통해 성장한", "폭넓은 시야를 가진")
- 뻔한 서론/결론 패턴 금지 ("저는 ~하는 사람입니다", "이러한 경험을 바탕으로")
- 자연스러운 구어체 문장 구조를 사용하십시오

[검증 규칙]
- after에 이력서 원문에 없는 고유명사(기술명, 회사명, 프레임워크명)가 등장하면 해당 항목은 무효입니다.
${repoInfo ? '- GitHub 데이터는 evidence.content에만 기재하십시오. after 문장에 직접 삽입하지 마십시오.' : ''}
- after가 원문과 완전히 다른 문장이 되어서는 안 됩니다. 원문의 골격을 유지하면서 표현만 개선하십시오.`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedResume: { type: Type.STRING, description: "모든 after를 적용한 완성된 이력서 (Markdown)" },
            matchScore: { type: Type.NUMBER, description: "0-100. JD 필수 요구사항 대비 이력서 충족 비율" },
            summary: { type: Type.STRING, description: "전체 분석 요약 2-3문장" },
            gapMap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  requirement: { type: Type.STRING, description: "JD 요구사항" },
                  category: { type: Type.STRING, description: "hard-skill, soft-skill, experience, education 중 하나" },
                  currentLevel: { type: Type.STRING, description: "strong(명확히 충족), weak(부분 충족), missing(전혀 언급 없음)" },
                  jdMentions: { type: Type.NUMBER },
                  resumeMentions: { type: Type.NUMBER },
                  relatedActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "관련 ActionItem ID 목록" },
                  suggestion: { type: Type.STRING, description: "이 gap에 대한 한 줄 개선 제안" },
                },
                required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "relatedActions", "suggestion"],
              },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  targetSection: { type: Type.STRING },
                  before: { type: Type.STRING, description: "이력서 원문에서 글자 하나 바꾸지 않고 정확히 복사한 문장. 원문에 없는 내용 포함 시 무효" },
                  suggestion: { type: Type.STRING, description: "코칭 지시. ~하세요 형태. 2-3문장" },
                  after: { type: Type.STRING, description: "before 문장의 표현만 개선한 결과. 원문에 없는 기술명/경험 삽입 시 [플레이스홀더] 사용 필수" },
                  evidence: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "jd, github, best-practice 중 하나" },
                        content: { type: Type.STRING, description: "JD 원문 직접 인용, GitHub 실제 데이터, 또는 일반적 채용 best practice" },
                        source: { type: Type.STRING },
                        confidence: { type: Type.STRING, description: "verified(직접 확인) 또는 inferred(추론)" },
                      },
                      required: ["type", "content", "confidence"],
                    },
                  },
                  priority: { type: Type.STRING, description: "critical, high, medium, low 중 하나" },
                  category: { type: Type.STRING, description: "keyword-gap, quantify, reframe, add-missing, remove 중 하나" },
                },
                required: ["id", "targetSection", "before", "suggestion", "after", "evidence", "priority", "category"],
              },
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "근거 출처" },
                  confidence: { type: Type.STRING, description: "verified, analyzed, inferred 중 하나" },
                  category: { type: Type.STRING, description: "documentation, problem-solving, collaboration, technical, soft-skill 중 하나" },
                  observation: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                },
                required: ["source", "confidence", "category", "observation", "impact"],
              },
            },
          },
          required: ["optimizedResume", "matchScore", "summary", "gapMap", "actionItems", "quickWins", "insights"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Stage 2b: 코칭 결과가 비어있습니다.");
    return JSON.parse(jsonText) as CoachingResult;

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('schema') || errorMsg.includes('depth')) {
      console.warn("Nested schema failed, trying fallback schema...");
      return generateCoachingWithFallbackSchema(prompt);
    }
    throw error;
  }
}

// Fallback: flatten evidence out of actionItems (schema depth 에러 대비)
async function generateCoachingWithFallbackSchema(prompt: string): Promise<CoachingResult> {
  const response = await getAI().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedResume: { type: Type.STRING },
          matchScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          gapMap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirement: { type: Type.STRING },
                category: { type: Type.STRING },
                currentLevel: { type: Type.STRING },
                jdMentions: { type: Type.NUMBER },
                resumeMentions: { type: Type.NUMBER },
                relatedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestion: { type: Type.STRING },
              },
              required: ["requirement", "category", "currentLevel", "jdMentions", "resumeMentions", "relatedActions", "suggestion"],
            },
          },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                targetSection: { type: Type.STRING },
                before: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                after: { type: Type.STRING },
                evidenceRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                priority: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["id", "targetSection", "before", "suggestion", "after", "evidenceRefs", "priority", "category"],
            },
          },
          evidenceList: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                actionItemId: { type: Type.STRING },
                evidenceType: { type: Type.STRING },
                content: { type: Type.STRING },
                source: { type: Type.STRING },
                confidence: { type: Type.STRING },
              },
              required: ["actionItemId", "evidenceType", "content", "confidence"],
            },
          },
          quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                confidence: { type: Type.STRING },
                category: { type: Type.STRING },
                observation: { type: Type.STRING },
                impact: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
              required: ["source", "confidence", "category", "observation", "impact"],
            },
          },
        },
        required: ["optimizedResume", "matchScore", "summary", "gapMap", "actionItems", "evidenceList", "quickWins", "insights"],
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("No response from AI (fallback)");

  const raw = JSON.parse(jsonText);

  // Remap evidenceList back into actionItems
  const evidenceByAction: Record<string, Evidence[]> = {};
  for (const e of raw.evidenceList || []) {
    (evidenceByAction[e.actionItemId] ??= []).push({
      type: e.evidenceType as Evidence['type'],
      content: e.content,
      source: e.source,
      confidence: e.confidence as Evidence['confidence'],
    });
  }

  const actionItems = (raw.actionItems || []).map((a: Record<string, unknown>) => ({
    ...a,
    evidence: evidenceByAction[a.id as string] ?? [],
  }));

  return { ...raw, actionItems, evidenceList: undefined } as CoachingResult;
}

// ─────────────────────────────────────────────────────────────
// relatedActions Backfill
// ─────────────────────────────────────────────────────────────

function backfillRelatedActions(
  gapMap: GapMapItem[],
  actionItems: ActionItem[],
  analysisItems: AnalysisItem[]
): GapMapItem[] {
  return gapMap.map(gap => {
    // Find analysisItems whose relevantJdKeywords overlap with this gap's requirement
    const gapReq = gap.requirement.toLowerCase();
    const matchingActionIds: string[] = [];

    for (const ai of analysisItems) {
      const keywordsMatch = ai.relevantJdKeywords.some(kw =>
        gapReq.includes(kw.toLowerCase()) || kw.toLowerCase().includes(gapReq.split(' ')[0])
      );
      if (keywordsMatch && actionItems.some(a => a.id === ai.id)) {
        matchingActionIds.push(ai.id);
      }
    }

    return {
      ...gap,
      relatedActions: matchingActionIds.length > 0 ? matchingActionIds : gap.relatedActions,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// coachResume Wrapper: Stage 2a → Stage 2b → Backfill
// ─────────────────────────────────────────────────────────────

export const coachResume = async (
  resumeText: string,
  jobDescription: string,
  instruction: TailoredInstructionWithRequirements,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  onStageChange?: (stage: 'resume-analysis' | 'coaching') => void
): Promise<CoachingResult> => {
  // Stage 2a: 분석
  onStageChange?.('resume-analysis');
  const analysis = await analyzeResume(resumeText, jobDescription, instruction, githubRepos, githubData);

  // Stage 2b: 코칭 생성
  onStageChange?.('coaching');
  const result = await generateCoaching(analysis, resumeText, instruction, githubRepos, githubData);

  // Backfill relatedActions using analysis intermediate data
  const enrichedGapMap = backfillRelatedActions(result.gapMap, result.actionItems, analysis.analysisItems);

  // Use analysis matchScore/summary if Stage 2b didn't override meaningfully
  return {
    ...result,
    gapMap: enrichedGapMap,
    matchScore: analysis.matchScore,
    summary: analysis.summary || result.summary,
    quickWins: analysis.quickWins.length > 0 ? analysis.quickWins : result.quickWins,
  };
};

// ─────────────────────────────────────────────────────────────
// Stage 3: enrichEvidenceBank (Flash) — 긍정 프레이밍 적용
// ─────────────────────────────────────────────────────────────

export async function enrichEvidenceBank(
  instruction: TailoredInstructionWithRequirements,
  githubData: GitHubFetchResult[],
): Promise<EvidenceBank> {
  const successfulData = githubData.filter(d => d.status === 'success' && d.data);
  if (successfulData.length === 0) {
    return { repos: [], techStack: {}, highlights: [] };
  }

  const githubDataFormatted = successfulData.map(d => {
    const data = d.data!;
    const langList = Object.entries(data.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang)
      .join(', ');
    return `## ${data.metadata.name} (${d.repoUrl})
- 설명: ${data.metadata.description || '없음'}
- 언어: ${langList}
- 스타: ${data.metadata.stars}, 포크: ${data.metadata.forks}
- 토픽: ${data.metadata.topics.join(', ') || '없음'}
${data.readme ? `- README (최대 2000자):\n${data.readme.slice(0, 2000)}` : ''}`;
  }).join('\n\n---\n\n');

  const prompt = `당신은 GitHub 활동 분석 전문가입니다.
아래 GitHub 레포지토리 데이터를 분석하여 채용 공고의 요구사항과 매핑하십시오.

[Grounding 규칙]
제공된 이력서, JD, GitHub 데이터만 사용하십시오. 외부 지식이나 일반 상식으로 추론하지 마십시오.
확인할 수 없는 정보는 "[확인 필요]"로 표시하십시오.

[핵심 원칙]
실제 데이터에서 직접 확인 가능한 내용만 포함하십시오.
각 근거의 confidence를 정확히 판정하십시오: verified(코드/커밋에서 직접 확인), inferred(README/설명에서 추론).

[JD 요구사항]
${instruction.jdRequirements.map(r => `- [${r.category}] ${r.text}`).join('\n')}

[GitHub 데이터]
${githubDataFormatted}

[임무]
1. 각 레포지토리가 어떤 JD 요구사항을 뒷받침하는지 매핑하십시오.
2. 기술 스택을 레포별로 정리하십시오.
3. 레포지토리 데이터에서 직접 확인할 수 있는 내용만 evidence로 작성하십시오.
`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            repos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "레포지토리 이름" },
                  url: { type: Type.STRING, description: "레포지토리 URL" },
                  relevantTo: { type: Type.ARRAY, items: { type: Type.STRING }, description: "이 레포가 뒷받침하는 JD 요구사항 목록" },
                  evidences: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "jd, github, best-practice 중 하나" },
                        content: { type: Type.STRING, description: "레포지토리 데이터에서 직접 확인한 근거 내용" },
                        source: { type: Type.STRING, description: "근거 출처 (레포명, 커밋, README 등)" },
                        confidence: { type: Type.STRING, description: "verified(코드/커밋에서 직접 확인) 또는 inferred(README/설명에서 추론)" },
                      },
                      required: ["type", "content", "confidence"],
                    },
                  },
                },
                required: ["name", "url", "relevantTo", "evidences"],
              },
            },
            highlights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "근거 유형" },
                  content: { type: Type.STRING, description: "주요 하이라이트 내용" },
                  source: { type: Type.STRING, description: "출처" },
                  confidence: { type: Type.STRING, description: "verified 또는 inferred" },
                },
                required: ["type", "content", "confidence"],
              },
            },
          },
          required: ["repos", "highlights"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return { repos: [], techStack: {}, highlights: [] };
    const parsed = JSON.parse(jsonText);
    return { repos: parsed.repos ?? [], techStack: parsed.techStack ?? {}, highlights: parsed.highlights ?? [] };
  } catch (e) {
    console.warn("Evidence bank enrichment failed:", e);
    return { repos: [], techStack: {}, highlights: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// Stage 4: Narrative Section Generation (Flash)
// ─────────────────────────────────────────────────────────────

const SECTION_TYPE_LABELS: Record<string, string> = {
  'self-introduction': '자기소개',
  'career-project': '경력사항/프로젝트 경험',
  'technical-skills': '보유기술 및 핵심역량',
  'motivation': '지원동기',
  'growth-plan': '성장계획/입사 후 포부',
  'custom': '사용자 정의 항목',
};

const K_STAR_K_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "섹션 제목 (한국어)" },
    content: { type: Type.STRING, description: "생성된 서술형 텍스트 전문. 결론(K)-상황(S)-과제(T)-행동(A)-결과(R)-가능성(K) 순서로 자연스럽게 연결된 하나의 완성된 글" },
    charCount: { type: Type.NUMBER, description: "content의 실제 글자 수 (공백 포함)" },
    kStarKBreakdown: {
      type: Type.OBJECT,
      description: "K-STAR-K 구조 분해",
      properties: {
        conclusion: { type: Type.STRING, description: "K: 결론 — 두괄식 핵심 메시지 (면접관이 첫 문장만 읽어도 강점 파악 가능)" },
        situation: { type: Type.STRING, description: "S: 상황 — 구체적 배경/맥락" },
        task: { type: Type.STRING, description: "T: 과제 — 본인이 맡은 목표/책임" },
        action: { type: Type.STRING, description: "A: 행동 — 수행한 구체적 행동과 기술적 역량" },
        result: { type: Type.STRING, description: "R: 결과 — 정량적 성과와 결과" },
        potential: { type: Type.STRING, description: "K: 가능성 — 이 경험이 지원 직무에서의 성장 가능성으로 이어지는 마무리" },
      },
      required: ["conclusion", "situation", "task", "action", "result", "potential"],
    },
    keywordsUsed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "본문에 자연스럽게 녹여낸 JD 키워드 목록",
    },
    githubEvidences: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "본문에 활용한 GitHub 근거 목록 (예: 'repo-name: React 기반 프론트엔드 구현')",
    },
  },
  required: ["title", "content", "charCount", "keywordsUsed", "githubEvidences"],
};

const TECH_NARRATIVE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "섹션 제목 (한국어)" },
    content: { type: Type.STRING, description: "생성된 서술형 텍스트 전문. 문제 정의→기술적 접근→구현→임팩트 순서로 자연스럽게 연결된 하나의 완성된 글" },
    charCount: { type: Type.NUMBER, description: "content의 실제 글자 수 (공백 포함)" },
    techNarrativeBreakdown: {
      type: Type.OBJECT,
      description: "Tech Narrative 구조 분해",
      properties: {
        problemDefinition: { type: Type.STRING, description: "문제 정의 — 해결해야 했던 기술적 문제" },
        technicalApproach: { type: Type.STRING, description: "기술적 접근 — 분석 방법과 선택 이유" },
        implementation: { type: Type.STRING, description: "구현 — 핵심 기술 결정과 트레이드오프" },
        impact: { type: Type.STRING, description: "임팩트 — 수치로 표현한 성과 (예: 'API 응답 시간 8초→4초')" },
      },
      required: ["problemDefinition", "technicalApproach", "implementation", "impact"],
    },
    keywordsUsed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "본문에 자연스럽게 녹여낸 JD 키워드 목록",
    },
    githubEvidences: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "본문에 활용한 GitHub 근거 목록",
    },
  },
  required: ["title", "content", "charCount", "keywordsUsed", "githubEvidences"],
};

function buildNarrativePrompt(
  spec: NarrativeSectionSpec,
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  coachingResult?: CoachingResult,
): string {
  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const today = new Date().toISOString().split('T')[0];
  const sectionLabel = spec.type === 'custom' ? (spec.customTitle || '사용자 정의') : SECTION_TYPE_LABELS[spec.type];

  const frameworkInstruction = spec.framework === 'k-star-k'
    ? `이 섹션은 K-STAR-K 프레임워크를 따릅니다. 한국 대기업 자기소개서의 표준 구조입니다.

구조:
1. K (결론): 두괄식으로 핵심 메시지를 먼저 제시하십시오. 면접관이 첫 문장만 읽어도 지원자의 강점을 파악할 수 있어야 합니다.
2. S (Situation): 구체적인 상황/배경을 설명하십시오.
3. T (Task): 본인이 맡은 과제/목표를 명시하십시오.
4. A (Action): 수행한 구체적 행동을 서술하십시오. 기술적 역량을 집중적으로 드러내십시오.
5. R (Result): 정량적 성과와 결과를 제시하십시오.
6. K (가능성): 이 경험이 지원 직무에서 어떤 성장 가능성으로 이어지는지 마무리하십시오.

글자 수 배분 가이드:
- K(결론): 전체의 10-15%
- S(상황): 전체의 10-15%
- T(과제): 전체의 10-15%
- A(행동): 전체의 25-35%
- R(결과): 전체의 15-20%
- K(가능성): 전체의 10-15%`
    : `이 섹션은 Tech Narrative (기술 문제해결 서사) 구조를 따릅니다. IT 스타트업에서 선호하는 실무 중심 구조입니다.

구조:
1. 문제 정의: 해결해야 했던 기술적 문제를 명확히 정의하십시오.
2. 기술적 접근: 문제를 분석하고 선택한 기술적 접근 방법과 그 이유를 설명하십시오.
3. 구현: 실제 구현 과정에서의 핵심 기술 결정과 트레이드오프를 서술하십시오.
4. 임팩트: 수치로 표현 가능한 성과를 제시하십시오 (예: "API 응답 시간 8초 → 4초로 단축", "배포 시간 30분 → 5분").

글자 수 배분 가이드:
- 문제 정의: 전체의 20-25%
- 기술적 접근: 전체의 25-30%
- 구현: 전체의 25-30%
- 임팩트: 전체의 15-25%`;

  const hasRepos = repoInfo.length > 0;
  const sectionTypeInstruction: Record<string, string> = {
    'self-introduction': hasRepos
      ? '개발 철학과 커리어 서사를 중심으로, GitHub 활동을 통해 증명된 핵심 가치와 JD 요구사항의 연결점을 자연스럽게 풀어내십시오.'
      : '개발 철학과 커리어 서사를 중심으로, 이력서에 기술된 경험과 JD 요구사항의 연결점을 자연스럽게 풀어내십시오.',
    'career-project': '가장 성과가 좋았던 프로젝트를 중심으로 기술적 문제 해결 과정을 구체적으로 서술하십시오. 반드시 프레임워크 구조 분해(breakdown)를 포함하십시오.',
    'technical-skills': hasRepos
      ? 'JD에서 요구하는 기술과 본인의 GitHub 활동/이력서의 교집합을 강조하십시오. 각 기술에 대한 구체적 활용 경험을 포함하십시오.'
      : 'JD에서 요구하는 기술과 이력서에 기술된 경험의 교집합을 강조하십시오. 각 기술에 대한 구체적 활용 경험을 포함하십시오.',
    'motivation': '지원 회사/직무에 대한 관심의 구체적 계기와, 본인의 경험이 어떻게 기여할 수 있는지 연결하십시오.',
    'growth-plan': '입사 후 구체적인 성장 계획과 기여 방향을 JD의 우대사항/선호경험과 연결하여 제시하십시오.',
    'custom': spec.prompt || '사용자가 제공한 방향에 따라 작성하십시오.',
  };

  const coachingContext = coachingResult
    ? `\n[분석 요약]\n- 매칭 점수: ${coachingResult.matchScore}/100\n- 요약: ${coachingResult.summary}\n- 주요 갭:\n${coachingResult.gapMap.slice(0, 5).map(g => `  - [${g.currentLevel}] ${g.requirement}: ${g.suggestion}`).join('\n')}`
    : '';

  return `[역할]
당신은 한국 대기업 및 IT 기업의 채용 프로세스에 정통한 자기소개서 작성 전문가입니다.

[Grounding 규칙]
제공된 이력서, JD, GitHub 데이터만 사용하십시오. 외부 지식이나 일반 상식으로 추론하지 마십시오.
확인할 수 없는 정보는 "[확인 필요]"로 표시하십시오.

[현재 날짜]
${today}

[작성할 섹션]
${sectionLabel} (최대 ${spec.charLimit}자)
${spec.prompt ? `\n[사용자 방향 힌트]\n${spec.prompt}` : ''}

[프레임워크]
${frameworkInstruction}

[섹션별 지침]
${sectionTypeInstruction[spec.type] || sectionTypeInstruction['custom']}

[글자 수 제한 — 엄격히 준수]
반드시 ${spec.charLimit}자 이내로 작성하십시오.
목표: 최대 글자 수의 90-95% (${Math.floor(spec.charLimit * 0.9)}~${Math.floor(spec.charLimit * 0.95)}자).
현재 글자 수를 세면서 작성하십시오.

[어조 규칙 — 엄격히 준수]
1. 모든 문장은 격식체 "~합니다", "~했습니다", "~입니다"로 끝내야 합니다.
2. 금지 종결어미: "~해요", "~했어요", "~예요", "~함.", "~임."
3. 겸손하지만 자신감 있는 어조를 유지하십시오.

[AI 탐지 회피]
- 과도한 열정 표현 금지 ("열정적으로", "끊임없이 노력하는")
- 추상적 미사여구 금지 ("다양한 경험을 통해 성장한", "폭넓은 시야를 가진")
- 뻔한 서론/결론 패턴 금지 ("저는 ~하는 사람입니다", "이러한 경험을 바탕으로")
- 자연스러운 구어체 문장 구조를 사용하십시오

[반환각 방지 — 절대 규칙]
1. 이력서${hasRepos ? '와 GitHub 데이터' : ''}에 명시된 내용만 활용하십시오.
2. 없는 경험/기술/수치는 [구체적 경험 기입] 또는 [수치 기입] 플레이스홀더를 사용하십시오.
${hasRepos ? '3. GitHub 데이터에서 확인 가능한 기술명만 본문에 포함하십시오.' : ''}

[수치화 패턴 예시]
- 처리량: "일 N건 → M건 처리" 또는 "[처리량 기입]"
- 성능: "응답시간 Xs → Ys 단축" 또는 "[성능 개선 수치 기입]"
- 비용: "운영비 N% 절감" 또는 "[비용 절감 수치 기입]"
- 규모: "N명 팀 리드" 또는 "[팀 규모 기입]"
이력서에 수치가 없으면 반드시 [플레이스홀더]를 사용하십시오.

[이력서 활용 우선순위]
1순위: 회사 경력 (직무, 성과, 역할) — 핵심 근거로 활용
2순위: 프로젝트 경험 — 경력을 보완하는 보조 근거로 활용
3순위: 기타 이력 (교육, 자격증, 활동 등) — 임팩트가 명확한 경우에만 활용
- 사소한 정보를 과대 해석하지 마십시오. 이력서에 한 줄로 언급된 내용을 주요 강점처럼 부풀리지 마십시오.
- 추론 금지: 이력서에 명시적으로 기재된 사실만 활용하십시오. "~했을 것이다", "~경험이 있을 수 있다"는 절대 금지입니다.
- 기타 이력이라도 정량적 성과나 명확한 임팩트가 있으면 적극 활용하십시오.

[JD 구조화 결과]
- 페르소나: ${instruction.persona}
- 필수 키워드: ${instruction.keywords.join(', ')}
- Hard Skills: ${instruction.evaluationCriteria.hardSkills.join(', ')}
- Soft Skills: ${instruction.evaluationCriteria.softSkills.join(', ')}
- 우대 경험: ${instruction.evaluationCriteria.preferredExperience.join(', ')}
- 요구사항:
${instruction.jdRequirements.map((r, i) =>
  `  ${i+1}. [${r.importance}] [${r.category}] ${r.text}`
).join('\n')}

[이력서 원문]
${resumeText}

[채용 공고 원문]
${jobDescription}

${repoInfo ? `[GitHub 리포지토리]\n${repoInfo}` : ''}
${coachingContext}`;
}

export async function generateNarrativeSection(
  spec: NarrativeSectionSpec,
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  coachingResult?: CoachingResult,
): Promise<NarrativeSectionResult> {
  const sectionLabel = spec.type === 'custom' ? (spec.customTitle || '사용자 정의') : SECTION_TYPE_LABELS[spec.type];

  try {
    const prompt = buildNarrativePrompt(spec, instruction, resumeText, jobDescription, githubRepos, githubData, coachingResult);
    const responseSchema = spec.framework === 'k-star-k' ? K_STAR_K_RESPONSE_SCHEMA : TECH_NARRATIVE_RESPONSE_SCHEMA;

    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("서술형 생성 결과가 비어있습니다.");

    const parsed = JSON.parse(jsonText);
    return {
      specId: spec.id,
      framework: spec.framework,
      title: parsed.title || sectionLabel,
      content: parsed.content || '',
      charCount: parsed.charCount || parsed.content?.length || 0,
      charLimit: spec.charLimit,
      status: 'success',
      kStarKBreakdown: parsed.kStarKBreakdown,
      techNarrativeBreakdown: parsed.techNarrativeBreakdown,
      keywordsUsed: parsed.keywordsUsed || [],
      githubEvidences: parsed.githubEvidences || [],
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`Narrative section generation failed for "${sectionLabel}":`, errorMsg);
    return {
      specId: spec.id,
      framework: spec.framework,
      title: sectionLabel,
      content: '',
      charCount: 0,
      charLimit: spec.charLimit,
      status: 'error',
      errorMessage: errorMsg,
      keywordsUsed: [],
      githubEvidences: [],
    };
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateNarrativeSections(
  specs: NarrativeSectionSpec[],
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  coachingResult?: CoachingResult,
  onProgress?: (completedIndex: number, total: number) => void,
): Promise<NarrativeGenerationResult> {
  const sections: NarrativeSectionResult[] = [];

  for (let i = 0; i < specs.length; i++) {
    const result = await generateNarrativeSection(
      specs[i], instruction, resumeText, jobDescription, githubRepos, githubData, coachingResult
    );
    sections.push(result);
    onProgress?.(i + 1, specs.length);

    // 500ms delay between requests to avoid rate limiting (skip after last)
    if (i < specs.length - 1) {
      await sleep(500);
    }
  }

  return {
    sections,
    generatedAt: new Date().toISOString(),
  };
}
