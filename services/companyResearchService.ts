/**
 * 회사/직무 리서치 서비스.
 * gemini-2.5-flash-lite + Google Search grounding.
 * 회사 리서치와 직무 리서치를 분리하여 병렬 실행.
 */

import { getAI } from './promptCache';
import { withRetry } from './retry';
import { safeParseJSON } from './validation';
import { classifyError } from './errors';
import type { CompanyInfo, JobRoleInfo, CompanyContext } from '../types';

const RESEARCH_MODEL = 'gemini-2.5-flash-lite';

// ─── 리서치 캐시 (localStorage, LRU 10건, TTL 24h) ───

const RESEARCH_CACHE_KEY = 'resummeter_research_cache';
const RESEARCH_MAX_ENTRIES = 10;
const RESEARCH_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

interface CachedResearch {
  key: string;
  type: 'company' | 'role';
  data: CompanyInfo | JobRoleInfo;
  createdAt: number;
}

// 메모리 fallback (Node.js 등 localStorage 없는 환경)
let _memoryCache: CachedResearch[] = [];

function getResearchCache(): CachedResearch[] {
  const now = Date.now();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RESEARCH_CACHE_KEY);
      if (raw) {
        const entries: CachedResearch[] = JSON.parse(raw);
        return entries.filter(e => now - e.createdAt < RESEARCH_TTL_MS);
      }
    }
  } catch { /* localStorage 실패 → 메모리 fallback */ }
  return _memoryCache.filter(e => now - e.createdAt < RESEARCH_TTL_MS);
}

function setResearchCache(entries: CachedResearch[]) {
  while (entries.length > RESEARCH_MAX_ENTRIES) entries.shift();
  _memoryCache = [...entries];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RESEARCH_CACHE_KEY, JSON.stringify(entries));
    }
  } catch { /* full — silent */ }
}

function getCachedResearch<T>(key: string, type: 'company' | 'role'): T | null {
  const entries = getResearchCache();
  const match = entries.find(e => e.key === key && e.type === type);
  if (!match) return null;
  const updated = entries.filter(e => !(e.key === key && e.type === type));
  updated.push({ ...match, createdAt: Date.now() });
  setResearchCache(updated);
  return match.data as T;
}

function putResearchCache(key: string, type: 'company' | 'role', data: CompanyInfo | JobRoleInfo) {
  const entries = getResearchCache().filter(e => !(e.key === key && e.type === type));
  entries.push({ key, type, data, createdAt: Date.now() });
  setResearchCache(entries);
}

/** 응답 텍스트에서 JSON 추출 (마크다운 코드블럭 제거) */
function extractJSON(text: string): string {
  // ```json ... ``` 또는 ``` ... ``` 패턴
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  // 첫 번째 { ... 마지막 } 추출
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) return text.slice(braceStart, braceEnd + 1);
  return text;
}

/**
 * 회사 정보 리서치 — 기술 스택, 문화, 인재상, 뉴스, 사업 방향
 */
