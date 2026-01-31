import React, { useEffect, useState } from 'react';

const analysisStages = [
  { label: "채용 공고 분석 중", detail: "JD에서 핵심 요구사항과 기술 스택 추출", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "AI 면접관 페르소나 생성", detail: "직무에 최적화된 채용 담당자 관점 구축", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { label: "GitHub 활동 분석", detail: "코드 리뷰, PR, Issue 패턴에서 역량 추출", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { label: "이력서 최적화 중", detail: "한국 채용 시장에 맞춘 문장과 키워드 최적화", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { label: "최종 결과 생성 중", detail: "인사이트와 최적화된 이력서 구성 완료", icon: "M5 13l4 4L19 7" },
];

const tips = [
  { emoji: "💡", text: "인사담당자는 이력서를 평균 7초 만에 훑어봅니다. 핵심 성과를 상단에 배치하세요." },
  { emoji: "📊", text: "'매출 30% 성장에 기여'처럼 구체적인 수치가 포함된 이력서의 면접 전환율이 40% 높습니다." },
  { emoji: "🔑", text: "ATS(지원자 추적 시스템)는 JD의 키워드와 이력서의 키워드 매칭률을 기반으로 필터링합니다." },
  { emoji: "✍️", text: "'열심히 했다' 대신 '주도했다', '구축했다', '개선했다' 등 주도적 동사를 사용하세요." },
  { emoji: "🤝", text: "GitHub 활동은 코드 실력뿐 아니라 문서화, 소통, 협업 능력의 증거가 됩니다." },
  { emoji: "🎯", text: "하나의 범용 이력서보다, 지원하는 포지션마다 맞춤 이력서를 준비하면 합격률이 높아집니다." },
];

export const AnalysisStep: React.FC = () => {
  const [currentStage, setCurrentStage] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < analysisStages.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);
    return () => clearInterval(stageInterval);
  }, []);

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

  const progressPercent = Math.min(((currentStage + 1) / analysisStages.length) * 100, 100);

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] max-w-lg mx-auto px-4">

      {/* Morphing orb */}
      <div className="relative w-24 h-24 mb-10">
        <div className="absolute inset-0 rounded-full bg-brand-500/8 animate-pulse-ring" />
        <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-400 via-brand-500 to-violet-600 shadow-2xl shadow-brand-500/30 flex items-center justify-center animate-morph">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-1 text-center">AI가 이력서를 분석하고 있어요</h3>
      <p className="text-slate-400 text-sm mb-8 text-center">JD와 GitHub 활동을 종합해 최적의 이력서를 생성합니다</p>

      {/* Progress */}
      <div className="w-full mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-semibold text-slate-500">진행률</span>
          <span className="text-[11px] font-bold text-brand-600 section-num">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="w-full space-y-1.5 mb-10">
        {analysisStages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isCurrent = idx === currentStage;
          const isPending = idx > currentStage;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500
                ${isCurrent ? 'bg-brand-50 border border-brand-100' : 'border border-transparent'}
                ${isCompleted ? 'opacity-50' : ''}
                ${isPending ? 'opacity-25' : ''}
              `}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-500
                ${isCompleted ? 'bg-emerald-100 text-emerald-600' : ''}
                ${isCurrent ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20' : ''}
                ${isPending ? 'bg-slate-100 text-slate-400' : ''}
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
                <p className={`text-[13px] font-semibold truncate ${isCurrent ? 'text-brand-700' : isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                  {stage.label}
                </p>
                {isCurrent && (
                  <p className="text-[11px] text-brand-400 mt-0.5 animate-fade-in">{stage.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div className={`w-full bg-slate-50 border border-slate-200/80 rounded-xl px-5 py-3.5 transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">{tips[tipIndex].emoji}</span>
          <p className="text-[12px] text-slate-500 leading-relaxed">{tips[tipIndex].text}</p>
        </div>
      </div>
    </div>
  );
};
