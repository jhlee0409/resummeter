import React, { useState } from 'react';
import { ActionItem } from '../types';

interface ActionItemCardProps {
  item: ActionItem;
  accepted: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}

const priorityConfig = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '필수' },
  high: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '중요' },
  medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: '권장' },
  low: { bg: 'bg-zinc-800/50', text: 'text-zinc-500', border: 'border-zinc-700', label: '선택' },
};

const categoryLabels: Record<string, string> = {
  'keyword-gap': '키워드 보완',
  'quantify': '수치 추가',
  'reframe': '표현 개선',
  'add-missing': '항목 추가',
  'remove': '항목 제거',
};

const evidenceTypeLabels: Record<string, { label: string; bg: string; text: string }> = {
  'jd': { label: 'JD 근거', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  'github': { label: 'GitHub 근거', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  'best-practice': { label: 'Best Practice', bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

export const ActionItemCard: React.FC<ActionItemCardProps> = ({ item, accepted, onToggle, highlighted }) => {
  const [expanded, setExpanded] = useState(false);
  const pConfig = priorityConfig[item.priority] || priorityConfig.medium;

  return (
    <div
      id={`action-${item.id}`}
      className={`glass-card rounded-xl transition-all duration-200 overflow-hidden ${
        accepted ? 'border-emerald-500/20 bg-emerald-500/5' : highlighted ? 'border-brand-500/30 bg-brand-500/5 ring-1 ring-brand-500/20' : ''
      }`}
    >
      <div className="px-4 py-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${pConfig.bg} ${pConfig.text} border ${pConfig.border}`}>
              {pConfig.label}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/50 text-zinc-500 font-medium">
              {categoryLabels[item.category] || item.category}
            </span>
            <span className="text-[10px] text-zinc-600">{item.targetSection}</span>
          </div>
          <button
            onClick={onToggle}
            className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              accepted
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-zinc-600 hover:border-brand-400'
            }`}
          >
            {accepted && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Suggestion */}
        <p className="text-[13px] font-semibold text-zinc-300 leading-snug mb-2">{item.suggestion}</p>

        {/* Before/After toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1 transition-colors"
        >
          {expanded ? '접기' : '상세 보기 (원문 → 수정안)'}
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 animate-fade-in">
            {/* Before */}
            <div className="bg-red-500/5 rounded-lg px-3 py-2.5 border border-red-500/15">
              <p className="text-[10px] font-semibold text-red-400/70 mb-1">원문 (Before)</p>
              <p className="text-[12px] text-zinc-400 leading-relaxed font-mono">{item.before}</p>
            </div>

            {/* After */}
            {item.after && (
              <div className="bg-emerald-500/5 rounded-lg px-3 py-2.5 border border-emerald-500/15">
                <p className="text-[10px] font-semibold text-emerald-400/70 mb-1">수정안 (After)</p>
                <p className="text-[12px] text-zinc-400 leading-relaxed font-mono">{item.after}</p>
              </div>
            )}

            {/* Evidence */}
            {item.evidence.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-zinc-600">근거</p>
                {item.evidence.map((ev, i) => {
                  const evConfig = evidenceTypeLabels[ev.type] || evidenceTypeLabels['best-practice'];
                  return (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${evConfig.bg} ${evConfig.text}`}>
                        {evConfig.label}
                      </span>
                      <span className="text-zinc-500 leading-relaxed">{ev.content}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