export async function researchCompany(companyName: string): Promise<CompanyInfo> {
  const cacheKey = companyName.trim().toLowerCase();
  const cached = getCachedResearch<CompanyInfo>(cacheKey, 'company');
  if (cached) return cached;

  const prompt = `당신은 채용 리서치 전문가입니다.
다음 회사에 대해 조사하고 JSON으로 반환하세요.

회사: ${companyName}

반환할 JSON 형식:
{
  "techStack": ["기술1", "기술2", ...],
  "culture": "조직 문화 요약 2-3문장",
  "idealCandidate": "이 회사가 원하는 인재상 2-3문장",
  "recentNews": ["뉴스1", "뉴스2", "뉴스3"],
  "businessDirection": "현재 사업 방향 1-2문장"
}

조사 기준:
- techStack: 공식 기술 블로그, 채용 공고, GitHub에서 확인된 기술만
- culture: 채용 페이지, 기술 블로그, 인터뷰 기사 기반
- idealCandidate: 채용 공고, 대표/CTO 인터뷰 기반
- recentNews: 최근 투자, 신규 서비스, 조직 변화 등 최대 3건
- businessDirection: 현재 중점 영역

규칙: 검색으로 확인된 사실만. 추측 금지. 한국어. 못 찾은 항목은 빈 값.
JSON만 반환하세요.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        // Flash Lite: responseMimeType + googleSearch 동시 사용 불가 → 프롬프트에서 JSON 요청
      },
    }));

    const rawText = response.text;
    if (!rawText) throw new Error('회사 정보 수집 결과가 비어있습니다.');
    const jsonText = extractJSON(rawText);

    const parsed = safeParseJSON<{
      techStack?: string[];
      culture?: string;
      idealCandidate?: string;
      recentNews?: string[];
      businessDirection?: string;
    }>(jsonText, '회사 정보 수집');

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = metadata?.groundingChunks
      ?.map(chunk => chunk.web?.uri)
      .filter((uri): uri is string => !!uri) ?? [];

    const filledFields = [
      (parsed.techStack?.length ?? 0) > 0,
      (parsed.culture?.length ?? 0) > 10,
      (parsed.idealCandidate?.length ?? 0) > 10,
      (parsed.recentNews?.length ?? 0) > 0,
      (parsed.businessDirection?.length ?? 0) > 10,
    ].filter(Boolean).length;

    const result: CompanyInfo = {
      companyName,
      techStack: parsed.techStack ?? [],
      culture: parsed.culture ?? '',
      idealCandidate: parsed.idealCandidate ?? '',
      recentNews: parsed.recentNews ?? [],
      businessDirection: parsed.businessDirection ?? '',
      confidence: filledFields / 5,
      sources,
    };
    putResearchCache(cacheKey, 'company', result);
    return result;
  } catch (error) {
    console.error('Company research failed:', error);
    throw classifyError(error);
  }
}

/**
 * 직무 리서치 — 이 직무가 뭔지, 핵심 특성
 */
export async function researchJobRole(jobTitle: string, companyName?: string): Promise<JobRoleInfo> {
  const cacheKey = `${(companyName ?? '').trim().toLowerCase()}:${jobTitle.trim().toLowerCase()}`;
  const cached = getCachedResearch<JobRoleInfo>(cacheKey, 'role');
  if (cached) return cached;

  const scopeText = companyName ? `${companyName}에서의 "${jobTitle}"` : `"${jobTitle}"`;

  const prompt = `당신은 채용 리서치 전문가입니다.
다음 직무/포지션에 대해 업계 맥락을 조사하고 JSON으로 반환하세요.

직무: ${scopeText}

반환할 JSON 형식:
{
  "roleInsight": "이 직무에 대한 업계 리서치 2-3문장",
  "roleKeyTraits": ["특성1", "특성2", "특성3", "특성4", "특성5"]
}

조사 기준:
- roleInsight: 이 직무의 기원, 다른 회사에서의 유사 역할, 일반 개발자/직군과의 차이점. 예: "Forward Deployed Engineer"는 팔란티어에서 시작된 역할이며, 고객사에 직접 파견되어 기술로 비즈니스 문제를 해결하는 엔지니어.
- roleKeyTraits: 이 직무에서 성공하는 사람의 핵심 특성 3-5개. 업계 사례, 인터뷰, 채용 공고 기반. 구체적으로. 예: "고객 앞에서 문제를 정의하는 능력", "빠른 프로토타이핑", "기술+비즈니스 양쪽 언어 구사"

규칙: 검색으로 확인된 사실만. 추측 금지. 한국어. JSON만 반환하세요.`;

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        // Flash Lite: responseMimeType + googleSearch 동시 사용 불가 → 프롬프트에서 JSON 요청
      },
    }));

    const rawText = response.text;
    if (!rawText) throw new Error('직무 리서치 결과가 비어있습니다.');
    const jsonText = extractJSON(rawText);

    const parsed = safeParseJSON<{
      roleInsight?: string;
      roleKeyTraits?: string[];
    }>(jsonText, '직무 리서치');

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = metadata?.groundingChunks
      ?.map(chunk => chunk.web?.uri)
      .filter((uri): uri is string => !!uri) ?? [];

    const filledFields = [
      (parsed.roleInsight?.length ?? 0) > 10,
      (parsed.roleKeyTraits?.length ?? 0) > 0,
    ].filter(Boolean).length;

    const result: JobRoleInfo = {
      jobTitle,
      roleInsight: parsed.roleInsight ?? '',
      roleKeyTraits: parsed.roleKeyTraits ?? [],
      confidence: filledFields / 2,
      sources,
    };
    putResearchCache(cacheKey, 'role', result);
    return result;
  } catch (error) {
    console.error('Job role research failed:', error);
    throw classifyError(error);
  }
}

/**
 * CompanyInfo + JobRoleInfo → CompanyContext (하위 호환)
 */
export function mergeResearchResults(
  company: CompanyInfo | null,
  role: JobRoleInfo | null,
): CompanyContext | null {
  if (!company && !role) return null;

  return {
    companyName: company?.companyName ?? role?.jobTitle ?? '',
    techStack: company?.techStack ?? [],
    culture: company?.culture ?? '',
    idealCandidate: company?.idealCandidate ?? '',
    recentNews: company?.recentNews ?? [],
    businessDirection: company?.businessDirection ?? '',
    roleInsight: role?.roleInsight ?? '',
    roleKeyTraits: role?.roleKeyTraits ?? [],
    confidence: Math.max(company?.confidence ?? 0, role?.confidence ?? 0),
    sources: [...(company?.sources ?? []), ...(role?.sources ?? [])],
  };
}

/**
 * 회사 컨텍스트를 프롬프트 주입 형태로 포맷합니다.
 */
export function formatCompanyContext(ctx: CompanyContext): string {
  if (ctx.confidence < 0.4) return '';

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
  if (ctx.roleInsight) {
    parts.push(`\n[직무 리서치]\n${ctx.roleInsight}`);
  }
  if (ctx.roleKeyTraits.length > 0) {
    parts.push(`이 직무 성공 핵심 특성: ${ctx.roleKeyTraits.join(', ')}`);
  }

  parts.push(`\n이 회사와 직무의 맥락을 반영하여 분석과 코칭을 수행하십시오. 정보 신뢰도: ${Math.round(ctx.confidence * 100)}%.`);

  return parts.join('\n');
}
