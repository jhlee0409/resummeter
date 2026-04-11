import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { GapMatch, CompanyContext, TailoredInstructionWithRequirements } from '../types';
import { useFeatureStore } from '../stores/featureStore';

interface GapAnalysisViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  companyContext?: CompanyContext | null;
}

const severityConfig = {
  required: { label: '필수', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  preferred: { label: '우대', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  bonus: { label: '가산', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
};

export const GapAnalysisView: React.FC<GapAnalysisViewProps> = ({
  resumeText, jobDescription, instruction, companyContext,
}) => {
  const { result, loading, error } = useFeatureStore(s => s.gapAnalysis);
  const generateGapAnalysis = useFeatureStore(s => s.generateGapAnalysis);
  const isLoading = loading;

  useEffect(() => { if (error) toast.error(error); }, [error]);

  const handleAnalyze = () => {
    generateGapAnalysis(resumeText, jobDescription, instruction, companyContext);
  };

  if (!result) {
    return (
      <div className="text-center py-12 space-y-4">
        {companyContext && companyContext.confidence >= 0.3 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {companyContext.companyName} 정보 반영됨
          </div>
        )}
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg font-semibold hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {isLoading ? '분석 중...' : '역량 갭 분석'}
        </button>
        <p className="text-[11px] text-zinc-600">이력서와 JD를 비교하여 매칭/갭을 정밀 분석합니다</p>
      </div>
    );
  }

  const matched = result.matches.filter(m => m.matched);
  const gaps = result.matches.filter(m => !m.matched);

  return (
    <div className="space-y-5">
      {/* Score Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-brand-400">{result.matchRate}%</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">전체 매칭률</div>
        </div>
        <div className="glass-card rounded-xl px-4 py-3 text-center">
          <div className={`text-2xl font-bold ${result.requiredMatchRate >= 70 ? 'text-emerald-400' : result.requiredMatchRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
            {result.requiredMatchRate}%
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">필수 항목 매칭률</div>
        </div>
      </div>

      {/* Overall Assessment */}
      <div className="glass-card rounded-xl px-4 py-3 border-brand-500/20">
        <p className="text-[12px] text-brand-300 leading-relaxed">{result.overallAssessment}</p>
      </div>

      {/* Matched Items */}
      {matched.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            매칭된 역량 ({matched.length})
          </h4>
          <div className="space-y-2">
            {matched.map((m, i) => <MatchCard key={i} match={m} />)}
          </div>
        </div>
      )}

      {/* Gap Items */}
      {gaps.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-red-400 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            갭 ({gaps.length})
          </h4>
          <div className="space-y-2">
            {gaps.map((m, i) => <MatchCard key={i} match={m} />)}
          </div>
        </div>
      )}

      {/* Missing Evidence */}
      {result.missingEvidence.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-amber-400 mb-2">이력서에 추가하면 좋을 것</h4>
          <ul className="space-y-1.5">
            {result.missingEvidence.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-amber-400 mt-0.5 shrink-0">+</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const MatchCard: React.FC<{ match: GapMatch }> = ({ match }) => {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[match.severity] || severityConfig.bonus;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${match.matched ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-red-500/10 bg-red-500/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${config.bg} ${config.text} border ${config.border}`}>
              {config.label}
            </span>
            <span className="text-[12px] font-medium text-zinc-200">{match.requirement}</span>
          </div>
          {match.evidence && (
            <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">{match.evidence}</p>
          )}
        </div>
        {match.reframeSuggestion && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-brand-400 hover:text-brand-300 shrink-0 font-medium"
          >
            {expanded ? '접기' : '재프레이밍'}
          </button>
        )}
      </div>
      {expanded && match.reframeSuggestion && (
        <div className="mt-2 px-3 py-2 bg-brand-500/5 border border-brand-500/10 rounded-lg animate-fade-in">
          <p className="text-[11px] text-brand-300 leading-relaxed">{match.reframeSuggestion}</p>
        </div>
      )}
    </div>
  );
};

export default GapAnalysisView;
