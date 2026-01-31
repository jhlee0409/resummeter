import React from 'react';
import { AppStep } from '../types';

interface StepperProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.UPLOAD, label: '업로드 및 링크' },
  { id: AppStep.ANALYSIS, label: 'AI 분석' },
  { id: AppStep.REVIEW, label: '검토 및 내보내기' },
];

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <React.Fragment key={step.id}>
              {/* Step Circle & Label */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 border-2 
                    ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : ''}
                    ${isCurrent ? 'bg-white border-blue-600 text-blue-600' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-slate-100 border-slate-300 text-slate-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id + 1
                  )}
                </div>
                <span className={`absolute top-12 w-32 text-center text-xs font-medium uppercase tracking-wider ${isCurrent || isCompleted ? 'text-blue-600' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className={`w-16 md:w-32 h-1 transition-colors duration-300 mx-2 ${isCompleted ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
