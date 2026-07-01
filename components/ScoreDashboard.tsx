import React, { useMemo, useState } from 'react';
import { CoachingResult, UserInputData } from '../types';
import { LEVEL_LABELS } from '../core/scoring/scoringEngine';

interface ScoreDashboardProps {
  result: CoachingResult;
  originalData: UserInputData;
  atsScore?: number | null;
  prevAtsScore?: number | null;
  isLoadingAts?: boolean;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  hardRequirement: '필수 요건',
  hardSkill: '핵심 역량',
  experience: '경력/경험',
  softSkill: '소프트 스킬',
  domain: '도메인 키워드',
};

const BREAKDOWN_COLORS: Record<string, string> = {
  hardRequirement: 'bg-red-400',
  hardSkill: 'bg-orange-400',
  experience: 'bg-amber-400',
  softSkill: 'bg-blue-400',
  domain: 'bg-purple-400',
};

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ result, originalData, atsScore, prevAtsScore, isLoadingAts }) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const scoring = result.scoringResult;

  const scoreConfig = useMemo(() => {
    if (scoring) {
      const levelInfo = LEVEL_LABELS[scoring.level];
      const colorMap: Record<string, { bg: string; text: string }> = {
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
        orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400' },
        zinc: { bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
      };
      return { ...colorMap[levelInfo.color], label: levelInfo.label };
    }
    if (result.matchScore >= 75) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '우수' };
    if (result.matchScore >= 50) return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: '보통' };
    return { bg: 'bg-red-500/10', text: 'text-red-400', label: '개선 필요' };
  }, [scoring, result.matchScore]);

  const displayScore = scoring?.matchScore ?? result.matchScore;

  const strongCount = result.gapMap.filter(g => g.currentLevel === 'strong').length;
  const weakCount = result.gapMap.filter(g => g.currentLevel === 'weak').length;
  const missingCount = result.gapMap.filter(g => g.currentLevel === 'missing').length;
  const insightCount = result.insights.length;
  const actionCount = result.actionItems?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Match Score + Level — 화면의 1순위 결론이므로 액센트 강조 */}
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-brand-500/25 shadow-lg shadow-brand-500/5">
          <div className={`w-16 h-16 rounded-2xl ${scoreConfig.bg} flex items-center justify-center shrink-0`}>
            <span className={`text-3xl font-black ${scoreConfig.text} section-num`}>{displayScore}</span>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400 font-medium">직무 적합도 <span className="text-zinc-600">(분석 시점)</span></p>
            <p className={`text-base font-bold ${scoreConfig.text}`}>{scoreConfig.label}</p>
          </div>
        </div>

        {/* Gap Summary */}
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[11px] text-zinc-400 font-medium mb-2.5">요구사항 분석</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-zinc-300 section-num">{strongCount}</span>
              <span className="text-[10px] text-zinc-600">충족</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-zinc-300 section-num">{weakCount}</span>
              <span className="text-[10px] text-zinc-600">부분</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-xs font-semibold text-zinc-300 section-num">{missingCount}</span>
              <span className="text-[10px] text-zinc-600">미충족</span>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[11px] text-zinc-400 font-medium">코칭 제안</p>
          <p className="text-sm font-bold text-brand-400">{actionCount}개 액션 아이템</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{insightCount}개 인사이트</p>
        </div>

        {/* ATS Score — 미산출 시 의도된 비활성임을 흐리게 표현 */}
        <div className={`glass-card p-5 rounded-2xl ${atsScore == null && !isLoadingAts ? 'opacity-60' : ''}`}>
          {atsScore != null ? (
            <div>
              <p className="text-[11px] text-zinc-400 font-medium">ATS 점수</p>
              <div className="flex items-center gap-2 mt-1">
                {prevAtsScore != null && prevAtsScore !== atsScore && (
                  <>
                    <span className="text-[11px] text-zinc-500 section-num">{prevAtsScore}</span>
                    <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
                <span className={`text-lg font-black section-num ${atsScore >= 75 ? 'text-emerald-400' : atsScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {isLoadingAts ? '...' : atsScore}
                </span>
                {prevAtsScore != null && atsScore > prevAtsScore && (
                  <span className="text-[10px] text-emerald-400 font-semibold">+{atsScore - prevAtsScore}</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-zinc-400 font-medium">ATS 점수</p>
              <p className="text-xs text-zinc-500 mt-1">상세 점수 탭에서 측정</p>
            </div>
          )}
        </div>
      </div>

      {/* Scoring Breakdown */}
      {scoring && scoring.level !== 'data_insufficient' && (
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-zinc-400 font-medium">감점 내역</p>
            {scoring.penalties.length > 0 && (
              <button
                onClick={() => setShowPenalties(!showPenalties)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPenalties ? '접기' : `상세 ${scoring.penalties.length}건`}
              </button>
            )}
          </div>

          {/* Breakdown bar */}
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-dark-800/50 mb-3">
            {Object.entries(scoring.breakdown).map(([key, value]) => (
              value > 0 ? (
                <div
                  key={key}
                  className={`${BREAKDOWN_COLORS[key]} rounded-full transition-all`}
                  style={{ width: `${value}%` }}
                  title={`${BREAKDOWN_LABELS[key]}: -${value}점`}
                />
              ) : null
            ))}
            {/* 잔여 점수 (초록) */}
            <div
              className="bg-emerald-400/30 rounded-full flex-1"
              title={`적합: ${scoring.matchScore}점`}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(scoring.breakdown).map(([key, value]) => (
              value > 0 ? (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${BREAKDOWN_COLORS[key]}`} />
                  <span className="text-[10px] text-zinc-500">{BREAKDOWN_LABELS[key]}</span>
                  <span className="text-[10px] font-semibold text-zinc-400 section-num">-{value}</span>
                </div>
              ) : null
            ))}
          </div>

          {/* Penalty details (collapsible) */}
          {showPenalties && (
            <div className="mt-3 pt-3 border-t border-dark-700/50 space-y-2">
              {scoring.penalties.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-red-400 font-semibold section-num shrink-0">-{p.points}</span>
                  <span className="text-[10px] text-zinc-400">{p.reason}</span>
                </div>
              ))}
              {scoring.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-start gap-2">
                  <span className="text-[10px] text-amber-400 shrink-0">!</span>
                  <span className="text-[10px] text-zinc-500">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
