import React, { useMemo, useState } from 'react';
import { listCachedAnalyses, deleteCachedAnalysis } from './services/analysisCache';

interface Props {
  onLoad: (cacheKey: string) => void;
}

export const PreviousAnalysesPanel: React.FC<Props> = ({ onLoad }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => listCachedAnalyses(), [refreshKey]);

  if (items.length === 0) return null;

  const handleDelete = (e: React.MouseEvent, cacheKey: string) => {
    e.stopPropagation();
    deleteCachedAnalysis(cacheKey);
    setRefreshKey(k => k + 1);
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-[13px] font-bold text-zinc-200">이전 분석 결과 <span className="text-[10px] font-normal text-zinc-500 ml-1">{items.length}건</span></h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">재입력 없이 바로 불러올 수 있습니다</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
          {items.map(item => (
            <button
              key={item.cacheKey}
              onClick={() => onLoad(item.cacheKey)}
              className="w-full px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors text-left group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`text-[13px] font-bold section-num ${scoreColor(item.matchScore)} shrink-0 w-8 text-right`}>{item.matchScore}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-zinc-300 truncate">
                    {item.companyName ?? '회사 정보 없음'}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {new Date(item.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">불러오기</span>
                <button
                  onClick={e => handleDelete(e, item.cacheKey)}
                  className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="삭제"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />
                  </svg>
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
