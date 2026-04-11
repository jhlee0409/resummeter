// ─────────────────────────────────────────────────────────────
// Narrative Section Generation Service
// Extracted from services/geminiService.ts (Phase 2B)
// ─────────────────────────────────────────────────────────────

import { Type, ThinkingLevel } from "@google/genai";
import type {
  NarrativeSectionSpec,
  NarrativeFramework,
  NarrativeSectionResult,
  NarrativeGenerationResult,
  NarrativeAnalysis,
  KStarKBreakdown,
  TechNarrativeBreakdown,
  CoachingResult,
  GithubRepo,
  TailoredInstructionWithRequirements,
  GitHubFetchResult,
  CompanyContext,
} from "../../types";
import { getAI } from "../../shared/api/geminiClient";
import { withRetry } from "../../shared/api/retry";
import { safeParseJSON } from "../../shared/lib/validation";
import { classifyError } from "../../shared/lib/errors";
import {
  SECURITY_RULE,
  GROUNDING_FULL,
  RESUME_HIERARCHY,
  QUANTIFICATION_NARRATIVE,
  formatInstruction,
} from "../../shared/prompt/promptBlocks";
import { formatRepoInfo, formatCompanyContext } from "../../shared/prompt/formatters";

// ─────────────────────────────────────────────────────────────
// Constants
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

// ─────────────────────────────────────────────────────────────
// buildNarrativePrompt — 기정의 타입(self-introduction 등) 전용. custom 타입은 2단계 파이프라인 사용.
// ─────────────────────────────────────────────────────────────

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
1. K (결론): 질문에 대한 핵심 답변을 두괄식으로 제시하십시오.
   [첫 문장 작성 규칙 — HR 평가 기준 반영]
   - 구체적 경험/성과가 포함된 요약이어야 합니다. 추상적 선언 금지.
   - GOOD: "기획 부재 상황에서 Canvas 기반 웹 에디터를 설계하여 B2B 계약 2건을 성사시킨 경험이 있습니다"
   - BAD: "불확실성을 기술적 확신으로 바꾸는 추진력이 저의 강점입니다" (추상적, 근거 없음)
   - BAD: "~에 기여하겠습니다" (미래 약속형 시작 금지 — 질문이 기여만을 물을 때도 경험 요약이 먼저)
   - BAD: "저는 ~입니다" (1인칭 주어 시작 자제. 매끄럽지 않고 과한 자기 강조)
   - 첫 문장에 "무엇을 했고 어떤 결과를 냈는지"가 담겨야 면접관이 7초 안에 파악 가능
