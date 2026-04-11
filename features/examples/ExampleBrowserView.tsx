import React, { useState } from 'react';
import { resumeExamples, exampleIndustries, type ResumeExample } from '../../data/examples';
import { track } from '../../services/analytics';

export const ExampleBrowserView: React.FC = () => {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = selectedIndustry
    ? resumeExamples.filter(e => e.industry === selectedIndustry)
    : resumeExamples;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-zinc-300">업종별 합격 사례 분석</h3>
        <span className="text-[10px] text-zinc-600">{filtered.length}건</span>
      </div>

      {/* Industry Filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setSelectedIndustry(null)}
          className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all ${
            !selectedIndustry
              ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/[0.03]'
          }`}
        >
          전체
        </button>
        {exampleIndustries.map(ind => (
          <button
            key={ind}
            onClick={() => setSelectedIndustry(ind)}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all ${
              selectedIndustry === ind
                ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/[0.03]'
            }`}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* Example Cards */}
      <div className="space-y-3">
        {filtered.map(example => (
          <ExampleCard
            key={example.id}
            example={example}
            expanded={expandedId === example.id}
            onToggle={() => {
              const opening = expandedId !== example.id;
              if (opening) track({ type: 'example_view', exampleId: example.id, industry: example.industry });
              setExpandedId(opening ? example.id : null);
            }}
          />
        ))}
      </div>
    </div>
  );
};

const ExampleCard: React.FC<{
  example: ResumeExample;
  expanded: boolean;
  onToggle: () => void;
}> = ({ example, expanded, onToggle }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(example.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              {example.industry}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              {example.position}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              example.level === 'junior' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
            }`}>
              {example.level === 'junior' ? '신입' : '경력'}
            </span>
            <span className="text-[10px] text-zinc-600">{example.section}</span>
          </div>
          <p className="text-[12px] font-semibold text-zinc-200">{example.title}</p>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Content */}
          <div className="relative">
            <div className="bg-dark-800/50 rounded-lg p-3 text-[12px] text-zinc-300 leading-relaxed">
              {example.content}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded bg-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          {/* Analysis */}
          <div className="space-y-2.5">
            {/* Pattern */}
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-amber-400 shrink-0 mt-0.5">패턴</span>
              <span className="text-[11px] text-zinc-400">{example.analysis.pattern}</span>
            </div>

            {/* Strengths */}
            <div>
              <span className="text-[10px] font-bold text-emerald-400 mb-1 block">강점 분석</span>
              <div className="flex flex-wrap gap-1.5">
                {example.analysis.strengths.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <span className="text-[10px] font-bold text-brand-400 mb-1 block">핵심 키워드</span>
              <div className="flex flex-wrap gap-1.5">
                {example.analysis.keywords.map((k, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExampleBrowserView;
