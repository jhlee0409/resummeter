import type { DetailedScore } from "../types";

interface DetailedScoreViewProps {
  detailedScore: DetailedScore;
}

export default function DetailedScoreView({
  detailedScore,
}: DetailedScoreViewProps) {
  const { overall, breakdown, actionVerbs, quantification, starAnalysis } =
    detailedScore;

  // 점수에 따른 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  // STAR 완성도 색상
  const getCompletenessColor = (completeness: number) => {
    if (completeness >= 75) return "text-green-400";
    if (completeness >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      {/* 전체 점수 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">전체 상세 점수</h3>
          <div className={`text-4xl font-bold ${getScoreColor(overall)}`}>
            {Math.round(overall)}
            <span className="text-slate-400 text-xl">/100</span>
          </div>
        </div>
      </div>

      {/* 섹션별 점수 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-6">
          섹션별 점수 분석
        </h3>
        <div className="space-y-6">
          {/* 기술 스택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">
                기술 스택 관련성
              </span>
              <span
                className={`font-semibold ${getScoreColor(breakdown.techStack.score)}`}
              >
                {Math.round(breakdown.techStack.score)}{" "}
                <span className="text-slate-400 text-sm">
                  (가중치 {breakdown.techStack.weight * 100}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${getScoreBg(breakdown.techStack.score)}`}
                style={{ width: `${breakdown.techStack.score}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {breakdown.techStack.details.map((detail, idx) => (
                <li key={idx} className="text-sm text-slate-400">
                  • {detail}
                </li>
              ))}
            </ul>
          </div>

          {/* 경력 관련성 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">경력 관련성</span>
              <span
                className={`font-semibold ${getScoreColor(breakdown.experience.score)}`}
              >
                {Math.round(breakdown.experience.score)}{" "}
                <span className="text-slate-400 text-sm">
                  (가중치 {breakdown.experience.weight * 100}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${getScoreBg(breakdown.experience.score)}`}
                style={{ width: `${breakdown.experience.score}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {breakdown.experience.details.map((detail, idx) => (
                <li key={idx} className="text-sm text-slate-400">
                  • {detail}
                </li>
              ))}
            </ul>
          </div>

          {/* 임팩트/성과 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">임팩트/성과</span>
              <span
                className={`font-semibold ${getScoreColor(breakdown.impact.score)}`}
              >
                {Math.round(breakdown.impact.score)}{" "}
                <span className="text-slate-400 text-sm">
                  (가중치 {breakdown.impact.weight * 100}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${getScoreBg(breakdown.impact.score)}`}
                style={{ width: `${breakdown.impact.score}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {breakdown.impact.details.map((detail, idx) => (
                <li key={idx} className="text-sm text-slate-400">
                  • {detail}
                </li>
              ))}
            </ul>
          </div>

          {/* 가독성 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">가독성/구조</span>
              <span
                className={`font-semibold ${getScoreColor(breakdown.readability.score)}`}
              >
                {Math.round(breakdown.readability.score)}{" "}
                <span className="text-slate-400 text-sm">
                  (가중치 {breakdown.readability.weight * 100}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${getScoreBg(breakdown.readability.score)}`}
                style={{ width: `${breakdown.readability.score}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {breakdown.readability.details.map((detail, idx) => (
                <li key={idx} className="text-sm text-slate-400">
                  • {detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action Verb 분석 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          Action Verb 분석
        </h3>

        {/* 강한 동사 */}
        {actionVerbs.strong.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              이미 사용된 강한 동사
            </h4>
            <div className="flex flex-wrap gap-2">
              {actionVerbs.strong.map((verb, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-300 text-sm rounded-full"
                >
                  {verb}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 약한 동사 → 강한 동사 전환 제안 */}
        {actionVerbs.weak.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-yellow-400 mb-3">
              전환 추천: 약한 동사 → 강한 동사
            </h4>
            <div className="space-y-3">
              {actionVerbs.weak.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-semibold rounded">
                      {item.verb}
                    </span>
                    <span className="text-slate-500">→</span>
                    <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-semibold rounded">
                      {item.suggestion}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{item.line}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 정량화 분석 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          정량적 성과 분석
        </h3>

        {/* 이미 정량화된 항목 */}
        {quantification.quantified.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              정량적 성과가 잘 표현된 항목
            </h4>
            <ul className="space-y-2">
              {quantification.quantified.map((item, idx) => (
                <li
                  key={idx}
                  className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-slate-300"
                >
                  ✓ {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 수치화 필요 항목 */}
        {quantification.needsQuantification.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-yellow-400 mb-3">
              수치화 권장 항목
            </h4>
            <div className="space-y-3">
              {quantification.needsQuantification.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
                >
                  <p className="text-sm text-slate-300 mb-2">{item.line}</p>
                  <p className="text-sm text-yellow-300">💡 {item.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STAR 구조 분석 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          STAR 구조 분석
        </h3>
        <div className="space-y-4">
          {starAnalysis.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-200">{item.section}</h4>
                <span
                  className={`text-lg font-bold ${getCompletenessColor(item.completeness)}`}
                >
                  {Math.round(item.completeness)}%
                </span>
              </div>

              {/* STAR 체크리스트 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    item.hasS
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <span className={item.hasS ? "text-green-400" : "text-red-400"}>
                    {item.hasS ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-slate-300">
                    S (상황)
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    item.hasT
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <span className={item.hasT ? "text-green-400" : "text-red-400"}>
                    {item.hasT ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-slate-300">
                    T (과제)
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    item.hasA
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <span className={item.hasA ? "text-green-400" : "text-red-400"}>
                    {item.hasA ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-slate-300">
                    A (행동)
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    item.hasR
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <span className={item.hasR ? "text-green-400" : "text-red-400"}>
                    {item.hasR ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-slate-300">
                    R (결과)
                  </span>
                </div>
              </div>

              {/* 제안 사항 */}
              {item.suggestion && (
                <p className="text-sm text-yellow-300 mt-2">
                  💡 {item.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
