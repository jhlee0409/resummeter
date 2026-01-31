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
    githubRepos: [{ url: '', description: '' }], // Initialize with one empty repo entry
  });

  const [result, setResult] = useState<OptimizationResult | null>(null);

  // Updated to accept generic values for different field types
  const handleInputChange = <K extends keyof UserInputData>(field: K, value: UserInputData[K]) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartAnalysis = useCallback(async () => {
    setCurrentStep(AppStep.ANALYSIS);
    
    try {
      // Simulate network delay if needed, but the API call itself takes time
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 rounded-lg p-1.5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                 <span className="font-bold text-xl text-slate-800 tracking-tight leading-none">Resum<span className="text-blue-600">meter</span></span>
                 <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase leading-none mt-0.5">Measure your code, Perfect your resume</span>
              </div>
            </div>
            {/* Optional User controls */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stepper (Only show if not in upload mode or keep visible for context? kept visible) */}
        <Stepper currentStep={currentStep} />

        <div className="mt-8">
          {currentStep === AppStep.UPLOAD && (
            <UploadStep 
              data={userData} 
              onChange={handleInputChange} 
              onNext={handleStartAnalysis} 
            />
          )}

          {currentStep === AppStep.ANALYSIS && (
            <AnalysisStep />
          )}

          {currentStep === AppStep.REVIEW && result && (
            <ReviewStep 
              originalData={userData} 
              result={result} 
              onRestart={handleRestart}
            />
          )}
        </div>
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Resummeter. Powered by Google Gemini 3.
        </div>
      </footer>
    </div>
  );
};

export default App;