2. S (Situation): 구체적인 상황/배경을 설명하십시오.
3. T (Task): 본인이 맡은 과제/목표를 명시하십시오.
4. A (Action): 수행한 구체적 행동을 서술하십시오. 기술적 역량을 집중적으로 드러내십시오.
5. R (Result): 정량적 성과와 결과를 제시하십시오.
6. K (가능성): 이 경험에서 얻은 교훈이나 성장을 요약하십시오.
   - 질문이 "기여"나 "포부"를 물을 때만 지원 직무와 연결하십시오.
   - 그 외에는 경험에서 체득한 원칙, 성장한 점, 또는 앞으로의 방향성으로 마무리하십시오.
   - "~하겠습니다"식 회사 어필로 끝내는 것을 기본값으로 삼지 마십시오.

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
    'custom': '위 [질문 분석]의 Step 2에서 결정한 서술 주어를 글의 중심축으로 삼으십시오. 경험 나열이 아니라, 질문이 요구하는 관점에서 경험을 재구성하여 답변하십시오.',
  };

  const coachingContext = coachingResult
    ? `\n[분석 요약]\n- 매칭 점수: ${coachingResult.matchScore}/100\n- 요약: ${coachingResult.summary}\n- 주요 갭:\n${coachingResult.gapMap.slice(0, 5).map(g => `  - [${g.currentLevel}] ${g.requirement}: ${g.suggestion}`).join('\n')}`
    : '';

  return `[역할]
당신은 한국 대기업 및 IT 기업의 채용 프로세스에 정통한 자기소개서 작성 전문가입니다.

[현재 날짜]
${today}

[작성할 섹션]
${sectionLabel} (최대 ${spec.charLimit}자)
${spec.type === 'custom'
  ? `\n[서술형 질문 — 이 질문에 정확히 답변하십시오]\n<user-input>\n${spec.customTitle || '자유 주제'}\n</user-input>${spec.prompt ? `\n\n[추가 지시]\n${spec.prompt}` : ''}\n\n[질문 분석 — 반드시 답변 전에 수행]\n아래 3단계를 거쳐 서술 전략을 결정한 뒤 작성을 시작하십시오:\n\nStep 1. 질문 해체: 이 질문이 요구하는 항목을 분리하십시오.\n  예: "직무 강점과 기여" → ①직무 강점 ②당사 기여\n  예: "프로젝트 내용, 성과, 역할" → ①프로젝트 내용 ②성과 ③본인 역할\n  예: "갈등 상황과 해결" → ①갈등 상황 ②해결 과정 ③결과/교훈\n\nStep 2. 서술 주어 결정: 질문이 무엇을 중심에 놓으라고 요구하는지 판단하십시오.\n  - 역량/강점을 묻는 질문 → 강점이 주어, 경험은 근거로만 (강점 → 이를 증명하는 사례 → 회사 적용)\n  - 프로젝트/경험을 묻는 질문 → 프로젝트가 주어, 기술 디테일과 본인 역할 중심 (배경 → 과제 → 행동 → 결과)\n  - 가치관/성격을 묻는 질문 → 신념이 주어, 경험은 에피소드 (가치관 → 체화된 경험 → 적용 방향)\n  - 기여/포부를 묻는 질문 → 회사가 주어, 본인은 수단 (회사 과제 분석 → 내가 해결할 수 있는 이유 → 구체적 계획)\n  - 위 분류에 해당하지 않으면 질문의 핵심 동사("기술하시오", "서술하시오", "설명하시오")와 목적어를 기준으로 판단하십시오.\n\nStep 3. 경험 선별: 질문의 핵심 포인트에 가장 부합하는 경험을 이력서에서 1-2개만 선택하십시오.\n  - 질문과 직접 연결되는 경험 > JD 요구사항과 맞는 경험 > 정량적 성과가 있는 경험\n  - 질문이 복수 항목을 요구하면, 각 항목에 대해 명확히 구분하여 답하십시오.\n  - 하나의 경험을 여러 각도로 깊게 다루는 것이 여러 경험을 얕게 나열하는 것보다 낫습니다.`
  : (spec.prompt ? `\n[사용자 지시 — 최우선 준수]\n아래 지시는 이력서 활용 우선순위보다 우선합니다. 반드시 이 방향에 따라 작성하십시오:\n"${spec.prompt}"` : '')}

[프레임워크]
${frameworkInstruction}

[섹션별 지침]
${sectionTypeInstruction[spec.type] || sectionTypeInstruction['custom']}

[글자 수 제한 — 엄격히 준수]
반드시 ${spec.charLimit}자 이내로 작성하십시오.
목표: 최대 글자 수의 90-95% (${Math.floor(spec.charLimit * 0.9)}~${Math.floor(spec.charLimit * 0.95)}자).
현재 글자 수를 세면서 작성하십시오.

[어조 규칙]
- 격식체 종결: "~합니다", "~했습니다", "~입니다"
- 금지: "~해요", "~했어요", "~예요", "~함.", "~임."

[서사 품질 — 가장 중요]
1. 인과관계: 모든 문장은 앞 문장의 결과이거나 다음 문장의 원인이어야 합니다. "그래서", "왜냐하면", "이때"의 논리가 문장 사이에 암묵적으로 흘러야 합니다.
2. 하나를 깊게: 경험 1개를 고민-결정-실행-결과의 맥락으로 깊게 서술하십시오. 여러 경험을 1-2문장씩 나열하면 깊이가 사라집니다.
3. 고민의 순간: 기술적 결정을 할 때 "왜 A가 아니라 B를 선택했는지", "어떤 트레이드오프가 있었는지"를 드러내십시오. 이것이 서사의 핵심입니다.
4. 구체적 장면: "분석했습니다"가 아니라 "A와 B를 X 기준으로 비교한 결과 Y 때문에 B를 선택했습니다"처럼 판단 과정을 보여주십시오.
5. 자연스러운 흐름: K-STAR-K 구조는 내부 설계도일 뿐, 실제 글은 하나의 이야기처럼 읽혀야 합니다. "상황은 ~이고, 과제는 ~이며" 식으로 구조를 노출하지 마십시오.
6. 전환의 필연성: 다른 경험으로 넘어갈 때 "이러한 경험은 ~에서도 이어졌습니다" 같은 천편일률적 전환 금지. 반드시 앞 경험에서 부족했거나 발전시킨 점을 연결고리로 삼으십시오.

[반환각 방지]
1. 이력서${hasRepos ? '와 GitHub 데이터' : ''}에 명시된 내용만 활용하십시오.
2. 없는 경험/기술/수치는 [구체적 경험 기입] 또는 [수치 기입] 플레이스홀더를 사용하십시오.
${hasRepos ? '3. GitHub 데이터에서 확인 가능한 기술명만 본문에 포함하십시오.' : ''}

${QUANTIFICATION_NARRATIVE}

${formatInstruction(instruction)}
- 요구사항:
${instruction.jdRequirements.map((r, i) =>
  `  ${i+1}. [${r.importance}] [${r.category}] ${r.text}`
).join('\n')}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고 원문]
<user-jd>
${jobDescription}
</user-jd>

${repoInfo ? `[GitHub 리포지토리]\n${repoInfo}` : ''}
${coachingContext}

[자기 검증]
작성 완료 후 검증하십시오:
1. 이력서에 없는 경험/기술/수치가 본문에 포함되었는가? → [플레이스홀더]로 교체
2. 문장 길이 변화: 가장 짧은 문장 ≤ 20자, 가장 긴 문장 ≥ 60자인가? 아니면 문장을 분리하거나 합쳐서 길이 변화를 만드십시오.
3. "활용하여", "기반으로", "통해", "바탕으로"가 각 1회 이하인가?`;
}

