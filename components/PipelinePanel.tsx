import { useState } from 'react';
import type { TailoredInstructionWithRequirements, CoachingResult } from '../types';
import {
  runPipeline,
  type PipelineType,
  type PipelineProgress,
  type PipelineResults,
  type PipelineStep,
} from '../services/pipelineService';

interface PipelinePanelProps {
  onRun: (type: PipelineType, results: PipelineResults) => void;
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  coachingResult: CoachingResult;
}

interface PipelineCard {
  type: PipelineType;
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

const PIPELINE_CARDS: PipelineCard[] = [
  {
    type: 'application-package',
    title: '지원서 패키지',
    description: '경력기술서 + 커버레터 + 자소서를 하나의 스토리로',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z M7 3v2m0 0H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    gradient: 'from-violet-500/20 to-indigo-500/20',
  },
  {
    type: 'score-optimization',
    title: '점수 최적화',
    description: 'ATS 점수 분석 + 실무자 관점 종합',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    type: 'interview-prep',
    title: '면접 준비',
    description: '맞춤 질문 생성 + 실무자 시선 분석',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    type: 'personal-branding',
    title: '퍼스널 브랜딩',
    description: 'LinkedIn + 한줄소개 통합 최적화',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    gradient: 'from-rose-500/20 to-pink-500/20',
  },
];

// ─────────────────────────────────────────────────────────────
// Step Status Indicator
// ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: PipelineStep }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {step.status === 'pending' && (
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
        )}
        {step.status === 'running' && (
          <svg
            className="w-4 h-4 text-brand-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {step.status === 'done' && (
          <svg
            className="w-4 h-4 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {step.status === 'error' && (
          <svg
            className="w-4 h-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={`text-[11px] font-medium ${
            step.status === 'running'
              ? 'text-brand-300'
              : step.status === 'done'
                ? 'text-emerald-400'
                : step.status === 'error'
                  ? 'text-red-400'
                  : 'text-zinc-500'
          }`}
        >
          {step.label}
        </span>
        {step.status === 'error' && step.error && (
          <p className="text-[10px] text-red-400/70 truncate mt-0.5">
            {step.error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pipeline Panel
// ─────────────────────────────────────────────────────────────

export function PipelinePanel({
  onRun,
  resumeText,
  jobDescription,
  instruction,
  coachingResult,
}: PipelinePanelProps) {
  const [runningType, setRunningType] = useState<PipelineType | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [completedTypes, setCompletedTypes] = useState<Set<PipelineType>>(
    new Set(),
  );

  const handleRun = async (type: PipelineType) => {
    if (runningType) return; // prevent concurrent runs

    setRunningType(type);
    setProgress(null);

    try {
      const results = await runPipeline(
        type,
        resumeText,
        jobDescription,
        instruction,
        coachingResult,
        (p) => setProgress(p),
      );

      setCompletedTypes((prev) => new Set([...prev, type]));
      onRun(type, results);
    } catch (err) {
      console.error('Pipeline failed:', err);
    } finally {
      setRunningType(null);
      setProgress(null);
    }
  };

  const isRunning = (type: PipelineType) => runningType === type;
  const isCompleted = (type: PipelineType) => completedTypes.has(type);
  const isDisabled = (type: PipelineType) =>
    runningType !== null && runningType !== type;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <svg
            className="w-3.5 h-3.5 text-brand-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h3 className="text-[13px] font-bold text-zinc-300">
          원클릭 파이프라인
        </h3>
        <span className="text-[10px] text-zinc-600 ml-auto">
          클릭 한 번으로 여러 분석을 한번에
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PIPELINE_CARDS.map((card) => {
          const running = isRunning(card.type);
          const completed = isCompleted(card.type);
          const disabled = isDisabled(card.type);
          const currentProgress =
            running && progress ? progress : null;

          return (
            <button
              key={card.type}
              onClick={() => handleRun(card.type)}
              disabled={disabled || running}
              className={`
                glass-card rounded-xl text-left transition-all duration-200
                ${
                  running
                    ? 'border-brand-500/30 ring-1 ring-brand-500/20'
                    : completed
                      ? 'border-emerald-500/20'
                      : disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-white/10 hover:bg-white/[0.02] cursor-pointer'
                }
              `}
            >
              {/* Card Header */}
              <div className={`p-4 rounded-t-xl bg-gradient-to-br ${card.gradient}`}>
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <svg
                      className="w-4 h-4 text-white/80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={card.icon}
                      />
                    </svg>
                  </div>
                  {completed && !running && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                      <svg
                        className="w-3 h-3 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-[9px] font-semibold text-emerald-400">
                        완료
                      </span>
                    </div>
                  )}
                </div>
                <h4 className="text-[13px] font-bold text-white mt-2">
                  {card.title}
                </h4>
                <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* Progress Area */}
              <div className="p-3 space-y-1.5">
                {currentProgress ? (
                  currentProgress.steps.map((step) => (
                    <StepIndicator key={step.id} step={step} />
                  ))
                ) : (
                  <div className="flex items-center justify-center py-2">
                    {completed ? (
                      <span className="text-[10px] text-zinc-500">
                        다시 실행하려면 클릭하세요
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600">
                        클릭하여 실행
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
