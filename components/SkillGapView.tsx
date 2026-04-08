import React, { useState } from "react";
import type { GapMapItem, TailoredInstructionWithRequirements, LearningRoadmap, SkillGapItem } from "../types";
import { analyzeLearningRoadmap } from "../services/skillGapService";

interface SkillGapViewProps {
  gapMap: GapMapItem[];
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
}

const priorityColors = {
  critical: "bg-red-900/30 border-red-600 text-red-300",
  high: "bg-orange-900/30 border-orange-600 text-orange-300",
  medium: "bg-yellow-900/30 border-yellow-600 text-yellow-300",
  low: "bg-blue-900/30 border-blue-600 text-blue-300",
};

const priorityLabels = {
  critical: "긴급",
  high: "높음",
  medium: "중간",
  low: "낮음",
};

const levelColors = {
  missing: "bg-red-500/20 text-red-300 border border-red-600/50",
  weak: "bg-yellow-500/20 text-yellow-300 border border-yellow-600/50",
  strong: "bg-green-500/20 text-green-300 border border-green-600/50",
};

const levelLabels = {
  missing: "부족",
  weak: "약함",
  strong: "강함",
};

const platformIcons: Record<string, string> = {
  inflearn: "📚",
  udemy: "🎓",
  coursera: "🏫",
  youtube: "▶️",
  docs: "📖",
};

const platformLabels: Record<string, string> = {
  inflearn: "인프런",
  udemy: "Udemy",
  coursera: "Coursera",
  youtube: "YouTube",
  docs: "공식문서",
};

export default function SkillGapView({ gapMap, jobDescription, instruction }: SkillGapViewProps) {
  const [roadmap, setRoadmap] = useState<LearningRoadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateRoadmap = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeLearningRoadmap(gapMap, jobDescription, instruction);
      setRoadmap(result);
    } catch (err) {
      console.error("학습 로드맵 생성 실패:", err);
      setError("학습 로드맵 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // missing/weak 항목만 필터링
  const gaps = gapMap.filter((item) => item.currentLevel === "missing" || item.currentLevel === "weak");

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">스킬 갭 분석</h2>
          <p className="text-gray-400">
            채용 공고 대비 부족한 스킬: <span className="text-orange-400 font-semibold">{gaps.length}개</span>
          </p>
        </div>
        <button
          onClick={handleGenerateRoadmap}
          disabled={loading || gaps.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "생성 중..." : "학습 로드맵 생성"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {gaps.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">모든 스킬이 충분합니다! 🎉</p>
        </div>
      )}

      {!roadmap && gaps.length > 0 && (
        <div className="space-y-4">
          {gaps.map((gap, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{gap.requirement}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[gap.currentLevel]}`}>
                    {levelLabels[gap.currentLevel]}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  JD {gap.jdMentions}회 / 이력서 {gap.resumeMentions}회
                </div>
              </div>
              <p className="text-gray-300 text-sm">{gap.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      {roadmap && (
        <div>
          <div className="flex items-center gap-6 mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{roadmap.totalSkillGaps}</div>
              <div className="text-sm text-gray-400">총 스킬 갭</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">{roadmap.criticalGaps}</div>
              <div className="text-sm text-gray-400">긴급 갭</div>
            </div>
          </div>

          {["critical", "high", "medium", "low"].map((priority) => {
            const items = roadmap.items.filter((item) => item.priority === priority);
            if (items.length === 0) return null;

            return (
              <div key={priority} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">{priorityLabels[priority as keyof typeof priorityLabels]} 우선순위</h3>
                  <span className="text-sm text-gray-400">({items.length}개)</span>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-5 border-2 ${priorityColors[item.priority as keyof typeof priorityColors]}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-semibold text-white">{item.requirement}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[item.currentLevel]}`}>
                            현재: {levelLabels[item.currentLevel]}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300 bg-gray-800/50 px-3 py-1 rounded">
                          예상 노력: {item.estimatedEffort}
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm mb-4">{item.suggestion}</p>

                      {item.learningResources.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-400 mb-2">학습 리소스</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {item.learningResources.map((resource, rIndex) => (
                              <a
                                key={rIndex}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-gray-800/50 rounded hover:bg-gray-700/50 transition-colors border border-gray-700"
                              >
                                <div className="text-2xl">{platformIcons[resource.platform]}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{resource.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">{platformLabels[resource.platform]}</span>
                                    <span className="text-xs text-gray-500">•</span>
                                    <span className="text-xs text-gray-400 capitalize">{resource.level}</span>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.relatedActions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <h5 className="text-sm font-semibold text-gray-400 mb-2">관련 액션 아이템</h5>
                          <div className="flex flex-wrap gap-2">
                            {item.relatedActions.map((action, aIndex) => (
                              <span key={aIndex} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                                {action}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
