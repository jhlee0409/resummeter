import React, { useState } from 'react';
import { toast } from 'sonner';
import { NarrativeSectionResult, NarrativeSectionSpec } from '../types';

interface NarrativeSectionViewProps {
  sections: NarrativeSectionResult[];
  specs?: NarrativeSectionSpec[];
  onInsertToResume?: (title: string, content: string) => void;
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  'self-introduction': '자기소개',
  'career-project': '경력사항/프로젝트 경험',
  'technical-skills': '보유기술 및 핵심역량',
  'motivation': '지원동기',
  'growth-plan': '성장계획/입사 후 포부',
  'custom': '기타 (직접입력)',
};

const frameworkConfig = {
  'k-star-k': { label: 'K-STAR-K', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'tech-narrative': { label: 'Tech Narrative', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

const kStarKLabels = {
  conclusion: { label: 'K(결론)', color: 'text-blue-400' },
  situation: { label: 'S(상황)', color: 'text-purple-400' },
  task: { label: 'T(과제)', color: 'text-amber-400' },
  action: { label: 'A(행동)', color: 'text-emerald-400' },
  result: { label: 'R(결과)', color: 'text-cyan-400' },
  potential: { label: 'K(가능성)', color: 'text-blue-400' },
};

const techNarrativeLabels = {
  problemDefinition: { label: '문제 정의', color: 'text-red-400' },
  technicalApproach: { label: '기술적 접근', color: 'text-amber-400' },
  implementation: { label: '구현', color: 'text-emerald-400' },
  impact: { label: '임팩트', color: 'text-cyan-400' },
};

export const NarrativeSectionView: React.FC<NarrativeSectionViewProps> = ({ sections, specs, onInsertToResume }) => {
  const handleCopyAll = async () => {
    const allText = sections
      .filter(s => s.status === 'success')
      .map(s => `=== ${s.title} ===\n\n${s.content}`)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(allText);
      toast.success('복사되었습니다');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Copy All Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">생성된 서술형 답변</h3>
        <button
          onClick={handleCopyAll}
          className="px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 transition-all text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          전체 복사
        </button>
      </div>

      {/* Section Cards */}
      <div className="space-y-4">
        {sections.map((section) => (
          <NarrativeSectionCard
            key={section.specId}
            section={section}
            spec={specs?.find(s => s.id === section.specId)}
            onInsertToResume={onInsertToResume}
          />
        ))}
      </div>
    </div>
  );
};

const NarrativeSectionCard: React.FC<{ section: NarrativeSectionResult; spec?: NarrativeSectionSpec; onInsertToResume?: (title: string, content: string) => void }> = ({ section, spec, onInsertToResume }) => {
  const [expanded, setExpanded] = useState(true);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [editedContent, setEditedContent] = useState(section.content);
  const [currentCharCount, setCurrentCharCount] = useState(section.charCount);
  const fConfig = frameworkConfig[section.framework];
  const isOverLimit = currentCharCount > section.charLimit;

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    setCurrentCharCount(newContent.length);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedContent);
      toast.success('복사되었습니다');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden transition-all duration-200 ${
        section.status === 'error' ? 'border-red-500/30 bg-red-500/5' : ''
      }`}
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-lg font-bold text-white">{section.title}</h4>
              <span className={`text-[9px] px-2 py-1 rounded-full font-semibold ${fConfig.bg} ${fConfig.text} border ${fConfig.border}`}>
                {fConfig.label}
              </span>
              <span
                className={`text-[9px] px-2 py-1 rounded-full font-semibold ${
                  isOverLimit
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {currentCharCount} / {section.charLimit}자
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {section.status === 'success' && onInsertToResume && (
              <button
                onClick={() => onInsertToResume(section.title, editedContent)}
                className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 hover:text-brand-300 transition-all text-xs font-medium flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                이력서에 삽입
              </button>
            )}
            {section.status === 'success' && (
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs font-medium flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                복사
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {section.status === 'error' ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400 font-medium">생성 실패: {section.errorMessage}</p>
            </div>
          ) : (
            <>
              {/* Input Context */}
              {spec && (
                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setInputExpanded(!inputExpanded)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900/30"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      입력 조건
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${inputExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {inputExpanded && (
                    <div className="px-4 py-3 space-y-2 border-t border-white/5 bg-zinc-900/20 animate-fade-in">
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                        <span className="text-zinc-600 font-medium">항목 유형</span>
                        <span className="text-zinc-400">{SECTION_TYPE_LABELS[spec.type] || spec.type}</span>
                        {spec.type === 'custom' && spec.customTitle && (
                          <>
                            <span className="text-zinc-600 font-medium">항목명</span>
                            <span className="text-zinc-400">{spec.customTitle}</span>
                          </>
                        )}
                        <span className="text-zinc-600 font-medium">프레임워크</span>
                        <span className={`${fConfig.text}`}>{fConfig.label}</span>
                        <span className="text-zinc-600 font-medium">글자 수 제한</span>
                        <span className="text-zinc-400">{spec.charLimit}자</span>
                        {spec.prompt && (
                          <>
                            <span className="text-zinc-600 font-medium">방향성 힌트</span>
                            <span className="text-zinc-300">{spec.prompt}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Editable Textarea */}
              <div className="relative">
                <textarea
                  value={editedContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/30 transition-all leading-relaxed"
                  rows={8}
                  spellCheck={false}
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">
                  {currentCharCount}자
                </div>
              </div>

              {/* Breakdown Panel */}
              {(section.kStarKBreakdown || section.techNarrativeBreakdown) && (
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => setBreakdownExpanded(!breakdownExpanded)}
                    className="w-full flex items-center justify-between text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    <span>구조 분석 보기</span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${breakdownExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {breakdownExpanded && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      {section.kStarKBreakdown && (
                        <div className="space-y-2">
                          {(Object.keys(kStarKLabels) as Array<keyof typeof kStarKLabels>).map((key) => {
                            const breakdown = section.kStarKBreakdown!;
                            const label = kStarKLabels[key];
                            const content = breakdown[key];

                            return (
                              <div key={key} className="bg-zinc-900/30 rounded-lg px-3 py-2.5 border border-white/5">
                                <p className={`text-[10px] font-bold mb-1.5 ${label.color}`}>{label.label}</p>
                                <p className="text-xs text-zinc-400 leading-relaxed">{content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {section.techNarrativeBreakdown && (
                        <div className="space-y-2">
                          {(Object.keys(techNarrativeLabels) as Array<keyof typeof techNarrativeLabels>).map((key) => {
                            const breakdown = section.techNarrativeBreakdown!;
                            const label = techNarrativeLabels[key];
                            const content = breakdown[key];

                            return (
                              <div key={key} className="bg-zinc-900/30 rounded-lg px-3 py-2.5 border border-white/5">
                                <p className={`text-[10px] font-bold mb-1.5 ${label.color}`}>{label.label}</p>
                                <p className="text-xs text-zinc-400 leading-relaxed">{content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Keywords Used */}
              {section.keywordsUsed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase">활용된 키워드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {section.keywordsUsed.map((keyword, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidences (이력서/GitHub 근거) */}
              {section.githubEvidences.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase">활용된 근거</p>
                  <div className="space-y-1.5">
                    {section.githubEvidences.map((evidence, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="leading-relaxed">{evidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
