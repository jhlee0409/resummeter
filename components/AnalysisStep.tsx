import React, { useEffect, useState } from 'react';

export const AnalysisStep: React.FC = () => {
  const [log, setLog] = useState<string>('AI 에이전트 초기화 중...');
  
  useEffect(() => {
    const logs = [
      "Gemini API 연결 중...",
      "채용 공고(JD) 심층 분석 중...",
      "직무 맞춤형 AI 면접관 페르소나 생성 중...",
      "GitHub 리포지토리 아키텍처 스캔 중...",
      "README.md 문서화 수준 및 가독성 분석 중...",
      "이슈 트래커(Issues) 커뮤니케이션 패턴 분석 중...",
      "PR 히스토리 및 코드 리뷰 참여도 분석 중...",
      "JD 요구사항과 기술적/협업 역량 매칭 중...",
      "한국 기업 정서에 맞춘 이력서 문장 다듬기 중...",
      "최종 최적화 결과물 생성 완료..."
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setLog(logs[i]);
        i++;
      }
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in">
      {/* Pulse Rings */}
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
        <div className="absolute inset-2 bg-blue-500 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        </div>
      </div>

      <h3 className="text-2xl font-bold text-slate-800 mb-2">프로필 최적화 진행 중</h3>
      <p className="text-slate-500 mb-8 max-w-md text-center">
        AI가 직무에 맞는 채용 담당자 페르소나를 생성하고, 지원자의 코드뿐만 아니라 문서화, 소통, 협업 능력까지 종합적으로 분석하고 있습니다.
      </p>

      {/* Terminal Log Output */}
      <div className="w-full max-w-md bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 shadow-xl border border-slate-700">
        <div className="flex space-x-2 mb-3 border-b border-slate-700 pb-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="h-6 overflow-hidden relative">
             <span className="mr-2 text-blue-400">➜</span>
             <span className="animate-pulse">{log}</span>
        </div>
      </div>
    </div>
  );
};