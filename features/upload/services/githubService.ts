// GitHub REST API service for public repository data collection
// Uses unauthenticated endpoints (60 req/hr) with localStorage caching

import { GitHubRepoData, GitHubFetchResult } from "../../../types";

const CACHE_TTL = 3600000; // 1 hour
const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

let remainingRequests = 60;

function getCacheKey(owner: string, repo: string): string {
  return `gh_cache_${owner}_${repo}`;
}

function getCached(owner: string, repo: string): GitHubRepoData | null {
  try {
    const key = getCacheKey(owner, repo);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(owner: string, repo: string, data: GitHubRepoData): void {
  try {
    const key = getCacheKey(owner, repo);
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable - silently ignore
  }
}

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace('.git', '') };
  } catch {
    return null;
  }
}

function updateRateLimit(headers: Headers): void {
  const remaining = headers.get('X-RateLimit-Remaining');
  if (remaining !== null) {
    remainingRequests = parseInt(remaining, 10);
  }
}

async function fetchJSON<T>(url: string): Promise<{ data: T | null; status: number }> {
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  updateRateLimit(response.headers);
  if (!response.ok) return { data: null, status: response.status };
  return { data: await response.json() as T, status: response.status };
}

async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  const filenames = ['README.md', 'readme.md', 'README', 'readme'];
  for (const filename of filenames) {
    try {
      const response = await fetch(`${RAW_BASE}/${owner}/${repo}/HEAD/${filename}`);
      if (response.ok) {
        const text = await response.text();
        return text.slice(0, 3000); // 3000 char limit
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchRepoData(owner: string, repo: string): Promise<GitHubRepoData> {
  // Parallel fetch: metadata + languages + commits + README
  const [metaResult, langResult, commitsResult, readme] = await Promise.all([
    fetchJSON<any>(`${API_BASE}/repos/${owner}/${repo}`),
    fetchJSON<Record<string, number>>(`${API_BASE}/repos/${owner}/${repo}/languages`),
    fetchJSON<any[]>(`${API_BASE}/repos/${owner}/${repo}/commits?per_page=20`),
    fetchReadme(owner, repo),
  ]);

  const meta = metaResult.data;
  const metadata = meta ? {
    name: meta.name || repo,
    description: meta.description || null,
    language: meta.language || null,
    stars: meta.stargazers_count || 0,
    forks: meta.forks_count || 0,
    topics: meta.topics || [],
    updatedAt: meta.updated_at || '',
  } : {
    name: repo,
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    topics: [],
    updatedAt: '',
  };

  // Filter out merge commits, take max 10
  const commits = (commitsResult.data || [])
    .filter((c: any) => c.commit && !c.commit.message?.startsWith('Merge'))
    .slice(0, 10)
    .map((c: any) => ({
      message: (c.commit.message || '').split('\n')[0].slice(0, 200),
      date: c.commit.author?.date || '',
      author: c.commit.author?.name || '',
    }));

  return {
    metadata,
    readme,
    languages: langResult.data || {},
    recentCommits: commits,
  };
}

export async function fetchGitHubRepo(repoUrl: string): Promise<GitHubFetchResult> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return { repoUrl, status: 'error', error: '유효하지 않은 GitHub URL입니다.' };
  }

  const { owner, repo } = parsed;

  // Check cache first
  const cached = getCached(owner, repo);
  if (cached) {
    return { repoUrl, status: 'success', data: cached };
  }

  // Check rate limit before making requests
  if (remainingRequests <= 5) {
    return { repoUrl, status: 'rate-limited', error: 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' };
  }

  try {
    const data = await fetchRepoData(owner, repo);

    // If metadata fetch failed (404), it's not found
    if (!data.metadata.description && !data.readme && data.recentCommits.length === 0 && data.metadata.stars === 0) {
      // Double check with a dedicated metadata call result
      const checkResult = await fetchJSON<any>(`${API_BASE}/repos/${owner}/${repo}`);
      if (checkResult.status === 404) {
        return { repoUrl, status: 'not-found', error: '리포지토리를 찾을 수 없습니다. (비공개이거나 존재하지 않음)' };
      }
      if (checkResult.status === 403 || checkResult.status === 429) {
        return { repoUrl, status: 'rate-limited', error: 'GitHub API 요청 한도에 도달했습니다.' };
      }
    }

    // Cache the result
    setCache(owner, repo, data);
    return { repoUrl, status: 'success', data };
  } catch (error) {
    console.error(`Failed to fetch GitHub repo ${repoUrl}:`, error);
    return { repoUrl, status: 'error', error: '데이터 수집 중 오류가 발생했습니다.' };
  }
}

export async function fetchAllRepos(repos: Array<{ url: string }>): Promise<GitHubFetchResult[]> {
  const results: GitHubFetchResult[] = [];
  let rateLimited = false;

  for (const repo of repos) {
    if (!repo.url.trim()) continue;

    if (rateLimited) {
      results.push({
        repoUrl: repo.url,
        status: 'rate-limited',
        error: 'GitHub API 요청 한도에 도달하여 건너뛰었습니다.',
      });
      continue;
    }

    const result = await fetchGitHubRepo(repo.url);
    results.push(result);

    if (result.status === 'rate-limited') {
      rateLimited = true;
    }
  }

  return results;
}
