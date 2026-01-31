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
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([editedResume], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = "optimized-resume.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedResume);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const diffElements = useMemo(() => {
    if (activeTab !== 'diff') return null;
    const diff = Diff.diffWords(originalData.resumeText, editedResume);
    return diff.map((part, index) => {
      if (part.added) {
        return (
          <span key={index} className="bg-emerald-100 text-emerald-800 font-medium px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      if (part.removed) {
        return (
          <span key={index} className="bg-red-100 text-red-400 line-through opacity-50 px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      return (
        <span key={index} className="text-slate-500">
          {part.value}
        </span>
      );
    });
  }, [activeTab, originalData.resumeText, editedResume]);

  const origWordCount = originalData.resumeText.split(/\s+/).filter(Boolean).length;
  const newWordCount = editedResume.split(/\s+/).filter(Boolean).length;
  const insightCount = result.insights.length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">최적화 완료</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">결과를 검토하고 필요한 부분을 수정하세요</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-50 rounded-lg">
            <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-[11px] font-bold text-brand-600">{insightCount}개 인사이트</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-100 rounded-lg">
            <span className="text-[11px] text-slate-500 section-num">{origWordCount}</span>
            <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-[11px] font-semibold text-slate-700 section-num">{newWordCount}단어</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Original */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm h-[600px] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">기존 이력서</h3>
            </div>
            <div className="flex-1 overflow-y-auto text-[12px] text-slate-500 font-mono whitespace-pre-wrap p-4 custom-scrollbar leading-relaxed">
              {originalData.resumeText}
            </div>
          </div>
        </div>

        {/* Center: Editor */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-brand-100 shadow-lg shadow-brand-500/5 overflow-hidden flex flex-col h-[600px]">
            <div className="px-4 py-3 border-b border-brand-100 bg-brand-50/40 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/20">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-[13px] font-bold text-brand-800">AI 최적화 이력서</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-brand-100/60 rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${activeTab === 'preview' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}
                  >
                    에디터
                  </button>
                  <button
                    onClick={() => setActiveTab('diff')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${activeTab === 'diff' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}
                  >
                    변경사항
                  </button>
                </div>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <textarea
                className="flex-1 w-full p-5 text-sm text-slate-800 leading-relaxed resize-none focus:outline-none bg-white custom-scrollbar"
                value={editedResume}
                onChange={(e) => setEditedResume(e.target.value)}
              />
            ) : (
              <div className="flex-1 w-full p-5 text-sm leading-relaxed overflow-y-auto bg-surface-50 custom-scrollbar whitespace-pre-wrap font-mono">
                {diffElements}
              </div>
            )}

            <div className="px-4 py-3 border-t border-brand-100 bg-brand-50/30 flex items-center justify-between">
              <button
                onClick={onRestart}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                처음부터 다시
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      복사됨
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      복사
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3.5 py-2 text-[11px] font-bold text-white bg-gradient-to-r from-brand-500 to-brand-600 rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all shadow-sm shadow-brand-500/20 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  다운로드
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Insights */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm h-[600px] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI 인사이트</h3>
              <span className="ml-auto text-[10px] font-bold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full section-num">{insightCount}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {result.insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} index={idx} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