// ─────────────────────────────────────────────────────────────
// Stage 4a: 서술형 분석 (Flash) — 질문 해체 + 경험 선별 + 아웃라인
// ─────────────────────────────────────────────────────────────

function buildNarrativeAnalysisSchema(framework: NarrativeFramework) {
  const outlineSchema = framework === 'k-star-k'
    ? {
        type: Type.OBJECT,
        description: "K-STAR-K 아웃라인. 질문 유형에 따라 각 파트의 내용이 달라져야 함",
        properties: {
          conclusion: { type: Type.STRING, description: "K(결론): 구체적 경험+성과가 포함된 요약 1-2문장. '~하겠습니다' 미래약속형 금지. '저는 ~입니다' 금지. 면접관이 7초 안에 핵심 경험 파악 가능해야 함" },
          situation: { type: Type.STRING, description: "S(상황): 구체적 배경 — 언제, 어디서, 팀 규모, 프로젝트 성격, 당시 제약조건 포함" },
          task: { type: Type.STRING, description: "T(과제): 본인이 맡은 구체적 과제와 목표" },
          action: {
            type: Type.OBJECT,
            properties: {
              keyDecision: { type: Type.STRING, description: "핵심 판단: '왜 A가 아니라 B를 선택했는지' — 대안과 비교한 트레이드오프" },
              trialAndError: { type: Type.STRING, description: "시행착오: 처음 시도했다가 안 된 것, 예상과 달랐던 것, 수정한 것. 없으면 당시 어려웠던 점" },
              concreteAction: { type: Type.STRING, description: "구체적 행동: 실제로 구현/실행한 것. 기술명, 방법론, 도구 포함" },
            },
            required: ["keyDecision", "trialAndError", "concreteAction"],
          },
          result: { type: Type.STRING, description: "R(결과): 정량 성과. 숫자가 있으면 반드시 포함. 없으면 [수치 기입] 플레이스홀더" },
          potential: { type: Type.STRING, description: "K(가능성): 질문이 기여/포부를 물을 때만 지원 직무 연결. 그 외에는 경험에서 체득한 원칙이나 성장점" },
        },
        required: ["conclusion", "situation", "task", "action", "result", "potential"],
      }
    : {
        type: Type.OBJECT,
        description: "Tech Narrative 아웃라인. 기술 문제해결 서사 구조",
        properties: {
          problemDefinition: { type: Type.STRING, description: "문제 정의: 해결해야 했던 기술적 문제. 구체적 수치/제약조건 포함" },
          technicalApproach: {
            type: Type.OBJECT,
            properties: {
              alternatives: { type: Type.STRING, description: "검토한 대안들과 각각의 장단점" },
              chosenSolution: { type: Type.STRING, description: "최종 선택한 접근법과 그 이유 (트레이드오프)" },
              trialAndError: { type: Type.STRING, description: "시행착오: 처음 시도가 실패한 지점과 수정한 것" },
            },
            required: ["alternatives", "chosenSolution", "trialAndError"],
          },
          implementation: { type: Type.STRING, description: "구현: 핵심 기술 결정, 사용한 도구/방법론, 구체적 행동" },
          impact: { type: Type.STRING, description: "임팩트: 정량 성과 (before→after 수치). 없으면 [수치 기입] 플레이스홀더" },
        },
        required: ["problemDefinition", "technicalApproach", "implementation", "impact"],
      };

  return {
    type: Type.OBJECT,
    properties: {
      questionBreakdown: {
        type: Type.OBJECT,
        properties: {
          corePoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "질문이 요구하는 핵심 포인트 목록 (예: ['직무 강점', '당사 기여 방안'])" },
          narrativeSubject: { type: Type.STRING, description: "서술 주어: strength(역량/강점), project(프로젝트/경험), value(가치관/성격), contribution(기여/포부), other" },
          subjectReason: { type: Type.STRING, description: "이 서술 주어를 선택한 이유 (1문장)" },
        },
        required: ["corePoints", "narrativeSubject", "subjectReason"],
      },
      selectedExperience: {
        type: Type.OBJECT,
        properties: {
          main: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "메인 경험명 (프로젝트/회사명)" },
              reason: { type: Type.STRING, description: "이 경험을 선택한 이유 — 질문의 어떤 포인트에 부합하는지" },
              relatedJdRequirements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "이 경험과 연결되는 JD 요구사항" },
            },
            required: ["name", "reason", "relatedJdRequirements"],
          },
          sub: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              name: { type: Type.STRING, description: "보조 경험명 (필요한 경우만)" },
              connectionToMain: { type: Type.STRING, description: "메인 경험과의 연결고리 — 메인에서 부족한 어떤 점을 보완하는지" },
            },
            required: ["name", "connectionToMain"],
          },
        },
        required: ["main"],
      },
      jdKeywordsToWeave: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "본문에 자연스럽게 녹여야 할 JD 핵심 키워드 3-5개. 키워드 스터핑이 아니라 맥락 속에 자연스럽게 포함되어야 함",
      },
      outline: outlineSchema,
      humanTouchPoints: {
        type: Type.OBJECT,
        description: "AI 티 방지를 위한 인간적 요소. 이력서에서 추출하거나 맥락상 자연스러운 것을 선택",
        properties: {
          personalContext: { type: Type.STRING, description: "개인적 맥락: 당시 상황의 구체적 디테일 (팀 분위기, 시간 압박, 물리적 환경 등)" },
          limitation: { type: Type.STRING, description: "한계/아쉬움: 이 경험에서 부족했거나 아쉬웠던 점 1가지" },
          lessonLearned: { type: Type.STRING, description: "교훈: 이 경험에서 체득한 구체적 원칙 1가지" },
        },
        required: ["personalContext", "limitation", "lessonLearned"],
      },
    },
    required: ["questionBreakdown", "selectedExperience", "jdKeywordsToWeave", "outline", "humanTouchPoints"],
  };
}

