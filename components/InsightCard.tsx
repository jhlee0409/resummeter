import React from 'react';
import { Insight } from '../types';

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  return (
    <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          출처: {insight.fileOrCommit}
        </span>
      </div>
      <h4 className="font-semibold text-slate-800 text-sm mb-1">{insight.observation}</h4>
      <p className="text-xs text-slate-600 italic">"{insight.impact}"</p>
    </div>
  );
};
