/**
 * 회사 컨텍스트 자동 수집 서비스.
 * Gemini Google Search grounding으로 회사 정보를 검색+요약.
 */

import { Type, ThinkingLevel } from '@google/genai';
import { getAI } from './promptCache';
import { withRetry } from './retry';
import { safeParseJSON } from './validation';
import { classifyError } from './errors';
import type { CompanyContext } from '../types';

/**
 * JD 텍스트에서 회사명을 추출합니다.
 */
export async function extractCompanyName(jobDescription: string): Promise<string | null> {
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음 채용 공고에서 회사 이름만 추출하세요. 회사명만 한 단어로 답변하세요. 찾을 수 없으면 "UNKNOWN"이라고 답하세요.\n\n${jobDescription.slice(0, 2000)}`,
      config: {
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const name = response.text?.trim();
    return name && name !== 'UNKNOWN' ? name : null;
  } catch {
    return null;
  }
}

/**
 * Gemini Google Search grounding으로 회사 정보를 수집합니다.
 */
export async function researchCompany(
  companyName: string,
  jobDescription: string,
): Promise<CompanyContext> {
  const prompt = `당신은 채용 리서치 전문가입니다.
다음 회사에 대해 조사하고, 구직자가 이력서를 최적화할 때 유용한 정보를 정리하세요.

회사: ${companyName}

채용 공고 요약:
${jobDescription.slice(0, 1500)}

다음 항목을 조사해서 JSON으로 반환하세요:

1. **techStack**: 이 회사가 사용하는 기술 스택 (공식 기술 블로그, 채용 공고, GitHub 기반)
2. **culture**: 조직 문화 요약 (2-3문장. 채용 페이지, 기술 블로그, 인터뷰 기사 기반)
3. **idealCandidate**: 이 회사가 원하는 인재상 (2-3문장. 채용 공고, 대표 인터뷰 기반)
4. **recentNews**: 최근 뉴스/동향 (최대 3건. 투자, 신규 서비스, 조직 변화 등)
5. **businessDirection**: 현재 사업 방향과 중점 영역 (1-2문장)

[규칙]
- 검색으로 확인된 사실만 포함. 추측하지 마십시오.
- 각 항목에서 출처를 명시하지 마십시오 (별도 sources 필드에 수집).
- 한국어로 작성하세요.
- 정보를 찾을 수 없는 항목은 빈 값으로 두세요.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
            culture: { type: Type.STRING },
            idealCandidate: { type: Type.STRING },
            recentNews: { type: Type.ARRAY, items: { type: Type.STRING } },
            businessDirection: { type: Type.STRING },
          },
          required: ['techStack', 'culture', 'idealCandidate', 'recentNews', 'businessDirection'],
        },
      },
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error('회사 정보 수집 결과가 비어있습니다.');

    const parsed = safeParseJSON<{
      techStack: string[];
      culture: string;
      idealCandidate: string;
      recentNews: string[];
      businessDirection: string;
    }>(jsonText, '회사 정보 수집');

    // 출처 URL 추출
    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = metadata?.groundingChunks
      ?.map(chunk => chunk.web?.uri)
      .filter((uri): uri is string => !!uri) ?? [];

    // 신뢰도 계산: 필드가 비어있을수록 낮음
    const filledFields = [
      parsed.techStack.length > 0,
      parsed.culture.length > 10,
      parsed.idealCandidate.length > 10,
      parsed.recentNews.length > 0,
      parsed.businessDirection.length > 10,
    ].filter(Boolean).length;
    const confidence = filledFields / 5;

    return {
      companyName,
      techStack: parsed.techStack,
      culture: parsed.culture,
      idealCandidate: parsed.idealCandidate,
      recentNews: parsed.recentNews,
      businessDirection: parsed.businessDirection,
      confidence,
      sources,
    };
  } catch (error) {
    console.error('Company research failed:', error);
    throw classifyError(error);
  }
}

/**
 * 회사 컨텍스트를 프롬프트 주입 형태로 포맷합니다.
 */
export function formatCompanyContext(ctx: CompanyContext): string {
  if (ctx.confidence < 0.2) return '';

  const parts: string[] = [`[회사 컨텍스트 — ${ctx.companyName}]`];

  if (ctx.techStack.length > 0) {
    parts.push(`기술 스택: ${ctx.techStack.join(', ')}`);
  }
  if (ctx.culture) {
    parts.push(`조직 문화: ${ctx.culture}`);
  }
  if (ctx.idealCandidate) {
    parts.push(`인재상: ${ctx.idealCandidate}`);
  }
  if (ctx.businessDirection) {
    parts.push(`사업 방향: ${ctx.businessDirection}`);
  }
  if (ctx.recentNews.length > 0) {
    parts.push(`최근 동향: ${ctx.recentNews.join(' | ')}`);
  }

  parts.push(`\n이 회사의 맥락을 반영하여 분석과 코칭을 수행하십시오. 회사 정보 신뢰도: ${Math.round(ctx.confidence * 100)}%.`);

  return parts.join('\n');
}