async function analyzeNarrativeSection(
  spec: NarrativeSectionSpec,
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  coachingResult?: CoachingResult,
  companyContext?: CompanyContext | null,
  usedExperiences?: string[],
): Promise<NarrativeAnalysis> {
  const repoInfo = formatRepoInfo(githubRepos, githubData);
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';
  const question = spec.type === 'custom'
    ? (spec.customTitle || '자유 주제')
    : SECTION_TYPE_LABELS[spec.type];

  const coachingContext = coachingResult
    ? `\n[코칭 분석 결과]\n- 매칭 점수: ${coachingResult.matchScore}/100\n- 요약: ${coachingResult.summary}\n- 주요 갭:\n${coachingResult.gapMap.slice(0, 5).map(g => `  - [${g.currentLevel}] ${g.requirement}: ${g.suggestion}`).join('\n')}`
    : '';

  const usedBlock = usedExperiences?.length
    ? `\n[이미 사용된 경험 — 반드시 다른 경험을 선택하십시오]\n${usedExperiences.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n위 경험은 다른 항목에서 이미 사용되었습니다. 같은 프로젝트/에피소드를 선택하지 마십시오. 이력서에서 다른 경험을 찾으십시오.\n`
    : '';

  const prompt = `[역할]
당신은 한국 대기업 자기소개서 전략 분석가입니다.
서술형 질문을 해체하고, 이력서에서 최적의 경험을 선별하여 글의 설계도(아웃라인)를 작성합니다.
${companyBlock}
${usedBlock}
[서술형 질문]
<user-input>
${question}
</user-input>
${spec.prompt ? `\n[추가 지시]\n${spec.prompt}` : ''}

[분석 절차 — 순서대로 수행]

Step 1. 질문 해체
- 질문이 요구하는 핵심 포인트를 분리하십시오.
- 질문의 동사와 목적어를 기준으로 서술 주어를 결정하십시오:
  - 역량/강점을 묻는 질문 → strength: 강점이 주어, 경험은 근거
  - 프로젝트/경험을 묻는 질문 → project: 프로젝트가 주어, 기술 디테일과 역할 중심
  - 가치관/성격을 묻는 질문 → value: 신념이 주어, 경험은 에피소드
  - 기여/포부를 묻는 질문 → contribution: 회사 과제가 주어, 본인 경험은 해결 수단
  - 위 분류에 해당하지 않으면 → other: 질문의 핵심 동사/목적어 기준으로 자체 판단

Step 2. 경험 선별
- 이력서에서 질문의 핵심 포인트에 가장 부합하는 경험을 1개만 선택하십시오 (main).
- 하나의 경험을 깊게 다루는 것이 여러 경험을 얕게 나열하는 것보다 낫습니다.
- sub는 main 하나로 질문의 핵심 포인트를 절대 충족할 수 없을 때만 추가하십시오.
- sub를 추가하더라도 글의 80% 이상은 main에 할애하십시오.

Step 3. 아웃라인 설계
- 각 파트에 들어갈 핵심 내용을 1-2문장으로 작성하십시오.
- K(결론)은 질문에 대한 직접 답변이어야 합니다.
  - 반드시 질문의 핵심 키워드를 결론에 반영하십시오.
  - 예: 질문이 "AI를 활용해 비즈니스 문제를 해결한 경험"이면 → "AI로 ~문제를 해결하여 ~성과를 냈습니다"
  - 예: 질문이 "고객을 만나 문제를 발견한 경험"이면 → "현장에서 ~문제를 발견하고 ~로 해결했습니다"
  - 질문과 무관한 범용적 성과 요약("B2B 계약을 성사시킨 엔지니어입니다")은 금지.
- A(행동)에는 반드시 '핵심 판단(왜 B를 선택했는지)', '시행착오', '구체 행동' 3가지를 포함하십시오.
- K(가능성)은 질문이 기여/포부를 물을 때만 지원 직무와 연결. 그 외에는 교훈이나 성장점.

Step 4. 인간적 요소 추출
- HR 인사담당자는 AI가 쓴 글의 특징으로 '개인적 맥락 부재', '시행착오 없음', '한계 고백 없음'을 꼽습니다.
- 이력서에서 개인적 맥락(팀 규모, 시간 압박, 당시 제약조건)을 찾아내십시오.
- 이 경험에서 부족했거나 아쉬웠던 점 1가지를 솔직하게 서술하십시오.
- 이 경험에서 체득한 구체적 원칙 1가지를 추출하십시오.

[절대 금지 — 할루시네이션 방지]
- 이력서 원문에 없는 용어, 약어, 프레임워크명, 수치를 아웃라인에 포함하지 마십시오.
- 이력서에 명시되지 않은 기술명이나 방법론을 임의로 추가하지 마십시오.
- 확인할 수 없는 정보는 아웃라인에서 제외하십시오. 추측으로 채우지 마십시오.
- 모호한 표현("최적화된 레시피", "다양한 기법", "고도화된 시스템") 대신 이력서에서 확인 가능한 구체적 사실만 사용하십시오.

${formatInstruction(instruction)}

[이력서 원문]
<user-resume>
${resumeText}
</user-resume>

[채용 공고]
<user-jd>
${jobDescription}
</user-jd>

${repoInfo ? `[GitHub 리포지토리]\n${repoInfo}` : ''}
${coachingContext}`;

  const response = await withRetry(() => getAI().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n'),
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: "application/json",
      responseSchema: buildNarrativeAnalysisSchema(spec.framework),
    },
  }));

  const jsonText = response.text;
  return safeParseJSON<NarrativeAnalysis>(jsonText, '서술형 분석');
}

