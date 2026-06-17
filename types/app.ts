import type { CompanyContext } from './company';

export enum AppStep {
  UPLOAD = 0,
  ANALYSIS = 1,
  REVIEW = 2
}

export interface GithubRepo {
  url: string;
  description: string;
  name?: string;
  language?: string | null;
  stars?: number;
}

export interface GitHubRepoData {
  metadata: {
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    topics: string[];
    updatedAt: string;
  };
  readme: string | null;
  languages: Record<string, number>;
  recentCommits: Array<{
    message: string;
    date: string;
    author: string;
  }>;
}

export interface GitHubFetchResult {
  repoUrl: string;
  status: 'success' | 'not-found' | 'rate-limited' | 'error';
  data?: GitHubRepoData;
  error?: string;
}

/**
 * 범용 증빙 자료 입력 — 직무 무관. GitHub repo는 'link'의 한 종류일 뿐.
 * file: PDF/이미지를 base64로 담아 Gemini 멀티모달로 직접 해석.
 * text: 자유 메모/실적 설명. link: 포트폴리오·발행물·repo 등 URL+설명.
 */
export type EvidenceInputKind = 'file' | 'text' | 'link';

export interface EvidenceInput {
  id: string;
  kind: EvidenceInputKind;
  /** 사용자가 붙인 라벨/출처 (예: "2025 영업 실적표", "포트폴리오") */
  label?: string;
  // kind === 'file'
  fileName?: string;
  mimeType?: string;      // 예: application/pdf, image/png
  dataBase64?: string;    // data: 프리픽스 없는 순수 base64
  // kind === 'link'
  url?: string;
  // kind === 'text' | 'link' 설명
  text?: string;
}

export interface UserInputData {
  resumeText: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  githubRepos: GithubRepo[];
  githubData?: GitHubFetchResult[];
  /** 범용 증빙 자료 (파일/텍스트/링크). 멀티모달 해석 대상. */
  evidenceInputs?: EvidenceInput[];
  companyContext?: CompanyContext | null;
}

export type PdfValidationError = 'TOO_LARGE' | 'INVALID_FORMAT' | 'ENCRYPTED' | 'CORRUPTED' | 'UNKNOWN';

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  phase: 'validating' | 'extracting' | 'rendering-thumbnail';
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  charCount: number;
  lineCount: number;
  thumbnailDataUrl: string | null;
  metadata: {
    author?: string;
    title?: string;
  };
}
