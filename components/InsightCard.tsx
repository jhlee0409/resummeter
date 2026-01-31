import React, { useState } from 'react';
import { Insight } from '../types';

function getSourceColor(source: string): { bg: string; text: string; dot: string } {
  if (source.includes('README')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' };
  if (source.includes('Issue') || source.includes('#')) return { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' };
  if (source.includes('PR')) return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' };
  return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' };
}

export const InsightCard: React.FC<{ insight: Insight; index?: number }> = ({ insight, index = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getSourceColor(insight.fileOrCommit);

  return (
    <div
      className="group bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all duration-200 cursor-pointer overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          <span className={`text-[10px] font-semibold ${colors.text} truncate`}>
            {insight.fileOrCommit}
          </span>
        </div>

        <h4 className="font-semibold text-slate-700 text-[12px] leading-snug group-hover:text-brand-600 transition-colors">
          {insight.observation}
        </h4>

        <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-32 mt-2' : 'max-h-0'}`}>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed">{insight.impact}</p>
          </div>
        </div>

        <div className="flex items-center justify-end mt-1.5">
          <svg
            className={`w-3 h-3 text-slate-300 group-hover:text-brand-400 transition-all duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
