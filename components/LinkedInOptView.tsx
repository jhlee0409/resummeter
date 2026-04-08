import React, { useState } from "react";
import type { TailoredInstructionWithRequirements, LinkedInOptimization } from "../types";
import { generateLinkedInOptimization } from "../services/skillGapService";

interface LinkedInOptViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
}

export default function LinkedInOptView({ resumeText, jobDescription, instruction }: LinkedInOptViewProps) {
  const [optimization, setOptimization] = useState<LinkedInOptimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateLinkedInOptimization(resumeText, jobDescription, instruction);
      setOptimization(result);
    } catch (err) {
      console.error("LinkedIn 최적화 생성 실패:", err);
      setError("LinkedIn 프로필 최적화에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">LinkedIn 프로필 최적화</h2>
          <p className="text-gray-400">이력서 기반으로 LinkedIn 프로필을 최적화합니다</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "생성 중..." : "LinkedIn 프로필 최적화"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {!optimization && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">LinkedIn 프로필 최적화를 시작하세요</p>
          <p className="text-sm">버튼을 클릭하여 이력서 기반 프로필을 생성합니다</p>
        </div>
      )}

      {optimization && (
        <div className="space-y-6">
          {/* Headline Section */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Headline</h3>
              <button
                onClick={() => handleCopy(optimization.headline, "headline")}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
              >
                {copiedSection === "headline" ? "복사됨!" : "복사"}
              </button>
            </div>
            <div className="bg-gray-900/50 rounded p-4 border border-gray-700">
              <p className="text-gray-200">{optimization.headline}</p>
              <div className="mt-2 text-xs text-gray-400">
                {optimization.headline.length} / 120자
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">About</h3>
              <button
                onClick={() => handleCopy(optimization.about, "about")}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
              >
                {copiedSection === "about" ? "복사됨!" : "복사"}
              </button>
            </div>
            <div className="bg-gray-900/50 rounded p-4 border border-gray-700">
              <p className="text-gray-200 whitespace-pre-wrap">{optimization.about}</p>
              <div className="mt-2 text-xs text-gray-400">
                {optimization.about.length} / 2000자
              </div>
            </div>
          </div>

          {/* Experience Highlights */}
          {optimization.experienceHighlights.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Experience 하이라이트</h3>
              <div className="space-y-4">
                {optimization.experienceHighlights.map((exp, index) => (
                  <div key={index} className="bg-gray-900/50 rounded p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{exp.role}</h4>
                      <button
                        onClick={() => handleCopy(exp.optimizedDescription, `exp-${index}`)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                      >
                        {copiedSection === `exp-${index}` ? "복사됨!" : "복사"}
                      </button>
                    </div>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{exp.optimizedDescription}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyword Density */}
          {optimization.keywordDensity.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">키워드 밀도 분석</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400 font-semibold">키워드</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">현재</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">권장</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimization.keywordDensity.map((item, index) => {
                      const status =
                        item.count >= item.recommended
                          ? "ok"
                          : item.count === 0
                          ? "missing"
                          : "low";
                      const statusColor =
                        status === "ok"
                          ? "text-green-400"
                          : status === "missing"
                          ? "text-red-400"
                          : "text-yellow-400";
                      const statusLabel =
                        status === "ok"
                          ? "충분"
                          : status === "missing"
                          ? "부족"
                          : "보완 필요";

                      return (
                        <tr key={index} className="border-b border-gray-700">
                          <td className="py-2 px-3 text-gray-200">{item.keyword}</td>
                          <td className="py-2 px-3 text-center text-gray-300">{item.count}</td>
                          <td className="py-2 px-3 text-center text-gray-300">{item.recommended}</td>
                          <td className={`py-2 px-3 text-center font-medium ${statusColor}`}>
                            {statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