// ─────────────────────────────────────────────────────────────
// Stage 4b: 서술형 생성 (Pro) — 아웃라인 → 서사
// ─────────────────────────────────────────────────────────────

function buildWritingPrompt(
  analysis: NarrativeAnalysis,
  spec: NarrativeSectionSpec,
  resumeText: string,
  companyBlock: string = '',
): string {
  const question = spec.type === 'custom'
    ? (spec.customTitle || '자유 주제')
    : SECTION_TYPE_LABELS[spec.type];

  // 아웃라인을 framework에 맞게 포맷
  const ol = analysis.outline as Record<string, unknown>;
  const outlineText = spec.framework === 'k-star-k'
    ? `K(결론): ${ol.conclusion}
S(상황): ${ol.situation}
T(과제): ${ol.task}
A(행동):
  - 핵심 판단: ${(ol.action as Record<string, string>)?.keyDecision || ''}
  - 시행착오: ${(ol.action as Record<string, string>)?.trialAndError || ''}
  - 구체 행동: ${(ol.action as Record<string, string>)?.concreteAction || ''}
R(결과): ${ol.result}
K(가능성): ${ol.potential}`
    : `문제 정의: ${ol.problemDefinition}
기술적 접근:
  - 검토한 대안: ${(ol.technicalApproach as Record<string, string>)?.alternatives || ''}
  - 선택한 방법: ${(ol.technicalApproach as Record<string, string>)?.chosenSolution || ''}
  - 시행착오: ${(ol.technicalApproach as Record<string, string>)?.trialAndError || ''}
구현: ${ol.implementation}
임팩트: ${ol.impact}`;

  // 서술 주어별 글 구조 가이드
  const subjectGuide: Record<string, string> = {
    strength: `[서술 주어: 역량/강점 중심]
- 글의 중심축은 "강점"입니다. 경험은 강점을 증명하는 근거로만 사용하십시오.
- 비중: 강점 정의(15%) → 경험으로 증명(60%) → 강점이 직무에 어떻게 적용되는지(25%)
- 경험 서술 시 "이 행동이 왜 해당 강점의 발현인지" 연결이 반드시 있어야 합니다.`,
    project: `[서술 주어: 프로젝트/경험 중심]
- 글의 중심축은 "프로젝트"입니다. 기술 디테일과 본인 역할에 집중하십시오.
- 비중: 프로젝트 배경(15%) → 기술적 과제와 해결(55%) → 성과와 본인 역할 명시(30%)
- 반드시 "내가 한 것"과 "팀이 한 것"을 구분하십시오. 모호한 "우리"는 감점 요소입니다.`,
    value: `[서술 주어: 가치관/성격 중심]
- 글의 중심축은 "신념/가치관"입니다. 경험은 이 가치관이 형성된 에피소드입니다.
- 비중: 가치관 선언(10%) → 형성 계기 에피소드(50%) → 이 가치관이 실무에서 발현된 사례(30%) → 앞으로의 방향(10%)
- 추상적 미사여구 대신 구체적 장면으로 가치관을 보여주십시오.`,
    contribution: `[서술 주어: 기여/포부 중심]
- 글의 중심축은 "회사의 과제"입니다. 본인 경험은 해결 수단입니다.
- 비중: 회사/직무 과제 분석(20%) → 관련 경험으로 해결 능력 증명(50%) → 구체적 기여 계획(30%)
- 기여 계획은 "열심히 하겠습니다"가 아니라 "경험 X를 Y에 적용하여 Z를 달성하겠습니다" 수준의 구체성이 필요합니다.`,
    other: `[서술 주어: 질문 자체 분석 기반]
- 질문의 핵심 동사/목적어를 중심으로 글을 구성하십시오.
- 질문이 요구하는 모든 포인트에 균등하게 답하십시오.`,
  };

  const subject = analysis.questionBreakdown.narrativeSubject;

  return `[역할]
당신은 한국 자기소개서 작성 전문가입니다.
아래 [아웃라인]을 바탕으로 하나의 완성된 글을 작성하십시오.
분석이나 경험 선별은 이미 완료되었습니다. 당신의 임무는 오직 좋은 글을 쓰는 것입니다.
${companyBlock}

[질문]
${question}

[질문 분석 결과]
- 핵심 포인트: ${analysis.questionBreakdown.corePoints.join(', ')}
- 서술 주어: ${subject} (${analysis.questionBreakdown.subjectReason})

${subjectGuide[subject] || subjectGuide.other}

[선별된 경험]
- 메인: ${analysis.selectedExperience.main.name} — ${analysis.selectedExperience.main.reason}
${analysis.selectedExperience.sub ? `- 보조: ${analysis.selectedExperience.sub.name} — ${analysis.selectedExperience.sub.connectionToMain}` : ''}

[본문에 녹여야 할 JD 키워드]
${analysis.jdKeywordsToWeave.join(', ')}
— 키워드를 직접 나열하지 말고, 경험 서술 속에 자연스럽게 포함시키십시오.

[아웃라인 — 이 순서와 내용을 따르되, 글로 풀어내십시오]
${outlineText}

[인간적 요소 — 반드시 글에 녹여내십시오]
- 개인적 맥락: ${analysis.humanTouchPoints.personalContext}
- 한계/아쉬움: ${analysis.humanTouchPoints.limitation}
- 교훈: ${analysis.humanTouchPoints.lessonLearned}

[글쓰기 원칙]

1. 첫 문장이 승부: 면접관은 7초 안에 판단합니다. 첫 문장에 구체적 경험+성과가 담겨야 합니다.
   - 금지: "~하겠습니다"(미래 약속형), "저는 ~입니다"(1인칭 선언형), 추상적 강점 나열
   - 핵심: 첫 문장은 질문의 키워드를 반영해야 합니다. 질문과 무관한 범용 성과 요약 금지.
   - 예: 질문이 "AI 활용 경험"이면 → "AI 자동 응답 시스템을 구축하여 운영 인건비 70%를 절감한 경험이 있습니다"
   - 예: 질문이 "고객을 만나 문제 발견"이면 → "방송 현장에서 자동화 도구가 오히려 운영자 부담을 키우는 역설을 발견하고 해결했습니다"
2. 서사의 흐름: 모든 문장은 앞 문장의 결과이거나 다음 문장의 원인이어야 합니다.
3. 기술적 의사결정의 "왜"를 보여주세요: "A를 도입했습니다"가 아니라 "A와 B를 X 기준으로 비교한 결과, Y 때문에 A를 선택했습니다"처럼 트레이드오프를 드러내십시오. 도구/기술을 선택한 이유를 쓰지 않으면 깊이 없는 글이 됩니다.
4. 시행착오는 필수입니다: 처음부터 성공한 이야기는 AI가 쓴 글입니다. 반드시 1가지 이상의 시행착오, 실패, 예상과 달랐던 점을 포함하십시오. "처음에는 ~할 것이라 예상했지만 실제로는 ~였다", "초기에는 ~했으나 결과가 좋지 않아 ~로 전환했다" 같은 반전이 진정성을 만듭니다.
5. 구조를 감추세요: 프레임워크는 설계도일 뿐, 글에서 구조가 보이면 안 됩니다.
6. 전환의 필연성: "이러한 경험은 ~에서도 이어졌습니다" 금지. 필연적 연결고리만.
7. 구체적 장면: 추상적 요약 대신 구체적 숫자, 도구명, 행동.
8. 마무리도 경험 기반: "~하겠습니다"식 회사 어필 금지. 경험에서 얻은 교훈이나 원칙으로 마무리하십시오. "이 경험을 통해 ~를 깨달았습니다"가 "~에서 기여하겠습니다"보다 훨씬 강합니다. 기여 질문이어도 마지막 1문장만 짧게 연결하고, 나머지는 경험 기반으로.
9. 모호한 표현 제거: 이력서에서 확인할 수 없는 용어/약어 사용 금지. "최적화된 레시피", "고도화된 시스템", "다양한 기법" 같은 모호한 표현 대신 이력서에 있는 구체적 사실만 쓰십시오.
10. 하나에 집중: 메인 경험 하나를 깊이 있게 서술하십시오. 관련 없는 별개 경험을 끝에 덧붙이면 서사가 분산되어 인상에 남지 않습니다.

[문단 구성 — 가독성]
- 3-4개 문단으로 나누십시오. 1000자 기준 문단당 250-330자.
- 문단 전환 시 빈 줄 없이 자연스럽게 이어지되, 논리적 단위로 끊으십시오.
- 한 문단이 5문장을 넘기지 마십시오.
- 첫 문단: 결론(K) + 상황(S). 두 번째 문단: 과제(T) + 행동(A). 세 번째 문단: 결과(R) + 마무리(K).
  (이 배분은 가이드일 뿐 글의 흐름에 따라 조정 가능)

[어조]
- 격식체: "~합니다", "~했습니다"
- 금지: "~해요", "~했어요", "~예요", "~함.", "~임."

[AI 탐지 회피 — 진정성이 최고의 탐지 회피]
- 금지 단어: "활용하여", "기반으로", "통해", "바탕으로" — 각 1회 이하
- "혁신적인", "시너지", "열정적으로", "끊임없이", "다양한 경험을 통해", "극대화", "체계적으로" 절대 금지
- 문장 길이를 의도적으로 변화시키십시오 (짧은 문장과 긴 문장 혼재)
- "일련의 과정을 거치며", "이러한 상황을 타개하고자" 같은 AI 특유의 포장 문구 금지. 직접적으로 쓰십시오.
- 가장 강력한 AI 탐지 회피: 시행착오, 실패, 한계를 솔직히 쓰는 것. AI는 실패를 잘 못 씁니다.

[글자 수]
${spec.charLimit}자 이내. 목표: ${Math.floor(spec.charLimit * 0.9)}~${Math.floor(spec.charLimit * 0.95)}자.

[동문서답 방지 — 작성 완료 후 반드시 검증]
질문의 핵심 포인트: [${analysis.questionBreakdown.corePoints.join(', ')}]
위 포인트 각각에 대해 본문에서 명확히 답변했는지 확인하십시오.
하나라도 빠졌으면 해당 포인트를 추가한 후 제출하십시오.

[반환각 방지]
아웃라인에 있는 내용만 글로 풀어내십시오. 아웃라인에 없는 새로운 경험/기술/수치를 추가하지 마십시오.
이력서 원문에서 팩트를 확인하십시오:
<user-resume>
${resumeText.slice(0, 3000)}
</user-resume>`;
}

