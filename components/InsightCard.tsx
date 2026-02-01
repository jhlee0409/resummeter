import React, { useState } from 'react';
import { Insight } from '../types';

function getSourceColor(source: string): { bg: string; text: string; dot: string } {
  if (source.includes('README')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (source.includes('Issue') || source.includes('#')) return { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' };
  if (source.includes('PR')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' };
  return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' };
}

const confidenceConfig = {
  verified: { label: '검증됨', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  analyzed: { label: '분석됨', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  inferred: { label: '추론됨', bg: 'bg-zinc-800/50', text: 'text-zinc-500' },
} as const;

const categoryLabels: Record<string, string> = {
  'documentation': '문서화',
  'problem-solving': '문제해결',
  'collaboration': '협업',
  'technical': '기술역량',
  'soft-skill': '소프트스킬',
};

export const InsightCard: React.FC<{ insight: Insight; index?: number }> = ({ insight, index = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getSourceColor(insight.source);
  const badge = confidenceConfig[insight.confidence] || confidenceConfig.inferred;

  return (
    <div
      className="group glass-card rounded-xl transition-all duration-200 cursor-pointer overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          <span className={`text-[10px] font-semibold ${colors.text} truncate`}>
            {insight.source}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          {insight.category && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/50 text-zinc-500 font-medium">
              {categoryLabels[insight.category] || insight.category}
            </span>
          )}
        </div>

        <h4 className="font-semibold text-zinc-300 text-[12px] leading-snug group-hover:text-brand-400 transition-colors">
          {insight.observation}
        </h4>

        <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-48 mt-2' : 'max-h-0'}`}>
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <p className="text-[11px] text-zinc-500 leading-relaxed">{insight.impact}</p>
            {insight.recommendation && (
              <div className="bg-brand-500/10 rounded-lg px-2.5 py-2">
                <p className="text-[10px] font-medium text-brand-400 mb-0.5">💡 이력서 반영 제안</p>
                <p className="text-[11px] text-brand-300 leading-relaxed">{insight.recommendation}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end mt-1.5">
          <svg
            className={`w-3 h-3 text-zinc-600 group-hover:text-brand-400 transition-all duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
