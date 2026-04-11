import React from 'react';
import { AppStep } from '../../types';

interface StepperProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.UPLOAD, label: '정보 입력', num: '01' },
  { id: AppStep.ANALYSIS, label: 'AI 분석', num: '02' },
  { id: AppStep.REVIEW, label: '검토 및 수정', num: '03' },
];

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;

        return (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <div className={`w-12 h-px transition-colors duration-500 ${isCompleted ? 'bg-brand-500/50' : 'bg-zinc-800'}`} />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all duration-400 section-num
                  ${isCompleted ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30' : ''}
                  ${isCurrent ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-zinc-800/50 text-zinc-600' : ''}
                `}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={`text-[13px] font-semibold transition-colors duration-300 hidden sm:inline
                ${isCurrent ? 'text-zinc-200' : isCompleted ? 'text-brand-500' : 'text-zinc-600'}
              `}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
