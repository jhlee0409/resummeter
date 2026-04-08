import type { AtsScore } from "../types";

interface AtsScoreViewProps {
  atsScore: AtsScore;
}

export default function AtsScoreView({ atsScore }: AtsScoreViewProps) {
  const {
    overall,
    keywordMatch,
    formatCompliance,
    keywordCount,
    recommendedRange,
    isStuffing,
    stuffingWarnings,
    keywords,
    abbreviations,
    formatIssues,
  } = atsScore;

  // 원형 게이지를 위한 SVG 계산
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (overall / 100) * circumference;
  const dashOffset = circumference - progress;

  // 점수에 따른 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500/20";
    if (score >= 60) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  const getScoreStroke = (score: number) => {
    if (score >= 80) return "#4ade80";
    if (score >= 60) return "#facc15";
    return "#f87171";
  };

  return (
    <div className="space-y-6">
      {/* 전체 ATS 점수 원형 게이지 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          ATS 친화도 점수
        </h3>
        <div className="flex items-center gap-8">
          {/* 원형 게이지 */}
          <div className="relative flex items-center justify-center">
            <svg width="200" height="200" className="transform -rotate-90">
              {/* 배경 원 */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="#334155"
                strokeWidth="12"
              />
              {/* 진행 원 */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={getScoreStroke(overall)}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-5xl font-bold ${getScoreColor(overall)}`}>
                {Math.round(overall)}
              </div>
              <div className="text-slate-400 text-sm">/ 100</div>
            </div>
          </div>

          {/* 세부 점수 */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">키워드 매칭</span>
              <span className={`font-semibold ${getScoreColor(keywordMatch)}`}>
                {Math.round(keywordMatch)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBg(keywordMatch)}`}
                style={{ width: `${keywordMatch}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-300">포맷 준수</span>
              <span
                className={`font-semibold ${getScoreColor(formatCompliance)}`}
              >
                {Math.round(formatCompliance)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBg(formatCompliance)}`}
                style={{ width: `${formatCompliance}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-300">키워드 개수</span>
              <span className="text-white font-semibold">
                {keywordCount}{" "}
                <span className="text-slate-400 text-sm">
                  (권장: {recommendedRange.min}-{recommendedRange.max})
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* 스터핑 경고 */}
        {isStuffing && stuffingWarnings.length > 0 && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-semibold text-sm uppercase tracking-wide">
                키워드 스터핑 감지
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {stuffingWarnings.map((warning, idx) => (
                <li key={idx} className="text-red-300 text-sm">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 키워드 매칭 현황 */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          키워드 매칭 현황
        </h3>
        <div className="space-y-2">
          {keywords.map((kw, idx) => (
            <div
              key={idx}
              className={`flex items-start justify-between p-3 rounded-lg ${
                kw.foundInResume
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      kw.foundInResume ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {kw.keyword}
                  </span>
                  {kw.foundInResume && (
                    <span className="text-xs text-slate-400">
                      {kw.frequency}회 사용
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">{kw.context}</p>
                {kw.suggestion && (
                  <p className="text-sm text-yellow-300 mt-1">
                    💡 {kw.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 약어 병기 제안 */}
      {abbreviations.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">
            약어 병기 제안
          </h3>
          <div className="space-y-2">
            {abbreviations.map((abbr, idx) => (
              <div
                key={idx}
                className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-300 font-semibold">
                    {abbr.original}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="text-slate-300">{abbr.expanded}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{abbr.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 포맷 이슈 */}
      {formatIssues.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">
            포맷 개선 사항
          </h3>
          <ul className="space-y-2">
            {formatIssues.map((issue, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-slate-300 text-sm"
              >
                <span className="text-yellow-400 mt-1">⚠</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
