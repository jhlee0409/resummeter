import React, { useState, useCallback } from 'react';
import { Stepper } from './components/Stepper';
import { UploadStep } from './components/UploadStep';
import { AnalysisStep } from './components/AnalysisStep';
import { ReviewStep } from './components/ReviewStep';
import { AppStep, UserInputData, OptimizationResult } from './types';
import { optimizeResume } from './services/geminiService';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);

  const [userData, setUserData] = useState<UserInputData>({
    resumeText: '',
    jobDescription: '',
    githubRepos: [{ url: '', description: '' }],
  });

  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleInputChange = <K extends keyof UserInputData>(field: K, value: UserInputData[K]) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartAnalysis = useCallback(async () => {
    setCurrentStep(AppStep.ANALYSIS);

    try {
      const optimizationResult = await optimizeResume(
        userData.resumeText,
        userData.jobDescription,
        userData.githubRepos
      );

      setResult(optimizationResult);
      setCurrentStep(AppStep.REVIEW);
    } catch (error) {
      console.error(error);
      alert("AI 분석 중 오류가 발생했습니다. API 키와 입력값을 확인해주세요.");
      setCurrentStep(AppStep.UPLOAD);
    }
  }, [userData]);

  const handleRestart = () => {
    setResult(null);
    setUserData({ resumeText: '', jobDescription: '', githubRepos: [{ url: '', description: '' }] });
    setCurrentStep(AppStep.UPLOAD);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-50">

      {/* Navbar */}
      <header className="bg-white/70 glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="font-extrabold text-[17px] tracking-tight text-slate-900">
                  Resum<span className="text-gradient">meter</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-xl hover:bg-slate-100"
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
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">

          {currentStep !== AppStep.ANALYSIS && (
            <Stepper currentStep={currentStep} />
          )}

          <div className={currentStep !== AppStep.ANALYSIS ? 'mt-8' : ''}>
            {currentStep === AppStep.UPLOAD && (
              <div className="animate-fade-in-up">
                <UploadStep
                  data={userData}
                  onChange={handleInputChange}
                  onNext={handleStartAnalysis}
                />
              </div>
            )}

            {currentStep === AppStep.ANALYSIS && (
              <div className="animate-fade-in">
                <AnalysisStep />
              </div>
            )}

            {currentStep === AppStep.REVIEW && result && (
              <div className="animate-scale-in">
                <ReviewStep
                  originalData={userData}
                  result={result}
                  onRestart={handleRestart}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200/50 py-5 mt-auto">
        <div className="max-w-6xl mx-auto px-5 text-center text-slate-400 text-[11px] tracking-wide">
          &copy; {new Date().getFullYear()} Resummeter &middot; Powered by Google Gemini
        </div>
      </footer>
    </div>
  );
};

export default App;
