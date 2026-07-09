import React, { useState, useEffect, useRef } from "react";
import * as Tabs from '@radix-ui/react-tabs';
import * as Progress from '@radix-ui/react-progress';
import { TailoredInstructionWithRequirements, InterviewQuestion, InterviewFeedback, CompanyContext } from "../../types";
import { useFeatureStore } from "../../stores/featureStore";

interface MockInterviewViewProps {
  resumeText: string;
  jobDescription: string;
  instruction: TailoredInstructionWithRequirements;
  companyContext?: CompanyContext | null;
}

type InterviewStep = 'idle' | 'generating' | 'answering' | 'feedback';

export default function MockInterviewView({ resumeText, jobDescription, instruction, companyContext }: MockInterviewViewProps) {
  // ── Store state ──
  const { result: questions, loading: isGenerating, error, answers, feedbacks } = useFeatureStore(s => s.interview);
  const storeGenerateQuestions = useFeatureStore(s => s.generateInterviewQuestions);
  const storeSubmitAnswer = useFeatureStore(s => s.submitInterviewAnswer);

  // ── Local UI state ──
  const [step, setStep] = useState<InterviewStep>(() => {
    if (isGenerating) return 'generating';
    if (questions && questions.length > 0) return 'answering';
    return 'idle';
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [showStarGuide, setShowStarGuide] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<'technical' | 'behavioral'>('technical');

  // ── Sync store → local ──
  // 새 질문 세트(직접 생성 또는 '면접 준비' 파이프라인)가 들어오면 로컬 진행 상태를 초기화한다.
  // store의 answers/feedbacks는 setInterviewQuestions에서 이미 비워지므로, 로컬 진행위치·피드백·
  // 미제출 초안이 남아 새 질문에 옛 피드백이 붙는 desync를 막는다. (마운트 시에는 발동하지 않음)
  const prevQuestionsRef = useRef(questions);
  useEffect(() => {
    if (questions && questions !== prevQuestionsRef.current) {
      setCurrentQuestionIndex(0);
      setUserAnswer("");
      setFeedback(null);
      setShowStarGuide(false);
      setStep('answering');
    }
    prevQuestionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    if (isGenerating && step === 'idle') setStep('generating');
  }, [isGenerating]);

  const questionsList = questions ?? [];
  const currentQuestion = questionsList[currentQuestionIndex];
  const technicalQuestions = questionsList.filter(q => q.type === 'technical');
  const behavioralQuestions = questionsList.filter(q => q.type === 'behavioral');
  const displayQuestions = activeTab === 'technical' ? technicalQuestions : behavioralQuestions;

  const completedCount = Object.keys(feedbacks).length;
  const progressPercentage = questionsList.length > 0 ? (completedCount / questionsList.length) * 100 : 0;

  const handleGenerateQuestions = async () => {
    setStep('generating');
    try {
      await storeGenerateQuestions(resumeText, jobDescription, instruction, companyContext);
      setStep('answering');
      setCurrentQuestionIndex(0);
    } catch {
      setStep('idle');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !userAnswer.trim()) {
      alert("답변을 입력해주세요.");
      return;
    }

    setIsEvaluating(true);

    try {
      const fb = await storeSubmitAnswer(currentQuestion, userAnswer, resumeText, jobDescription);
      setFeedback(fb);
      setStep('feedback');
    } catch {
      // error is set in the store
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questionsList.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer("");
      setFeedback(null);
      setShowStarGuide(false);
      setStep('answering');
    } else {
      // All questions completed
      setStep('idle');
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setUserAnswer(answers[questionsList[index]?.id] || "");
    setFeedback(feedbacks[questionsList[index]?.id] || null);
    setShowStarGuide(false);
    setStep(feedbacks[questionsList[index]?.id] ? 'feedback' : 'answering');
  };

  if (step === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-10 shadow-2xl border border-slate-700/50">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              AI 모의면접
            </h1>
            <p className="text-slate-300 text-lg mb-8">
              채용 공고와 이력서를 분석하여 예상 면접 질문을 생성하고, 실전처럼 연습해보세요.
              <br />
              AI 면접관이 답변을 평가하고 구체적인 피드백을 제공합니다.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {completedCount > 0 && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
                <p className="text-green-400">
                  이전 세션에서 {completedCount}/{questionsList.length}개 질문을 완료했습니다.
                </p>
              </div>
            )}

            <button
              onClick={handleGenerateQuestions}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              면접 질문 생성 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-slate-600 border-t-blue-500 mb-6"></div>
          <p className="text-xl text-slate-300">면접 질문을 생성하고 있습니다...</p>
          <p className="text-sm text-slate-400 mt-2">JD와 이력서를 분석하여 맞춤형 질문을 만들고 있어요.</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-300">질문을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">진행도</span>
            <span className="text-sm font-semibold text-blue-400">{completedCount}/{questionsList.length} 완료</span>
          </div>
          <Progress.Root className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden" value={progressPercentage}>
            <Progress.Indicator
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </Progress.Root>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: Question List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-slate-700/50 sticky top-8">
              <h2 className="text-lg font-bold mb-4 text-slate-200">질문 목록</h2>

              {/* Tab Buttons */}
              <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as 'technical' | 'behavioral')}>
                <Tabs.List className="flex gap-2 mb-4">
                  <Tabs.Trigger
                    value="technical"
                    className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=inactive]:bg-slate-700/50 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-700"
                  >
                    기술면접 ({technicalQuestions.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="behavioral"
                    className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=inactive]:bg-slate-700/50 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-700"
                  >
                    인성면접 ({behavioralQuestions.length})
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayQuestions.map((q, idx) => {
                  const globalIndex = questionsList.findIndex(qq => qq.id === q.id);
                  const isCompleted = !!feedbacks[q.id];
                  const isCurrent = globalIndex === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleJumpToQuestion(globalIndex)}
                      className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                        isCurrent
                          ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                          : isCompleted
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                          : 'bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <span className="line-clamp-2">{q.question}</span>
                      </div>
                      {isCompleted && (
                        <div className="text-xs text-green-400 mt-1 ml-6">점수: {feedbacks[q.id].score}/100</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main: Question & Answer */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700/50">
              {/* Question Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      currentQuestion.type === 'technical'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    }`}
                  >
                    {currentQuestion.type === 'technical' ? '기술면접' : '인성면접'}
                  </span>
                  <span className="text-slate-400 text-sm">
                    질문 {currentQuestionIndex + 1}/{questionsList.length}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{currentQuestion.question}</h2>
                <p className="text-slate-400 text-sm">
                  <span className="font-semibold text-slate-300">질문 의도:</span> {currentQuestion.intent}
                </p>
              </div>

              {/* JD Requirements */}
              {currentQuestion.relatedJdRequirements.length > 0 && (
                <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
                  <p className="text-xs font-semibold text-slate-300 mb-2">관련 JD 요구사항:</p>
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.relatedJdRequirements.map((req, idx) => (
                      <span key={idx} className="text-xs bg-slate-600/50 text-slate-300 px-2 py-1 rounded">
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {step === 'answering' && (
                <>
                  {/* Answer Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">답변 작성</label>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="면접 답변을 작성해주세요. STAR 기법을 활용하면 더 좋은 평가를 받을 수 있습니다."
                      className="w-full h-48 bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>

                  {/* STAR Guide Toggle */}
                  <div className="mb-6">
                    <button
                      onClick={() => setShowStarGuide(!showStarGuide)}
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showStarGuide ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      STAR 가이드 보기
                    </button>

                    {showStarGuide && (
                      <div className="mt-4 bg-slate-700/30 rounded-lg p-5 space-y-3 border border-slate-600/50">
                        <div>
                          <h4 className="text-xs font-bold text-green-400 mb-1">S (Situation) - 상황</h4>
                          <p className="text-sm text-slate-300">{currentQuestion.starGuide.situation}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-blue-400 mb-1">T (Task) - 과제</h4>
                          <p className="text-sm text-slate-300">{currentQuestion.starGuide.task}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-purple-400 mb-1">A (Action) - 행동</h4>
                          <p className="text-sm text-slate-300">{currentQuestion.starGuide.action}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-orange-400 mb-1">R (Result) - 결과</h4>
                          <p className="text-sm text-slate-300">{currentQuestion.starGuide.result}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sample Answer */}
                  <div className="mb-6 bg-slate-700/20 rounded-lg p-4 border border-slate-600/30">
                    <p className="text-xs font-semibold text-slate-400 mb-1">모범 답변 예시:</p>
                    <p className="text-sm text-slate-300">{currentQuestion.sampleAnswer}</p>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isEvaluating || !userAnswer.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isEvaluating ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        평가 중...
                      </>
                    ) : (
                      '피드백 받기'
                    )}
                  </button>
                </>
              )}

              {step === 'feedback' && feedback && (
                <>
                  {/* Score Display */}
                  <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-4 border-blue-500/50 mb-4">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-white">{feedback.score}</div>
                        <div className="text-xs text-slate-400">/ 100</div>
                      </div>
                    </div>
                    <p className="text-slate-300 text-sm">
                      {feedback.score >= 80
                        ? '훌륭한 답변입니다!'
                        : feedback.score >= 60
                        ? '좋은 답변입니다. 몇 가지 보완하면 더 좋을 것 같습니다.'
                        : '답변을 보완해보세요.'}
                    </p>
                  </div>

                  {/* Strengths */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      강점
                    </h3>
                    <div className="space-y-2">
                      {feedback.strengths.map((strength, idx) => (
                        <div key={idx} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                          <p className="text-sm text-green-300">{strength}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Improvements */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-orange-400 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      개선점
                    </h3>
                    <div className="space-y-2">
                      {feedback.improvements.map((improvement, idx) => (
                        <div key={idx} className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                          <p className="text-sm text-orange-300">{improvement}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Revised Answer */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-blue-400 mb-3">수정된 답변 제안</h3>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                        {feedback.revisedAnswer}
                      </p>
                    </div>
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNextQuestion}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {currentQuestionIndex < questionsList.length - 1 ? '다음 질문으로' : '면접 종료'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