async function writeNarrativeFromAnalysis(
  analysis: NarrativeAnalysis,
  spec: NarrativeSectionSpec,
  resumeText: string,
  companyContext?: CompanyContext | null,
): Promise<{ title: string; content: string; charCount: number; keywordsUsed: string[]; githubEvidences: string[]; kStarKBreakdown?: KStarKBreakdown; techNarrativeBreakdown?: TechNarrativeBreakdown }> {
  const companyBlock = companyContext ? formatCompanyContext(companyContext) : '';
  const prompt = buildWritingPrompt(analysis, spec, resumeText, companyBlock);
  const responseSchema = spec.framework === 'k-star-k' ? K_STAR_K_RESPONSE_SCHEMA : TECH_NARRATIVE_RESPONSE_SCHEMA;

  const response = await withRetry(() => getAI().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: [SECURITY_RULE, GROUNDING_FULL, RESUME_HIERARCHY].join('\n\n'),
      temperature: 0.3,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema,
    },
  }));

  const jsonText = response.text;
  return safeParseJSON<{ title: string; content: string; charCount: number; keywordsUsed: string[]; githubEvidences: string[]; kStarKBreakdown?: KStarKBreakdown; techNarrativeBreakdown?: TechNarrativeBreakdown }>(jsonText, '서술형 생성');
}

