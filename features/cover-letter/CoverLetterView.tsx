import { useState } from 'react';
import { marked } from 'marked';
import {
  TailoredInstructionWithRequirements,
  CoachingResult,
  CoverLetterConfig,
  CoverLetterTone,
  CoverLetterLength,
  CoverLetterLanguage,
  CompanyContext,
} from '../../types';
import { useFeatureStore } from '../../stores/featureStore';

interface CoverLetterViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  coachingResult?: CoachingResult;
  companyContext?: CompanyContext | null;
}

export function CoverLetterView({
  resumeText,
  jobDescription,
  instruction,
  coachingResult,
  companyContext,
}: CoverLetterViewProps) {
  const { result, loading, error } = useFeatureStore(s => s.coverLetter);
  const storeGenerateCoverLetter = useFeatureStore(s => s.generateCoverLetter);

  const [tone, setTone] = useState<CoverLetterTone>('confident');
  const [length, setLength] = useState<CoverLetterLength>('medium');
  const [language, setLanguage] = useState<CoverLetterLanguage>('ko');

  const handleGenerate = async () => {
    const config: CoverLetterConfig = { tone, length, language };
    await storeGenerateCoverLetter(
      resumeText,
      jobDescription,
      instruction,
      config,
      coachingResult,
      companyContext
    );
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
  };

  const renderMarkdown = (markdown: string) => {
    return { __html: marked(markdown) };
  };

  const toneOptions: { value: CoverLetterTone; label: string }[] = [
    { value: 'formal', label: '격식 있는' },
    { value: 'confident', label: '자신감 있는' },
    { value: 'passionate', label: '열정적인' },
  ];

  const lengthOptions: { value: CoverLetterLength; label: string }[] = [
    { value: 'short', label: '짧게 (500-700자)' },
    { value: 'medium', label: '중간 (900-1200자)' },
    { value: 'long', label: '길게 (1400-1800자)' },
  ];

  const languageOptions: { value: CoverLetterLanguage; label: string }[] = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Settings */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">커버레터 생성</h2>

        {/* Config Panel */}
        <div className="space-y-4 mb-6">
          {/* Tone Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">어조</label>
            <div className="flex gap-3">
              {toneOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    tone === option.value
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">길이</label>
            <div className="flex gap-3">
              {lengthOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setLength(option.value)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    length === option.value
                      ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">언어</label>
            <div className="flex gap-3">
              {languageOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setLanguage(option.value)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    language === option.value
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {loading ? '생성 중...' : '커버레터 생성'}
        </button>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-blue-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>AI가 맞춤형 커버레터를 작성하고 있습니다...</span>
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
          {/* Meta Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-slate-700 rounded-full text-slate-300 text-sm">
                {result.language === 'ko' ? '한국어' : 'English'}
              </span>
              <span className="text-slate-400 text-sm">
                {result.charCount}자
              </span>
              <span className="text-slate-400 text-sm">
                {result.keywordsUsed.length}개 키워드 포함
              </span>
            </div>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              복사
            </button>
          </div>

          {/* Cover Letter Content */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8">
            <div
              className="prose prose-invert prose-slate max-w-none
                prose-headings:text-white prose-headings:font-bold
                prose-p:text-slate-200 prose-p:leading-relaxed
                prose-strong:text-blue-300
                prose-ul:text-slate-200
                prose-ol:text-slate-200"
              dangerouslySetInnerHTML={renderMarkdown(result.content)}
            />
          </div>

          {/* Keywords Used */}
          {result.keywordsUsed.length > 0 && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">사용된 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {result.keywordsUsed.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-full text-blue-300 text-sm"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
