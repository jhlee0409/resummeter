import React, { useEffect, useState } from 'react';
import * as Progress from '@radix-ui/react-progress';

const analysisStages = [
  { key: 'jd-analysis', label: "채용 공고 분석 중", detail: "JD에서 핵심 요구사항과 기술 스택 추출", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: 'resume-analysis', label: "이력서 분석 중", detail: "이력서와 JD를 대조 분석하고 있습니다", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: 'coaching', label: "코칭 제안 생성 중", detail: "근거 기반 수정 제안을 생성하고 있습니다", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { key: 'evidence-matching', label: "GitHub 근거 매칭 중", detail: "GitHub 활동에서 JD 연관 근거를 추출합니다", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
];

const tips = [
  { emoji: "💡", text: "인사담당자는 이력서를 평균 7초 만에 훑어봅니다. 핵심 성과를 상단에 배치하세요." },
  { emoji: "📊", text: "'매출 30% 성장에 기여'처럼 구체적인 수치가 포함된 이력서의 면접 전환율이 40% 높습니다." },
  { emoji: "🔑", text: "ATS(지원자 추적 시스템)는 JD의 키워드와 이력서의 키워드 매칭률을 기반으로 필터링합니다." },
  { emoji: "✍️", text: "'열심히 했다' 대신 '주도했다', '구축했다', '개선했다' 등 주도적 동사를 사용하세요." },
  { emoji: "🤝", text: "포트폴리오·실적표·수상 이력 같은 증빙 자료는 역량을 객관적으로 뒷받침합니다." },
  { emoji: "🎯", text: "하나의 범용 이력서보다, 지원하는 포지션마다 맞춤 이력서를 준비하면 합격률이 높아집니다." },
];

interface AnalysisStepProps {
  stage: 'jd-analysis' | 'resume-analysis' | 'coaching' | 'evidence-matching';
  hasGithub?: boolean;
}

export const AnalysisStep: React.FC<AnalysisStepProps> = ({ stage, hasGithub = false }) => {
  const visibleStages = hasGithub ? analysisStages : analysisStages.filter(s => s.key !== 'evidence-matching');
  const currentStage = visibleStages.findIndex(s => s.key === stage);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setTipIndex(prev => (prev + 1) % tips.length);
        setTipFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(tipInterval);
  }, []);

  // 현재 단계는 "진행 중"이므로 절반만 반영 → 가장 느린 마지막 단계에서 100%가
  // 먼저 차서 멈춰 보이는 문제 방지 (완료 시 컴포넌트가 REVIEW로 전환되며 사라짐)
  const progressPercent = Math.min(((currentStage + 0.5) / visibleStages.length) * 100, 95);

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] max-w-lg mx-auto px-4">

      {/* Morphing orb */}
      <div className="relative w-24 h-24 mb-10">
        <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-pulse-ring" />
        <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        <div className="absolute inset-[-8px] rounded-full bg-brand-500/5 animate-pulse-ring" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-400 via-brand-500 to-violet-600 shadow-2xl shadow-brand-500/40 flex items-center justify-center animate-morph">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
      </div>

      <h3 className="text-xl font-bold text-zinc-100 mb-1 text-center">AI가 이력서를 코칭하고 있어요</h3>
      <p className="text-zinc-400 text-sm mb-8 text-center">{hasGithub ? 'JD와 GitHub 활동을 종합해 근거 기반 수정 제안을 생성합니다' : 'JD를 분석하여 근거 기반 수정 제안을 생성합니다'}</p>

      {/* Progress */}
      <div className="w-full mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-semibold text-zinc-400">진행률</span>
          <span className="text-[11px] font-bold text-brand-400 section-num">{Math.round(progressPercent)}%</span>
        </div>
        <Progress.Root className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden" value={progressPercent}>
          <Progress.Indicator
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="absolute inset-0 overflow-hidden rounded-full"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-bar" /></div>
        </Progress.Root>
      </div>

      {/* Stages */}
      <div className="w-full space-y-1.5 mb-10">
        {visibleStages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isCurrent = idx === currentStage;
          const isPending = idx > currentStage;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500
                ${isCurrent ? 'glass-card border-brand-500/20 glow-border' : 'border border-transparent'}
                ${isCompleted ? 'opacity-40' : ''}
                ${isPending ? 'opacity-25' : ''}
              `}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-500
                ${isCompleted ? 'bg-emerald-500/15 text-emerald-400' : ''}
                ${isCurrent ? 'bg-brand-500 text-white shadow-md shadow-brand-500/40' : ''}
                ${isPending ? 'bg-zinc-800/50 text-zinc-600' : ''}
              `}>
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <span className="text-[10px] font-bold section-num">{String(idx + 1).padStart(2, '0')}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-semibold break-keep ${isCurrent ? 'text-brand-400' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {stage.label}
                </p>
                {isCurrent && (
                  <p className="text-[11px] text-brand-300/70 mt-0.5 animate-fade-in">{stage.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div className={`w-full glass-card rounded-xl px-5 py-3.5 transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">{tips[tipIndex].emoji}</span>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{tips[tipIndex].text}</p>
        </div>
      </div>
    </div>
  );
};
