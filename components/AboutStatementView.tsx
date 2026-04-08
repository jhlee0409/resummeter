import { useState } from 'react';
import {
  TailoredInstructionWithRequirements,
  CoachingResult,
  AboutStatementResult,
  AboutStatementVersion,
} from '../types';
import { refineAboutStatement } from '../services/careerDocService';

interface AboutStatementViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  coachingResult?: CoachingResult;
}

const TONE_COLORS: Record<string, { gradient: string; border: string; badge: string }> = {
  professional: {
    gradient: 'from-blue-600 to-indigo-600',
    border: 'border-blue-500/30',
    badge: 'bg-blue-900/40 text-blue-300',
  },
  friendly: {
    gradient: 'from-green-600 to-teal-600',
    border: 'border-green-500/30',
    badge: 'bg-green-900/40 text-green-300',
  },
  impactful: {
    gradient: 'from-orange-600 to-red-600',
    border: 'border-orange-500/30',
    badge: 'bg-orange-900/40 text-orange-300',
  },
};

export function AboutStatementView({
  resumeText,
  jobDescription,
  instruction,
  coachingResult,
}: AboutStatementViewProps) {
  const [inputStatement, setInputStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AboutStatementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedVersion, setCopiedVersion] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!inputStatement.trim()) {
      setError('자기소개 문장을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const generated = await refineAboutStatement(
        inputStatement,
        resumeText,
        jobDescription,
        instruction,
        coachingResult
      );
      setResult(generated);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (version: AboutStatementVersion) => {
    await navigator.clipboard.writeText(version.content);
    setCopiedVersion(version.id);
    setTimeout(() => setCopiedVersion(null), 2000);
  };

  const isRecommended = (versionId: string): boolean => {
    return result?.bestVersion?.startsWith(versionId) ?? false;
  };

  return (
    <div className="space-y-6">
      {/* Header + Input */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">한 줄 자기소개 고도화</h2>
        <p className="text-slate-400 mb-6">
          대략적으로 작성한 자기소개를 이력서 기반으로 나를 가장 잘 표현하는 1-2줄로 다듬어 드립니다.
        </p>

        {/* Input Area */}
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold text-slate-300">
            원본 자기소개
          </label>
          <textarea
            value={inputStatement}
            onChange={(e) => setInputStatement(e.target.value)}
            placeholder="예: 5년차 백엔드 개발자입니다. 주로 Java와 Spring을 사용해왔습니다."
            className="w-full h-24 px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none"
          />
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">
              50-100자 내외로 작성하면 좋습니다
            </span>
            <span className={`${inputStatement.length > 150 ? 'text-orange-400' : 'text-slate-400'}`}>
              {inputStatement.length}자
            </span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !inputStatement.trim()}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {loading ? '고도화 중...' : '고도화 하기'}
        </button>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-blue-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>AI가 3가지 톤으로 자기소개를 다듬고 있습니다...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Original Analysis */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              원본 분석
            </h3>
            <p className="text-slate-300 leading-relaxed">{result.originalAnalysis}</p>
          </div>

          {/* Three Versions */}
          <div className="grid gap-4">
            {result.versions.map((version) => {
              const colors = TONE_COLORS[version.tone] || TONE_COLORS.professional;
              const recommended = isRecommended(version.id);

              return (
                <div
                  key={version.id}
                  className={`bg-slate-800/50 backdrop-blur-sm border rounded-xl p-6 transition-all ${
                    recommended
                      ? `border-yellow-500/50 ring-1 ring-yellow-500/30`
                      : `border-slate-700/50`
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}>
                        {version.toneLabel}
                      </span>
                      {recommended && (
                        <span className="px-3 py-1 bg-yellow-900/40 text-yellow-300 rounded-full text-sm font-medium flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          추천
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-sm">{version.charCount}자</span>
                  </div>

                  {/* Content */}
                  <div className={`p-4 bg-gradient-to-r ${colors.gradient} bg-opacity-10 rounded-lg mb-4`}>
                    <p className="text-white text-lg font-medium leading-relaxed">
                      "{version.content}"
                    </p>
                  </div>

                  {/* Improvements */}
                  {version.improvements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">개선 포인트</h4>
                      <ul className="space-y-1">
                        {version.improvements.map((imp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300 text-sm">
                            <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Keywords & Strengths */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {version.keywordsUsed.map((kw, idx) => (
                      <span
                        key={`kw-${idx}`}
                        className={`px-2 py-1 rounded text-xs ${colors.border} border ${colors.badge}`}
                      >
                        {kw}
                      </span>
                    ))}
                    {version.strengthsHighlighted.map((str, idx) => (
                      <span
                        key={`str-${idx}`}
                        className="px-2 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-300 rounded text-xs"
                      >
                        {str}
                      </span>
                    ))}
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(version)}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                      copiedVersion === version.id
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {copiedVersion === version.id ? '복사됨!' : '복사하기'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Best Version Explanation */}
          {result.bestVersion && (
            <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-yellow-300 font-semibold mb-1">추천 이유</h4>
                  <p className="text-slate-300 text-sm">{result.bestVersion}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