// ─────────────────────────────────────────────────────────────
// Stage 4: 서술형 생성 통합 (분석 → 생성)
// ─────────────────────────────────────────────────────────────

export async function generateNarrativeSection(
  spec: NarrativeSectionSpec,
  instruction: TailoredInstructionWithRequirements,
  resumeText: string,
  jobDescription: string,
  githubRepos: GithubRepo[],
  githubData?: GitHubFetchResult[],
  coachingResult?: CoachingResult,
  companyContext?: CompanyContext | null,
  usedExperiences?: string[],
): Promise<NarrativeSectionResult> {
  const sectionLabel = spec.type === 'custom' ? (spec.customTitle || '사용자 정의') : SECTION_TYPE_LABELS[spec.type];

  try {
    // Stage 4a: 분석 (Flash)
    const analysis = await analyzeNarrativeSection(
      spec, instruction, resumeText, jobDescription, githubRepos, githubData, coachingResult, companyContext, usedExperiences
    );

    // Stage 4b: 생성 (Pro)
    const written = await writeNarrativeFromAnalysis(analysis, spec, resumeText, companyContext);

    return {
      specId: spec.id,
      framework: spec.framework,
      title: written.title || sectionLabel,
      content: written.content || '',
      charCount: written.charCount || written.content?.length || 0,
      charLimit: spec.charLimit,
      status: 'success',
      kStarKBreakdown: written.kStarKBreakdown,
      techNarrativeBreakdown: written.techNarrativeBreakdown,
      keywordsUsed: written.keywordsUsed || [],
      githubEvidences: written.githubEvidences || [],
    };
  } catch (error: unknown) {
    const classified = classifyError(error);
    const errorMsg = classified.userMessage;
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
  companyContext?: CompanyContext | null,
): Promise<NarrativeGenerationResult> {
  const sections: NarrativeSectionResult[] = [];
  const usedExperiences: string[] = [];

  for (let i = 0; i < specs.length; i++) {
    const result = await generateNarrativeSection(
      specs[i], instruction, resumeText, jobDescription, githubRepos, githubData, coachingResult, companyContext, usedExperiences
    );
    sections.push(result);
    // 사용된 경험을 누적하여 다음 섹션에서 다른 경험 선택 유도
    if (result.status === 'success' && result.title) {
      usedExperiences.push(result.title);
    }
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
