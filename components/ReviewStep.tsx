import React, { useState, useMemo } from 'react';
import { OptimizationResult, UserInputData } from '../types';
import { InsightCard } from './InsightCard';
import * as Diff from 'diff';

interface ReviewStepProps {
  originalData: UserInputData;
  result: OptimizationResult;
  onRestart: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ originalData, result, onRestart }) => {
  const [editedResume, setEditedResume] = useState(result.optimizedResume);
  const [activeTab, setActiveTab] = useState<'preview' | 'diff'>('preview');

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([editedResume], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = "optimized-resume.md";
    document.body.appendChild(element);
    element.click();
  };

  // Memoize diff calculation to avoid re-running on every render unless content changes
  const diffElements = useMemo(() => {
    if (activeTab !== 'diff') return null;
    
    // We compare the original text with the currently edited text
    const diff = Diff.diffWords(originalData.resumeText, editedResume);
    
    return diff.map((part, index) => {
      // Style determination
      let className = "text-slate-500";
      if (part.added) {
        className = "bg-green-100 text-green-800 font-semibold px-0.5 rounded";
      } else if (part.removed) {
        className = "bg-red-100 text-red-500 line-through decoration-red-400 opacity-70 px-0.5 rounded mx-0.5";
      }

      return (
        <span key={index} className={className}>
          {part.value}
        </span>
      );
    });
  }, [activeTab, originalData.resumeText, editedResume]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full pb-10">
      
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
           <h2 className="text-xl font-bold text-slate-800">최적화 완료</h2>
           <p className="text-sm text-slate-500">결과를 검토하고 새로운 이력서를 다운로드하세요.</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button onClick={onRestart} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
            처음으로
          </button>
          <button 
            onClick={handleDownload}
            className="px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            마크다운 다운로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Original Resume (Read-only) */}
        <div className="lg:col-span-3 hidden lg:block space-y-4">
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-[600px] flex flex-col">
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">기존 이력서 (참고용)</h3>
             <div className="flex-1 overflow-y-auto text-xs text-slate-600 font-mono whitespace-pre-wrap p-2 bg-white rounded border border-slate-200 custom-scrollbar">
                {originalData.resumeText}
             </div>
           </div>
        </div>

        {/* Center Col: Optimized Resume (Editable & Diff) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden flex flex-col h-[600px]">
            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
               <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                 <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 AI 최적화 이력서
               </h3>
               <div className="flex bg-blue-100 rounded-lg p-0.5">
                 <button 
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'preview' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-600 hover:text-blue-800'}`}
                 >
                    에디터
                 </button>
                 <button 
                    onClick={() => setActiveTab('diff')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'diff' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-600 hover:text-blue-800'}`}
                 >
                    변경사항 비교
                 </button>
               </div>
            </div>
            
            {activeTab === 'preview' ? (
              <textarea 
                className="flex-1 w-full p-6 text-sm text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500/20 font-serif bg-white custom-scrollbar"
                value={editedResume}
                onChange={(e) => setEditedResume(e.target.value)}
              />
            ) : (
              <div className="flex-1 w-full p-6 text-sm leading-relaxed overflow-y-auto bg-slate-50 custom-scrollbar whitespace-pre-wrap font-mono">
                {diffElements}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: AI Insights */}
        <div className="lg:col-span-3 space-y-4">
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-[600px] flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                AI 분석 통찰 & 근거
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {result.insights.map((insight, idx) => (
                   <InsightCard key={idx} insight={insight} />
                ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};