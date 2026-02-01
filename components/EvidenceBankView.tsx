import React from 'react';
import { EvidenceBank } from '../types';

interface EvidenceBankViewProps {
  evidenceBank?: EvidenceBank;
}

const evidenceTypeConfig: Record<string, { label: string; bg: string; text: string }> = {
  'jd': { label: 'JD', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  'github': { label: 'GitHub', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  'best-practice': { label: 'Best Practice', bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

export const EvidenceBankView: React.FC<EvidenceBankViewProps> = ({ evidenceBank }) => {
  if (!evidenceBank || (evidenceBank.repos.length === 0 && evidenceBank.highlights.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-zinc-500">GitHub 데이터가 없습니다</p>
        <p className="text-[12px] text-zinc-600 mt-1">GitHub 레포를 추가하면 JD 연관 근거를 자동 매칭합니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Repos */}
      {evidenceBank.repos.map((repo, idx) => (
        <div key={idx} className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <h4 className="text-[13px] font-bold text-zinc-300">{repo.name}</h4>
              {repo.url && (
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand-400 hover:text-brand-300 font-medium"
                >
                  보기 →
                </a>
              )}
            </div>
            {repo.relevantTo.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {repo.relevantTo.map((req, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">
                    {req}
                  </span>
                ))}
              </div>
            )}
          </div>
          {repo.evidences.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              {repo.evidences.map((ev, i) => {
                const config = evidenceTypeConfig[ev.type] || evidenceTypeConfig['github'];
                return (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-zinc-400 leading-relaxed">{ev.content}</p>
                      {ev.source && <p className="text-[10px] text-zinc-600 mt-0.5">{ev.source}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Highlights */}
      {evidenceBank.highlights.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-3">주요 하이라이트</h4>
          <div className="space-y-2">
            {evidenceBank.highlights.map((ev, i) => {
              const config = evidenceTypeConfig[ev.type] || evidenceTypeConfig['github'];
              return (
                <div key={i} className="glass-card rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                  <p className="text-[12px] text-zinc-400 leading-relaxed">{ev.content}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tech Stack */}
      {Object.keys(evidenceBank.techStack).length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-3">기술 스택</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(evidenceBank.techStack).map(([tech, repos]) => (
              <div key={tech} className="bg-dark-800/50 rounded-lg px-3 py-1.5 border border-zinc-700/30">
                <span className="text-[12px] font-semibold text-zinc-300">{tech}</span>
                <span className="text-[10px] text-zinc-600 ml-1.5">({repos.join(', ')})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
