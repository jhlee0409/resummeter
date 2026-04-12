import React, { useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import { Stepper } from '../shared/ui/Stepper';
import { UploadStep } from '../components/UploadStep';
import { AnalysisStep } from '../features/analysis/AnalysisStep';
import { ReviewStep } from '../components/ReviewStep';
import { AppStep, UserInputData, CoachingResult, GitHubFetchResult, TailoredInstructionWithRequirements } from '../types';
import { generateTailoredInstruction, coachResume, enrichEvidenceBank } from '../services/geminiService';
import { track } from '../services/analytics';
import { getCachedAnalysis, setCachedAnalysis, getCachedAnalysisByKey } from '../features/review/services/analysisCache';
import { PreviousAnalysesPanel } from '../features/review/PreviousAnalysesPanel';
import { calculateScore } from '../core/scoring/scoringEngine';
import { researchCompany, researchJobRole, mergeResearchResults } from '../core/research/companyResearch';
import { getOrCreateSessionCache, invalidateCache, type SessionCache } from '../services/promptCache';
import { toast } from 'sonner';
import { useFeatureStore } from '../stores/featureStore';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);

  const [userData, setUserData] = useState<UserInputData>({
    resumeText: '',
    jobDescription: '',
    companyName: '',
    jobTitle: '',
    githubRepos: [{ url: '', description: '' }],
    githubData: undefined,
  });

  const [result, setResult] = useState<CoachingResult | null>(null);
  const [instruction, setInstruction] = useState<TailoredInstructionWithRequirements | null>(null);
  const [analysisStage, setAnalysisStage] = useState<'jd-analysis' | 'resume-analysis' | 'coaching' | 'evidence-matching'>('jd-analysis');

  const handleInputChange = <K extends keyof UserInputData>(field: K, value: UserInputData[K]) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const handleLoadCached = useCallback(() => {
    const cached = getCachedAnalysis(userData.resumeText, userData.jobDescription);
    if (!cached) {
      toast.error('이전 분석 결과를 찾을 수 없습니다');
      return;
    }
    setInstruction(cached.instruction);
    setResult(cached.result);
    if (cached.companyContext) {
      setUserData(prev => ({ ...prev, companyContext: cached.companyContext }));
    }
    toast.success('이전 분석 결과를 불러왔습니다');
    track({ type: 'analysis_complete', matchScore: cached.result.matchScore, durationMs: 0 });
    setCurrentStep(AppStep.REVIEW);
  }, [userData.resumeText, userData.jobDescription]);

  const handleLoadByCacheKey = useCallback((cacheKey: string) => {
    const cached = getCachedAnalysisByKey(cacheKey);
    if (!cached) {
      toast.error('이전 분석 결과를 찾을 수 없습니다');
      return;
    }
    setInstruction(cached.instruction);
    setResult(cached.result);
    if (cached.companyContext) {
      setUserData(prev => ({ ...prev, companyContext: cached.companyContext }));
    }
    toast.success('이전 분석 결과를 불러왔습니다');
    track({ type: 'analysis_complete', matchScore: cached.result.matchScore, durationMs: 0 });
    setCurrentStep(AppStep.REVIEW);
  }, []);

  const handleStartAnalysis = useCallback(async (freshGithubData?: GitHubFetchResult[]) => {
    const githubData = freshGithubData ?? userData.githubData;
    const analysisStartTime = Date.now();
    track({
      type: 'analysis_start',
      resumeLength: userData.resumeText.length,
      jdLength: userData.jobDescription.length,
      hasGithub: userData.githubRepos.some(r => r.url.trim() !== ''),
    });
    setCurrentStep(AppStep.ANALYSIS);
    setAnalysisStage('jd-analysis');

    try {
      // Stage 0 (리서치) + Stage 1 (JD 분석) 병렬 실행
      const hasCompany = userData.companyName.trim().length >= 2;
      const hasJobTitle = userData.jobTitle.trim().length >= 2;

      const [instructionResult, companyInfo, jobRoleInfo] = await Promise.all([
        // Stage 1: JD 분석
        generateTailoredInstruction(userData.jobDescription, userData.companyName || undefined, userData.jobTitle || undefined),
        // Stage 0a: 회사 리서치 (Flash Lite)
        hasCompany
          ? researchCompany(userData.companyName.trim()).catch(() => null)
          : Promise.resolve(null),
        // Stage 0b: 직무 리서치 (Flash Lite)
        hasJobTitle
          ? researchJobRole(userData.jobTitle.trim(), hasCompany ? userData.companyName.trim() : undefined).catch(() => null)
          : Promise.resolve(null),
      ]);

      setInstruction(instructionResult);
      const instruction = instructionResult;

      // 리서치 결과 합성
      const companyContext = mergeResearchResults(companyInfo, jobRoleInfo);
      if (companyContext) {
        setUserData(prev => ({ ...prev, companyContext }));
      }

      // Context Caching: 공통 컨텍스트를 Gemini 서버에 캐싱
      const sessionCache = await getOrCreateSessionCache('pro', userData.resumeText, userData.jobDescription, instruction).catch(() => null);

      // Stage 2 (coaching) + Stage 3 (evidence bank) 병렬 실행
      // evidenceBank는 instruction + githubData만 필요 → coaching과 독립적
      const successfulFetches = githubData?.filter(d => d.status === 'success') ?? [];
      const [coachingResult, evidenceBank] = await Promise.all([
        coachResume(userData.resumeText, userData.jobDescription, instruction, userData.githubRepos, githubData, (stage) => setAnalysisStage(stage), companyContext, sessionCache),
        successfulFetches.length > 0
          ? enrichEvidenceBank(instruction, githubData!).catch(e => { console.warn("Evidence matching failed:", e); return null; })
          : Promise.resolve(null),
      ]);

      const emptyBank = !evidenceBank || (evidenceBank.repos.length === 0 && evidenceBank.highlights.length === 0);
      const finalResult = emptyBank ? coachingResult : { ...coachingResult, evidenceBank: evidenceBank! };

      const scoring = calculateScore(finalResult.gapMap, instruction, userData.resumeText, userData.jobDescription, companyContext);
      const scoredResult = { ...finalResult, matchScore: scoring.matchScore, scoringResult: scoring };

      setResult(scoredResult);
      // stale state 방지: userData.companyContext 대신 로컬 companyContext 사용
      setCachedAnalysis(userData.resumeText, userData.jobDescription, instruction, scoredResult, companyContext);
      track({ type: 'analysis_complete', matchScore: scoring.matchScore, durationMs: Date.now() - analysisStartTime });
      setCurrentStep(AppStep.REVIEW);
      // Context Cache 정리 (TTL 30분이지만 세션 종료 시 즉시 삭제)
      invalidateCache().catch(() => {});
    } catch (error) {
      console.error(error);
      invalidateCache().catch(() => {});
      alert("AI 분석 중 오류가 발생했습니다. API 키와 입력값을 확인해주세요.");
      setCurrentStep(AppStep.UPLOAD);
    }
  }, [userData]);

  const handleRestart = () => {
    track({ type: 'restart' });
    useFeatureStore.getState().resetAll();
    invalidateCache().catch(() => {});
    setResult(null);
    setAnalysisStage('jd-analysis');
    setUserData({ resumeText: '', jobDescription: '', companyName: '', jobTitle: '', githubRepos: [{ url: '', description: '' }], githubData: undefined });
    setCurrentStep(AppStep.UPLOAD);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 relative">

      {/* Aurora Background */}
      <div className="aurora-bg">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-[120px] animate-aurora-1" />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-violet-500/8 blur-[100px] animate-aurora-2" />
        <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-cyan-400/6 blur-[80px] animate-aurora-3" />
      </div>

      {/* Navbar */}
      <header className="bg-dark-900/60 glass border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
                  <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="font-extrabold text-[17px] tracking-tight text-white">
                  Resum<span className="text-gradient">meter</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors rounded-xl hover:bg-white/5"
              >
                <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative z-10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">

          {currentStep !== AppStep.ANALYSIS && (
            <Stepper currentStep={currentStep} />
          )}

          <div className={currentStep !== AppStep.ANALYSIS ? 'mt-8' : ''}>
            {currentStep === AppStep.UPLOAD && (
              <div className="animate-fade-in-up space-y-6">
                <PreviousAnalysesPanel onLoad={handleLoadByCacheKey} />
                <UploadStep
                  data={userData}
                  onChange={handleInputChange}
                  onNext={handleStartAnalysis}
                  onLoadCached={handleLoadCached}
                />
              </div>
            )}

            {currentStep === AppStep.ANALYSIS && (
              <div className="animate-fade-in">
                <AnalysisStep stage={analysisStage} hasGithub={userData.githubRepos.some(r => r.url.trim() !== '')} />
              </div>
            )}

            {currentStep === AppStep.REVIEW && result && (
              <div className="animate-scale-in">
                <ReviewStep
                  originalData={userData}
                  result={result}
                  instruction={instruction!}
                  onRestart={handleRestart}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <Toaster theme="dark" position="bottom-right" />
      <footer className="border-t border-white/[0.06] py-5 mt-auto">
        <div className="max-w-6xl mx-auto px-5 text-center text-zinc-600 text-[11px] tracking-wide">
          &copy; {new Date().getFullYear()} Resummeter &middot; Powered by Google Gemini
        </div>
      </footer>
    </div>
  );
};

export default App;
