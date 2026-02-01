import React, { useMemo } from 'react';
import { CoachingResult, UserInputData } from '../types';

interface ScoreDashboardProps {
  result: CoachingResult;
  originalData: UserInputData;
  editedResume: string;
}

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ result, originalData, editedResume }) => {
  const scoreConfig = useMemo(() => {
    if (result.matchScore >= 75) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '우수' };
    if (result.matchScore >= 50) return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: '보통' };
    return { bg: 'bg-red-500/10', text: 'text-red-400', label: '개선 필요' };
  }, [result.matchScore]);

  const strongCount = result.gapMap.filter(g => g.currentLevel === 'strong').length;
  const weakCount = result.gapMap.filter(g => g.currentLevel === 'weak').length;
  const missingCount = result.gapMap.filter(g => g.currentLevel === 'missing').length;
  const origWordCount = originalData.resumeText.split(/\s+/).filter(Boolean).length;
  const newWordCount = editedResume.split(/\s+/).filter(Boolean).length;
  const insightCount = result.insights.length;
  const actionCount = result.actionItems?.length ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      {/* Match Score */}
      <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl ${scoreConfig.bg} flex items-center justify-center`}>
          <span className={`text-2xl font-black ${scoreConfig.text} section-num`}>{result.matchScore}</span>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 font-medium">JD 매칭 점수</p>
          <p className={`text-sm font-bold ${scoreConfig.text}`}>{scoreConfig.label}</p>
        </div>
      </div>

      {/* Gap Summary */}
      <div className="glass-card p-5 rounded-2xl">
        <p className="text-[11px] text-zinc-500 font-medium mb-2.5">요구사항 분석</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-zinc-300 section-num">{strongCount}</span>
            <span className="text-[10px] text-zinc-600">충족</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold text-zinc-300 section-num">{weakCount}</span>
            <span className="text-[10px] text-zinc-600">부분</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-zinc-300 section-num">{missingCount}</span>
            <span className="text-[10px] text-zinc-600">미충족</span>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="glass-card p-5 rounded-2xl">
        <p className="text-[11px] text-zinc-500 font-medium">코칭 제안</p>
        <p className="text-sm font-bold text-brand-400">{actionCount}개 액션 아이템</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{insightCount}개 인사이트</p>
      </div>

      {/* Word Count */}
      <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-[11px] text-zinc-500 font-medium">글자수 변화</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-800/50 rounded-lg">
          <span className="text-[11px] text-zinc-500 section-num">{origWordCount}</span>
          <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-[11px] font-semibold text-zinc-300 section-num">{newWordCount}단어</span>
        </div>
      </div>
    </div>
  );
};
