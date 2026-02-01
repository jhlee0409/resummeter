import React, { useState, useMemo } from 'react';
import { CoachingResult, UserInputData, TailoredInstructionWithRequirements, NarrativeFramework, NarrativeSectionSpec, NarrativeGenerationResult } from '../types';
import { InsightCard } from './InsightCard';
import { ScoreDashboard } from './ScoreDashboard';
import { GapMapView } from './GapMapView';
import { ActionItemCard } from './ActionItemCard';
import { EvidenceBankView } from './EvidenceBankView';
import { NarrativeConfigPanel } from './NarrativeConfigPanel';
import { NarrativeSectionView } from './NarrativeSectionView';
import { generateNarrativeSections } from '../services/geminiService';
import * as Diff from 'diff';
import { marked } from 'marked';

interface ReviewStepProps {
  originalData: UserInputData;
  result: CoachingResult;
  instruction: TailoredInstructionWithRequirements;
  onRestart: () => void;
}

type ReviewTab = 'gap-map' | 'actions' | 'evidence' | 'resume' | 'narrative';

export const ReviewStep: React.FC<ReviewStepProps> = ({ originalData, result, instruction, onRestart }) => {
  const [activeTab, setActiveTab] = useState<ReviewTab>('gap-map');
  const [editedResume, setEditedResume] = useState(result.optimizedResume);
  const [resumeSubTab, setResumeSubTab] = useState<'editor' | 'preview' | 'diff'>('editor');
  const [copied, setCopied] = useState(false);
  const [acceptedActions, setAcceptedActions] = useState<Set<string>>(new Set());
  const [highlightedGap, setHighlightedGap] = useState<string | null>(null);

  // Narrative state
  const [narrativeFramework, setNarrativeFramework] = useState<NarrativeFramework>('k-star-k');
  const [narrativeSpecs, setNarrativeSpecs] = useState<NarrativeSectionSpec[]>([]);
  const [narrativeResult, setNarrativeResult] = useState<NarrativeGenerationResult | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeProgress, setNarrativeProgress] = useState<{ completed: number; total: number } | undefined>();

  const handleFrameworkChange = (fw: NarrativeFramework) => {
    setNarrativeFramework(fw);
    setNarrativeSpecs([]);
    setNarrativeResult(null);
  };

  const handleGenerateNarrative = async () => {
    setIsGeneratingNarrative(true);
    try {
      const narrativeGenResult = await generateNarrativeSections(
        narrativeSpecs, instruction, originalData.resumeText,
        originalData.jobDescription, originalData.githubRepos,
        originalData.githubData, result,
        (completed, total) => setNarrativeProgress({ completed, total })
      );
      setNarrativeResult(narrativeGenResult);
    } finally {
      setIsGeneratingNarrative(false);
      setNarrativeProgress(undefined);
    }
  };

  const toggleAction = (actionId: string) => {
    setAcceptedActions(prev => {
      const next = new Set(prev);
      next.has(actionId) ? next.delete(actionId) : next.add(actionId);
      return next;
    });
  };

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
    if (activeTab !== 'resume' || resumeSubTab !== 'diff') return null;
    const diff = Diff.diffWords(originalData.resumeText, editedResume);
    return diff.map((part, index) => {
      if (part.added) {
        return (
          <span key={index} className="bg-emerald-500/15 text-emerald-400 font-medium px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      if (part.removed) {
        return (
          <span key={index} className="bg-red-500/15 text-red-400 line-through opacity-50 px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      return (
        <span key={index} className="text-zinc-500">
          {part.value}
        </span>
      );
    });
  }, [activeTab, resumeSubTab, originalData.resumeText, editedResume]);

  const sortedActionItems = useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...(result.actionItems || [])].sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
  }, [result.actionItems]);

  const handleActionClick = (requirement: string) => {
    setHighlightedGap(requirement);
    setActiveTab('actions');
  };

  const isActionHighlighted = (item: typeof result.actionItems[number]) => {
    if (!highlightedGap) return false;
    const gap = highlightedGap.toLowerCase();
    return (
      item.targetSection.toLowerCase().includes(gap) ||
      item.suggestion.toLowerCase().includes(gap) ||
      item.before.toLowerCase().includes(gap) ||
      item.evidence.some(e => e.content.toLowerCase().includes(gap))
    );
  };

  const tabs: Array<{ key: ReviewTab; label: string; icon: string }> = [
    { key: 'gap-map', label: 'Gap Map', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { key: 'actions', label: '코칭 제안', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { key: 'evidence', label: 'GitHub 근거', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { key: 'resume', label: '이력서', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'narrative' as ReviewTab, label: '서술형', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* Summary */}
      {result.summary && (
        <div className="glass-card border-brand-500/20 rounded-2xl px-5 py-4">
          <p className="text-[13px] text-brand-300 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Score Dashboard */}
      <ScoreDashboard result={result} originalData={originalData} editedResume={editedResume} />

      {/* Tab Bar */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'actions') setHighlightedGap(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold transition-all ${
                activeTab === tab.key
                  ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Gap Map Tab */}
          {activeTab === 'gap-map' && (
            <GapMapView gapMap={result.gapMap} onActionClick={handleActionClick} />
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Quick Wins */}
              {result.quickWins.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-[13px] font-bold text-zinc-300">빠른 개선 포인트</h3>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {result.quickWins.map((win, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-zinc-400 leading-relaxed">
                        <span className="text-amber-400 mt-0.5 shrink-0">&#9679;</span>
                        {win}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-zinc-300">코칭 액션 아이템</h3>
                  <span className="text-[10px] text-zinc-600">
                    {acceptedActions.size}/{sortedActionItems.length} 적용
                  </span>
                </div>
                <div className="space-y-3">
                  {sortedActionItems.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      item={item}
                      accepted={acceptedActions.has(item.id)}
                      onToggle={() => toggleAction(item.id)}
                      highlighted={isActionHighlighted(item)}
                    />
                  ))}
                </div>
              </div>

              {/* Insights */}
              {result.insights.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-300 mb-3">보조 인사이트</h3>
                  <div className="space-y-2">
                    {result.insights.map((insight, idx) => (
                      <InsightCard key={idx} insight={insight} index={idx} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evidence Tab */}
          {activeTab === 'evidence' && (
            <EvidenceBankView evidenceBank={result.evidenceBank} />
          )}

          {/* Narrative Tab */}
          {activeTab === 'narrative' && (
            <div className="space-y-4">
              {narrativeResult ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-zinc-300">생성된 서술형 항목</h3>
                    <button
                      onClick={() => setNarrativeResult(null)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      다시 설정
                    </button>
                  </div>
                  <NarrativeSectionView sections={narrativeResult.sections} />
                </div>
              ) : (
                <NarrativeConfigPanel
                  specs={narrativeSpecs}
                  framework={narrativeFramework}
                  onFrameworkChange={handleFrameworkChange}
                  onChange={setNarrativeSpecs}
                  onGenerate={handleGenerateNarrative}
                  isGenerating={isGeneratingNarrative}
                  progress={narrativeProgress}
                />
              )}
            </div>
          )}

          {/* Resume Tab */}
          {activeTab === 'resume' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Original */}
              <div className="lg:col-span-3 hidden lg:block">
                <div className="glass-card rounded-xl h-[500px] flex flex-col overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">원본</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto text-[12px] text-zinc-500 font-mono whitespace-pre-wrap p-3 custom-scrollbar leading-relaxed">
                    {originalData.resumeText}
                  </div>
                </div>
              </div>

              {/* Center: Editor */}
              <div className="lg:col-span-9">
                <div className="glass-card rounded-xl border-brand-500/20 overflow-hidden flex flex-col h-[500px]">
                  <div className="px-4 py-2.5 border-b border-brand-500/15 bg-brand-500/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="text-[12px] font-bold text-brand-300">코칭 적용 이력서</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-brand-500/10 rounded-lg p-0.5">
                        {(['editor', 'preview', 'diff'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setResumeSubTab(tab)}
                            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${resumeSubTab === tab ? 'bg-dark-700 text-brand-300 shadow-sm' : 'text-brand-500/50 hover:text-brand-400'}`}
                          >
                            {{ editor: '에디터', preview: '프리뷰', diff: '변경사항' }[tab]}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 bg-dark-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-all flex items-center gap-1"
                      >
                        {copied ? '복사됨 ✓' : '복사'}
                      </button>
                    </div>
                  </div>

                  {resumeSubTab === 'editor' ? (
                    <textarea
                      className="flex-1 w-full p-4 text-sm text-zinc-200 leading-relaxed resize-none focus:outline-none bg-transparent custom-scrollbar"
                      value={editedResume}
                      onChange={(e) => setEditedResume(e.target.value)}
                    />
                  ) : resumeSubTab === 'preview' ? (
                    <div
                      className="flex-1 w-full p-4 text-sm leading-relaxed overflow-y-auto bg-transparent custom-scrollbar md-preview"
                      dangerouslySetInnerHTML={{ __html: marked(editedResume) as string }}
                    />
                  ) : (
                    <div className="flex-1 w-full p-4 text-sm leading-relaxed overflow-y-auto bg-dark-800/50 custom-scrollbar whitespace-pre-wrap font-mono">
                      {diffElements}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRestart}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 font-medium flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          처음부터 다시
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 text-[11px] font-bold text-white bg-gradient-to-r from-brand-500 to-brand-600 rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all shadow-md shadow-brand-500/30 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Markdown 다운로드
        </button>
      </div>
    </div>
  );
};
