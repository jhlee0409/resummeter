/**
 * Prompt formatting helpers — shared across multiple Gemini service files.
 */

import type { GithubRepo, GitHubFetchResult, CompanyContext } from "../../types";

/**
 * GitHub 리포지토리 정보를 프롬프트 주입 형태로 포맷합니다.
 */
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
