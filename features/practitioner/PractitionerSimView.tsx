import React from "react";
import type { TailoredInstructionWithRequirements } from "../../types";
import type { PractitionerReview } from "./service";
import { useFeatureStore } from "../../stores/featureStore";

interface PractitionerSimViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
}

const RECOMMENDATION_CONFIG: Record<
  PractitionerReview['hiringRecommendation'],
  { label: string; color: string; bg: string; border: string }
> = {
  strong_yes: {
    label: '강력 추천',
    color: 'text-green-300',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
  },
  yes: {
    label: '추천',
    color: 'text-blue-300',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
  },
  maybe: {
    label: '보류',
    color: 'text-amber-300',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
  },
  no: {
    label: '비추천',
    color: 'text-red-300',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
  },
};

export function PractitionerSimView({ resumeText, jobDescription, instruction }: PractitionerSimViewProps) {
  const { result, loading, error } = useFeatureStore(s => s.practitioner);
  const generatePractitioner = useFeatureStore(s => s.generatePractitioner);
  const review = result;

  const handleGenerate = () => {
    generatePractitioner(resumeText, jobDescription, instruction);
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">실무자 시뮬레이션</h2>
          <p className="text-gray-400">채용 실무자의 관점에서 이력서를 분석합니다</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "분석 중..." : "실무자 시선으로 분석"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">실무자 관점으로 이력서를 분석하고 있습니다...</p>
        </div>
      )}

      {!review && !loading && !error && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">실무자 시뮬레이션을 시작하세요</p>
          <p className="text-sm">업종별 실무자(CTO, 리스크관리팀장 등)의 시선으로 이력서를 리뷰합니다</p>
        </div>
      )}

      {review && (
        <div className="space-y-6">
          {/* Practitioner Persona Badge */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-sm">
              {review.perspective}의 시선
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 border border-gray-600 text-gray-400 text-xs">
              {review.industry}
            </span>
          </div>

          {/* Overall Impression */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">전체 인상</h3>
            <p className="text-gray-300 leading-relaxed">{review.overallImpression}</p>
          </div>

          {/* Strengths and Concerns side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">강점</h3>
              <ul className="space-y-3">
                {review.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">&#10003;</span>
                    <span className="text-gray-300 text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Concerns */}
            <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">우려 사항</h3>
              <ul className="space-y-3">
                {review.concerns.map((concern, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">&#9888;</span>
                    <span className="text-gray-300 text-sm">{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interview Questions */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              {review.perspective}가 물어볼 면접 질문
            </h3>
            <div className="space-y-3">
              {review.interviewQuestions.map((question, idx) => (
                <div
                  key={idx}
                  className="bg-gray-900/50 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold flex-shrink-0">
                      Q{idx + 1}
                    </span>
                    <p className="text-gray-200 text-sm">{question}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hiring Recommendation */}
          {(() => {
            const config = RECOMMENDATION_CONFIG[review.hiringRecommendation];
            return (
              <div className={`rounded-lg p-5 border ${config.bg} ${config.border}`}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-white">채용 추천</h3>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${config.color} ${config.bg} border ${config.border}`}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{review.recommendationReason}</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
