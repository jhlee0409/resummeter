import React, { useState } from 'react';
import { TailoredInstructionWithRequirements, GitHubFetchResult, CareerStatementResult } from '../types';
import { generateCareerStatements } from '../services/careerDocService';

interface CareerStatementViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  githubData?: GitHubFetchResult[];
}

export function CareerStatementView({
  resumeText,
  jobDescription,
  instruction,
  githubData,
}: CareerStatementViewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CareerStatementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateCareerStatements(
        resumeText,
        jobDescription,
        instruction,
        githubData
      );
      setResult(generated);
      // Auto-expand first statement
      if (generated.statements.length > 0) {
        setExpandedIds(new Set([generated.statements[0].id]));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllStatements = () => {
    if (!result) return;
    const allText = result.statements
      .map(s => `## ${s.title}\n\n${s.content}\n\n---`)
      .join('\n\n');
    copyToClipboard(allText);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">경력기술서 생성</h2>
            <p className="text-slate-400">
              STAR 구조 기반 NCS 블라인드 채용 형식 경력기술서를 자동 생성합니다.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? '생성 중...' : '경력기술서 생성'}
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-blue-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>AI가 STAR 구조 기반 경력기술서를 작성하고 있습니다...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            오류: {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* NCS Badge + Copy All */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {result.ncsCompatible && (
                <div className="px-3 py-1 bg-green-900/30 border border-green-500/50 rounded-full text-green-400 text-sm font-medium">
                  NCS 블라인드 채용 형식 준수
                </div>
              )}
              <span className="text-slate-400 text-sm">
                총 {result.statements.length}개 항목
              </span>
            </div>
            <button
              onClick={copyAllStatements}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              전체 복사
            </button>
          </div>

          {/* Statement Cards */}
          {result.statements.map((statement) => {
            const isExpanded = expandedIds.has(statement.id);
            return (
              <div
                key={statement.id}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                {/* Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => toggleExpand(statement.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{statement.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {statement.relatedJdKeywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-900/30 border border-blue-500/30 rounded text-blue-300 text-xs"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(statement.content);
                        }}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                      >
                        복사
                      </button>
                      <svg
                        className={`w-6 h-6 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 bg-slate-900/30">
                    {/* Full Content */}
                    <div className="p-6 border-b border-slate-700/50">
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">전체 내용</h4>
                      <p className="text-white leading-relaxed whitespace-pre-wrap">{statement.content}</p>
                    </div>

                    {/* STAR Breakdown */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-xs font-semibold text-blue-400 mb-1">S - 상황 (Situation)</h5>
                          <p className="text-sm text-slate-300">{statement.starBreakdown.situation}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-semibold text-green-400 mb-1">T - 과제 (Task)</h5>
                          <p className="text-sm text-slate-300">{statement.starBreakdown.task}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-xs font-semibold text-purple-400 mb-1">A - 행동 (Action)</h5>
                          <p className="text-sm text-slate-300">{statement.starBreakdown.action}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-semibold text-orange-400 mb-1">R - 결과 (Result)</h5>
                          <p className="text-sm text-slate-300">{statement.starBreakdown.result}</p>
                        </div>
                      </div>
                    </div>

                    {/* Quantified Results */}
                    {statement.quantifiedResults.length > 0 && (
                      <div className="p-6 border-t border-slate-700/50 bg-gradient-to-br from-orange-900/10 to-red-900/10">
                        <h4 className="text-sm font-semibold text-orange-400 mb-3">정량적 성과</h4>
                        <ul className="space-y-2">
                          {statement.quantifiedResults.map((result, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-white">
                              <span className="text-orange-400 mt-1">📊</span>
                              <span>{result}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
