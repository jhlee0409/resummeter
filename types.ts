export interface Insight {
  fileOrCommit: string;
  observation: string;
  impact: string;
}

export interface OptimizationResult {
  optimizedResume: string;
  insights: Insight[];
}

export enum AppStep {
  UPLOAD = 0,
  ANALYSIS = 1,
  REVIEW = 2
}

export interface GithubRepo {
  url: string;
  description: string;
}

export interface UserInputData {
  resumeText: string;
  jobDescription: string;
  githubRepos: GithubRepo[];
}