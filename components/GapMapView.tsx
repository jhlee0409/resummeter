import React from 'react';
import { GapMapItem } from '../types';

interface GapMapViewProps {
  gapMap: GapMapItem[];
  onActionClick?: (actionId: string) => void;
}

const categoryLabels: Record<string, string> = {
  'hard-skill': '기술 스택',
  'soft-skill': '소프트 스킬',
  'experience': '경험',
  'education': '학력',
};

const levelConfig = {
  strong: { icon: '✅', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', label: '충족' },
  weak: { icon: '⚠️', bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', label: '부분 충족' },
  missing: { icon: '❌', bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', label: '미충족' },
};

export const GapMapView: React.FC<GapMapViewProps> = ({ gapMap, onActionClick }) => {
  const grouped = gapMap.reduce((acc, item) => {
    const cat = item.category || 'hard-skill';
    (acc[cat] ??= []).push(item);
    return acc;
  }, {} as Record<string, GapMapItem[]>);

  const categories = Object.entries(grouped);

  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
        Gap 분석 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map(([category, items]) => (
        <div key={category}>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            {categoryLabels[category] || category}
          </h4>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const config = levelConfig[item.currentLevel] || levelConfig.missing;
              return (
                <div
                  key={idx}
                  className={`${config.bg} border ${config.border} rounded-xl px-4 py-3 transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 shrink-0">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-[13px] font-semibold ${config.text}`}>{item.requirement}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${config.bg} ${config.text} border ${config.border}`}>
                          {config.label}
                        </span>
                      </div>
                      {item.suggestion && (
                        <p className="text-[12px] text-zinc-400 leading-relaxed">{item.suggestion}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-zinc-600">JD 언급 {item.jdMentions}회</span>
                        <span className="text-[10px] text-zinc-600">이력서 언급 {item.resumeMentions}회</span>
                      </div>
                      {item.currentLevel !== 'strong' && item.relatedActions.length > 0 && onActionClick && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.relatedActions.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => onActionClick(item.requirement)}
                              className="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded-full hover:bg-brand-500/20 transition-colors font-medium"
                            >
                              관련 액션 →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
