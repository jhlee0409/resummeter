import React, { useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { CoachingResult, UserInputData, TailoredInstructionWithRequirements, NarrativeFramework, NarrativeSectionSpec, NarrativeGenerationResult } from '../types';
import { useFeatureStore } from '../stores/featureStore';
import { InsightCard } from './InsightCard';
import { ScoreDashboard } from './ScoreDashboard';
import { GapMapView } from './GapMapView';
import { ActionItemCard } from './ActionItemCard';
import { NarrativeConfigPanel } from './NarrativeConfigPanel';
import { NarrativeSectionView } from './NarrativeSectionView';
import { generateNarrativeSections } from '../features/narrative/service';
import * as Diff from 'diff';
import { marked } from 'marked';
import { PipelinePanel } from './PipelinePanel';
import type { PipelineResults } from '../features/review/services/pipelineService';
import { analyzeAtsScore, analyzeDetailedScore } from '../features/ats-score/service';
import { track } from '../shared/lib/analytics';
import { printAsPdf, downloadAsWord } from '../shared/lib/exportDocument';
import { toast } from 'sonner';
import type { AtsScore, DetailedScore } from '../types';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';

// Lazy-loaded tab components
const EvidenceBankView = lazy(() => import('./EvidenceBankView').then(m => ({ default: m.EvidenceBankView })));
const AtsScoreView = lazy(() => import('./AtsScoreView'));
const DetailedScoreView = lazy(() => import('./DetailedScoreView'));
const CareerStatementView = lazy(() => import('../features/career-statement/CareerStatementView').then(m => ({ default: m.CareerStatementView })));
const CoverLetterView = lazy(() => import('../features/cover-letter/CoverLetterView').then(m => ({ default: m.CoverLetterView })));
const MockInterviewView = lazy(() => import('../features/interview/MockInterviewView'));
const SkillGapView = lazy(() => import('../features/skill-gap/SkillGapView'));
const LinkedInOptView = lazy(() => import('../features/linkedin/LinkedInOptView'));
const VersionManagerView = lazy(() => import('../features/versions/VersionManagerView'));
const AboutStatementView = lazy(() => import('../features/about-statement/AboutStatementView').then(m => ({ default: m.AboutStatementView })));
const PractitionerSimView = lazy(() => import('../features/practitioner/PractitionerSimView').then(m => ({ default: m.PractitionerSimView })));
const ExampleBrowserView = lazy(() => import('../features/examples/ExampleBrowserView').then(m => ({ default: m.ExampleBrowserView })));
const GapAnalysisView = lazy(() => import('../features/gap-analysis/GapAnalysisView').then(m => ({ default: m.GapAnalysisView })));

const TabLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
  </div>
);

interface ReviewStepProps {
  originalData: UserInputData;
  result: CoachingResult;
  instruction: TailoredInstructionWithRequirements;
  onRestart: () => void;
  /** 편집한 이력서로 코칭/점수를 다시 계산한다. */
  onReanalyze?: (currentResume: string) => Promise<void>;
}

type ReviewTab = 'gap-map' | 'actions' | 'evidence' | 'resume' | 'narrative' | 'ats-score' | 'detailed-score' | 'career-statement' | 'cover-letter' | 'interview' | 'skill-gap' | 'linkedin' | 'versions' | 'about-statement' | 'practitioner' | 'examples' | 'gap-analysis';

export const ReviewStep: React.FC<ReviewStepProps> = ({ originalData, result, instruction, onRestart, onReanalyze }) => {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>('gap-map');
  const [visitedTabs, setVisitedTabs] = useState<Set<ReviewTab>>(new Set(['gap-map']));

  const [editedResume, setEditedResume] = useState(result.optimizedResume);
  const [resumeSubTab, setResumeSubTab] = useState<'editor' | 'preview' | 'diff'>('editor');
  const [copied, setCopied] = useState(false);
  const [acceptedActions, setAcceptedActions] = useState<Set<string>>(new Set());
  const [highlightedGap, setHighlightedGap] = useState<string | null>(null);

  // Narrative state
  const [narrativeFramework, setNarrativeFramework] = useState<NarrativeFramework>('k-star-k');
  const [narrativeSpecs, setNarrativeSpecs] = useState<NarrativeSectionSpec[]>([]);
  const [narrativeResult, setNarrativeResult] = useState<NarrativeGenerationResult | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeProgress, setNarrativeProgress] = useState<{ completed: number; total: number } | undefined>();

  // ATS & Scoring state
  const [atsScore, setAtsScore] = useState<AtsScore | null>(null);
  const [isLoadingAts, setIsLoadingAts] = useState(false);
  const [prevAtsScore, setPrevAtsScore] = useState<number | null>(null);
  const atsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced ATS re-analysis after coaching changes
  const triggerAtsReanalysis = useCallback((newResumeText: string) => {
    if (atsDebounceRef.current) clearTimeout(atsDebounceRef.current);
    atsDebounceRef.current = setTimeout(async () => {
      if (atsScore) setPrevAtsScore(atsScore.overall);
      setIsLoadingAts(true);
      try {
        const newScore = await analyzeAtsScore(newResumeText, originalData.jobDescription, JSON.stringify(instruction), originalData.companyContext);
        setAtsScore(newScore);
      } catch (e) {
        console.warn('ATS re-analysis failed:', e);
      } finally {
        setIsLoadingAts(false);
      }
    }, 1500);
  }, [atsScore, originalData.jobDescription, instruction]);
  const [detailedScore, setDetailedScore] = useState<DetailedScore | null>(null);
  const [isLoadingDetailed, setIsLoadingDetailed] = useState(false);


  const handleFrameworkChange = (fw: NarrativeFramework) => {
    setNarrativeFramework(fw);
    setNarrativeSpecs([]);
    setNarrativeResult(null);
  };

  const handleGenerateNarrative = async () => {
    track({ type: 'narrative_generate', sectionCount: narrativeSpecs.length, framework: narrativeFramework });
    setIsGeneratingNarrative(true);
    try {
      const narrativeGenResult = await generateNarrativeSections(
        narrativeSpecs, instruction, editedResume,
        originalData.jobDescription, originalData.githubRepos,
        originalData.githubData, result,
        (completed, total) => setNarrativeProgress({ completed, total }),
        originalData.companyContext,
      );
      setNarrativeResult(narrativeGenResult);
    } finally {
      setIsGeneratingNarrative(false);
      setNarrativeProgress(undefined);
    }
  };

  // ATS analysis
  const handleAnalyzeAts = async () => {
    track({ type: 'ats_analyze' });
    setIsLoadingAts(true);
    try {
      const score = await analyzeAtsScore(editedResume, originalData.jobDescription, JSON.stringify(instruction), originalData.companyContext);
      setAtsScore(score);
    } catch (e) { console.error(e); }
    finally { setIsLoadingAts(false); }
  };

  // Detailed scoring
  const handleAnalyzeDetailed = async () => {
    track({ type: 'detailed_score_analyze' });
    setIsLoadingDetailed(true);
    try {
      const score = await analyzeDetailedScore(editedResume, originalData.jobDescription, JSON.stringify(instruction), originalData.companyContext);
      setDetailedScore(score);
    } catch (e) { console.error(e); }
    finally { setIsLoadingDetailed(false); }
  };


  const toggleAction = (actionId: string) => {
    const action = result.actionItems.find(a => a.id === actionId);
    if (!action) return;

    const isAccepting = !acceptedActions.has(actionId);

    // no-op 가드: before→after 액션인데 원본 문장이 이미 사라진 경우 '적용'으로 카운트하지 않음
    // (side-effect를 setState 업데이터 밖에서 처리 — StrictMode 이중 실행 회피)
    if (isAccepting && action.before && action.after && !editedResume.includes(action.before)) {
      toast.error('원본 문장을 찾지 못해 적용하지 않았습니다 (이미 수정됨)');
      return;
    }

    track({ type: 'coaching_apply', actionId, accepted: isAccepting });
    setAcceptedActions(prev => {
      const next = new Set(prev);
      isAccepting ? next.add(actionId) : next.delete(actionId);
      return next;
    });

    // Apply or revert the action's before→after replacement in the resume
    if (action.before && action.after) {
      const updated = isAccepting
        ? (editedResume.includes(action.before) ? editedResume.replace(action.before, action.after) : editedResume)
        : (editedResume.includes(action.after) ? editedResume.replace(action.after, action.before) : editedResume);
      setEditedResume(updated);
      if (atsScore) triggerAtsReanalysis(updated); // 점수 있으면 편집 반영 재채점
    }
  };

  const handleDownload = () => {
    track({ type: 'resume_download', format: 'markdown' });
    const element = document.createElement("a");
    const file = new Blob([editedResume], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = "optimized-resume.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportPdf = () => {
    track({ type: 'resume_download', format: 'pdf' });
    printAsPdf('최적화 이력서', editedResume);
  };

  const handleExportWord = () => {
    track({ type: 'resume_download', format: 'word' });
    downloadAsWord('optimized-resume', '최적화 이력서', editedResume);
  };

  const handleReanalyzeClick = async () => {
    if (!onReanalyze || isReanalyzing) return;
    setIsReanalyzing(true);
    try {
      await onReanalyze(editedResume);
      setAcceptedActions(new Set()); // 새 분석 결과 → 이전 수락 상태 초기화
      toast.success('현재 이력서로 재분석했습니다 — 점수와 제안이 갱신되었습니다');
    } catch (e) {
      console.error(e);
      toast.error('재분석 중 오류가 발생했습니다');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedResume);
      track({ type: 'resume_copy' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const diffElements = useMemo(() => {
    if (resumeSubTab !== 'diff') return null;
    const diff = Diff.diffWords(originalData.resumeText, editedResume);
    return diff.map((part, index) => {
      if (part.added) {
        return (
          <span key={index} className="bg-emerald-500/15 text-emerald-400 font-medium px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      if (part.removed) {
        return (
          <span key={index} className="bg-red-500/15 text-red-400 line-through opacity-50 px-0.5 rounded-sm">
            {part.value}
          </span>
        );
      }
      return (
        <span key={index} className="text-zinc-500">
          {part.value}
        </span>
      );
    });
  }, [resumeSubTab, originalData.resumeText, editedResume]);

  const sortedActionItems = useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...(result.actionItems || [])].sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
  }, [result.actionItems]);

  const hasEvidence =
    originalData.githubRepos.some(r => r.url.trim() !== '') ||
    (originalData.evidenceInputs?.length ?? 0) > 0 ||
    ((result.evidenceBank?.repos.length ?? 0) > 0) ||
    ((result.evidenceBank?.highlights.length ?? 0) > 0);

  const tabGroups: Array<{ key: string; label: string; tabs: Array<{ key: ReviewTab; label: string; icon: string }> }> = [
    { key: 'core', label: '핵심 분석', tabs: [
      { key: 'gap-map', label: 'Gap Map', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { key: 'gap-analysis', label: '역량 갭', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { key: 'actions', label: '코칭 제안', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { key: 'resume', label: '이력서', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { key: 'ats-score', label: 'ATS', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { key: 'detailed-score', label: '상세 점수', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { key: 'practitioner', label: '실무자 시선', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    ]},
    { key: 'application', label: '지원서 작성', tabs: [
      { key: 'narrative', label: '서술형', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
      { key: 'career-statement', label: '경력기술서', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { key: 'cover-letter', label: '커버레터', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    ]},
    { key: 'interview', label: '면접 준비', tabs: [
      { key: 'interview', label: '모의면접', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      { key: 'skill-gap', label: '학습 경로', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    ]},
    { key: 'branding', label: '개인 브랜딩', tabs: [
      { key: 'linkedin', label: 'LinkedIn', icon: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2V9zm2-2a2 2 0 110-4 2 2 0 010 4z' },
      { key: 'about-statement', label: '한줄소개', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ]},
    { key: 'utilities', label: '부가 기능', tabs: [
      ...(hasEvidence ? [{ key: 'evidence' as ReviewTab, label: '보유 근거', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' }] : []),
      { key: 'examples', label: '합격 사례', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
      { key: 'versions', label: '버전 관리', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    ]},
  ];

  const [activeGroup, setActiveGroup] = useState<string>('core');

  const tabToGroup = useMemo(() => {
    const map: Record<string, string> = {};
    tabGroups.forEach(g => g.tabs.forEach(t => { map[t.key] = g.key; }));
    return map;
  }, [hasEvidence]);

  const currentGroupTabs = tabGroups.find(g => g.key === activeGroup)?.tabs ?? [];

  const switchTab = (tab: ReviewTab) => {
    if (tab !== activeTab) track({ type: 'tab_switch', from: activeTab, to: tab });
    setActiveTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab)); // keep-alive: 방문한 탭은 마운트 유지
    const group = tabToGroup[tab];
    if (group) setActiveGroup(group);
  };

  const switchGroup = (groupKey: string) => {
    setActiveGroup(groupKey);
    const group = tabGroups.find(g => g.key === groupKey);
    if (group && group.tabs.length > 0 && !group.tabs.some(t => t.key === activeTab)) {
      const first = group.tabs[0].key;
      setActiveTab(first);
      setVisitedTabs(prev => new Set(prev).add(first));
    }
  };

  const handleActionClick = (requirement: string) => {
    setHighlightedGap(requirement);
    switchTab('actions');
  };

  const handleInsertNarrative = (title: string, content: string) => {
    track({ type: 'narrative_insert_resume', title });
    const section = `\n\n## ${title}\n\n${content}`;
    const next = editedResume + section;
    setEditedResume(next);
    if (atsScore) triggerAtsReanalysis(next); // 삽입도 편집이므로 ATS 재채점
    toast.success(`"${title}" 이력서에 삽입됨`);
    switchTab('resume');
  };

  const isActionHighlighted = (item: typeof result.actionItems[number]) => {
    if (!highlightedGap) return false;
    const gap = highlightedGap.toLowerCase();
    return (
      item.targetSection.toLowerCase().includes(gap) ||
      item.suggestion.toLowerCase().includes(gap) ||
      item.before.toLowerCase().includes(gap) ||
      item.evidence.some(e => e.content.toLowerCase().includes(gap))
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* Summary */}
      {result.summary && (
        <div className="glass-card border-brand-500/20 rounded-2xl px-5 py-4">
          <p className="text-[13px] text-brand-300 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Score Dashboard */}
      <ScoreDashboard result={result} originalData={originalData} atsScore={atsScore?.overall ?? null} prevAtsScore={prevAtsScore} isLoadingAts={isLoadingAts} />

      {onReanalyze && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-1">
          <p className="text-[11px] text-zinc-500">이력서를 수정했다면 현재 내용으로 점수·gap·코칭 제안을 다시 계산하세요.</p>
          <button
            onClick={handleReanalyzeClick}
            disabled={isReanalyzing}
            className="shrink-0 text-[12px] px-3.5 py-1.5 rounded-lg border border-brand-500/30 text-brand-300 hover:bg-brand-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isReanalyzing ? '재분석 중…' : '현재 이력서로 재분석'}
          </button>
        </div>
      )}

      {/* Pipeline Panel */}
      <PipelinePanel
        resumeText={editedResume}
        jobDescription={originalData.jobDescription}
        instruction={instruction}
        coachingResult={result}
        companyContext={originalData.companyContext}
        githubData={originalData.githubData}
        githubRepos={originalData.githubRepos}
        onNavigate={(tab) => switchTab(tab as ReviewTab)}
        confirmRun={(type) => {
          // 면접 준비 파이프라인은 질문을 재생성하므로 기존 답변/피드백이 초기화된다.
          if (type === 'interview-prep') {
            const answered = Object.keys(useFeatureStore.getState().interview.feedbacks).length;
            if (answered > 0) {
              return window.confirm(
                `이미 답변한 면접 질문 ${answered}개가 있습니다.\n새 질문을 생성하면 기존 답변과 피드백이 모두 초기화됩니다.\n계속할까요?`
              );
            }
          }
          return true;
        }}
        onRun={(type, results) => {
          if (results.atsScore) {
            setPrevAtsScore(atsScore?.overall ?? null);
            setAtsScore(results.atsScore);
          }
          if (results.careerStatements) {
            useFeatureStore.getState().setCareerStatementResult(results.careerStatements);
            switchTab('career-statement');
          }
          if (results.coverLetter) {
            useFeatureStore.getState().setCoverLetterResult(results.coverLetter);
            switchTab('cover-letter');
          }
          if (results.narrativeSections) {
            setNarrativeResult(results.narrativeSections);
            if (results.narrativeSpecs) setNarrativeSpecs(results.narrativeSpecs);
            switchTab('narrative');
          }
          if (results.interviewQuestions) {
            useFeatureStore.getState().setInterviewQuestions(results.interviewQuestions);
            switchTab('interview');
          }
          if (results.linkedinOptimization) {
            useFeatureStore.getState().setLinkedInResult(results.linkedinOptimization);
            switchTab('linkedin');
          }
          if (results.practitionerReview) {
            useFeatureStore.getState().setPractitionerResult(results.practitionerReview);
            switchTab('practitioner');
          }
        }}
      />

      {/* Tab Bar — 2-level navigation */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Row 1: Group Pills */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.04] overflow-x-auto custom-scrollbar">
          {tabGroups.map((group) => (
            <button
              key={group.key}
              onClick={() => switchGroup(group.key)}
              className={`px-3 py-2 min-h-[40px] text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeGroup === group.key
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
        {/* Row 2: Tabs within selected group */}
        <div className="flex border-b border-white/[0.06] overflow-x-auto custom-scrollbar">
          {currentGroupTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { switchTab(tab.key); if (tab.key !== 'actions') setHighlightedGap(null); }}
              className={`flex items-center justify-center gap-1.5 px-3 py-3 min-h-[44px] text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Gap Map Tab */}
          <div className={activeTab !== 'gap-map' ? 'hidden' : ''}>
            <GapMapView gapMap={result.gapMap} onActionClick={handleActionClick} />
          </div>

          {/* Gap Analysis Tab */}
          {activeTab === 'gap-analysis' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <GapAnalysisView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Actions Tab */}
          <div className={activeTab !== 'actions' ? 'hidden' : ''}>
            <div className="space-y-6">
              {/* Quick Wins */}
              {result.quickWins.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-[13px] font-bold text-zinc-300">빠른 개선 포인트</h3>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {result.quickWins.map((win, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-zinc-400 leading-relaxed">
                        <span className="text-amber-400 mt-0.5 shrink-0">&#9679;</span>
                        {win}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-zinc-300">코칭 액션 아이템</h3>
                  <span className="text-[10px] text-zinc-600">
                    {acceptedActions.size}/{sortedActionItems.length} 적용
                  </span>
                </div>
                <div className="space-y-3">
                  {sortedActionItems.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      item={item}
                      accepted={acceptedActions.has(item.id)}
                      onToggle={() => toggleAction(item.id)}
                      highlighted={isActionHighlighted(item)}
                    />
                  ))}
                </div>
              </div>

              {/* Insights */}
              {result.insights.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-300 mb-3">보조 인사이트</h3>
                  <div className="space-y-2">
                    {result.insights.map((insight, idx) => (
                      <InsightCard key={idx} insight={insight} index={idx} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evidence Tab */}
          {activeTab === 'evidence' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <EvidenceBankView evidenceBank={result.evidenceBank} />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Narrative Tab */}
          <div className={activeTab !== 'narrative' ? 'hidden' : ''}>
            <div className="space-y-4">
              {narrativeResult ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-zinc-300">생성된 서술형 항목</h3>
                    <button
                      onClick={() => setNarrativeResult(null)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      다시 설정
                    </button>
                  </div>
                  <NarrativeSectionView sections={narrativeResult.sections} specs={narrativeSpecs} onInsertToResume={handleInsertNarrative} />
                </div>
              ) : (
                <NarrativeConfigPanel
                  specs={narrativeSpecs}
                  framework={narrativeFramework}
                  onFrameworkChange={handleFrameworkChange}
                  onChange={setNarrativeSpecs}
                  onGenerate={handleGenerateNarrative}
                  isGenerating={isGeneratingNarrative}
                  progress={narrativeProgress}
                />
              )}
            </div>
          </div>

          {/* ATS Score Tab */}
          {activeTab === 'ats-score' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                {atsScore ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button
                        onClick={handleAnalyzeAts}
                        disabled={isLoadingAts}
                        className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
                      >
                        {isLoadingAts ? '재분석 중...' : '현재 이력서로 재분석'}
                      </button>
                    </div>
                    <AtsScoreView atsScore={atsScore} />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <button
                      onClick={handleAnalyzeAts}
                      disabled={isLoadingAts}
                      className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg font-semibold hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {isLoadingAts ? '분석 중...' : 'ATS 점수 분석'}
                    </button>
                  </div>
                )}
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Detailed Score Tab */}
          {activeTab === 'detailed-score' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                {detailedScore ? (
                  <DetailedScoreView detailedScore={detailedScore} />
                ) : (
                  <div className="text-center py-12">
                    <button
                      onClick={handleAnalyzeDetailed}
                      disabled={isLoadingDetailed}
                      className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg font-semibold hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {isLoadingDetailed ? '분석 중...' : '상세 점수 분석'}
                    </button>
                  </div>
                )}
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Career Statement Tab */}
          {activeTab === 'career-statement' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <CareerStatementView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  githubData={originalData.githubData}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Cover Letter Tab */}
          {/* keep-alive: 방문 후 마운트 유지 → 설정/초안 보존 */}
          {visitedTabs.has('cover-letter') && (
            <div className={activeTab === 'cover-letter' ? '' : 'hidden'}>
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <CoverLetterView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  coachingResult={result}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
            </div>
          )}

          {/* Interview Tab — keep-alive: 진행위치/미제출 답변 초안 보존 */}
          {visitedTabs.has('interview') && (
            <div className={activeTab === 'interview' ? '' : 'hidden'}>
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <MockInterviewView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
            </div>
          )}

          {/* Skill Gap Tab */}
          {activeTab === 'skill-gap' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <SkillGapView
                  gapMap={result.gapMap}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* LinkedIn Tab */}
          {activeTab === 'linkedin' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <LinkedInOptView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Examples Tab */}
          {activeTab === 'examples' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <ExampleBrowserView />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Versions Tab */}
          {activeTab === 'versions' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <VersionManagerView
                  currentResumeText={editedResume}
                  currentJobDescription={originalData.jobDescription}
                  currentScore={atsScore?.overall}
                  onRestore={(text) => { setEditedResume(text); toast.success('이 버전을 에디터로 불러왔습니다'); switchTab('resume'); }}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Practitioner Simulation Tab */}
          {activeTab === 'practitioner' && (
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <PractitionerSimView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* About Statement Tab */}
          {/* keep-alive: 한줄소개 입력 초안 보존 */}
          {visitedTabs.has('about-statement') && (
            <div className={activeTab === 'about-statement' ? '' : 'hidden'}>
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                <AboutStatementView
                  resumeText={editedResume}
                  jobDescription={originalData.jobDescription}
                  instruction={instruction}
                  coachingResult={result}
                  companyContext={originalData.companyContext}
                />
              </Suspense>
            </ErrorBoundary>
            </div>
          )}

          {/* Resume Tab */}
          <div className={activeTab !== 'resume' ? 'hidden' : ''}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Original */}
              <div className="lg:col-span-3 hidden lg:block">
                <div className="glass-card rounded-xl h-[500px] flex flex-col overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">원본</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto text-[12px] text-zinc-500 font-mono whitespace-pre-wrap p-3 custom-scrollbar leading-relaxed">
                    {originalData.resumeText}
                  </div>
                </div>
              </div>

              {/* Center: Editor */}
              <div className="lg:col-span-9">
                <div className="glass-card rounded-xl border-brand-500/20 overflow-hidden flex flex-col h-[500px]">
                  <div className="px-4 py-2.5 border-b border-brand-500/15 bg-brand-500/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="text-[12px] font-bold text-brand-300">코칭 적용 이력서</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-brand-500/10 rounded-lg p-0.5">
                        {(['editor', 'preview', 'diff'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setResumeSubTab(tab)}
                            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${resumeSubTab === tab ? 'bg-dark-700 text-brand-300 shadow-sm' : 'text-brand-500/50 hover:text-brand-400'}`}
                          >
                            {{ editor: '에디터', preview: '프리뷰', diff: '변경사항' }[tab]}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 bg-dark-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-all flex items-center gap-1"
                      >
                        {copied ? '복사됨 ✓' : '복사'}
                      </button>
                    </div>
                  </div>

                  {resumeSubTab === 'editor' ? (
                    <textarea
                      className="flex-1 w-full p-4 text-sm text-zinc-200 leading-relaxed resize-none focus:outline-none bg-transparent custom-scrollbar"
                      value={editedResume}
                      onChange={(e) => { const v = e.target.value; setEditedResume(v); if (atsScore) triggerAtsReanalysis(v); }}
                    />
                  ) : resumeSubTab === 'preview' ? (
                    <div
                      className="flex-1 w-full p-4 text-sm leading-relaxed overflow-y-auto bg-transparent custom-scrollbar md-preview"
                      dangerouslySetInnerHTML={{ __html: marked(editedResume) as string }}
                    />
                  ) : (
                    <div className="flex-1 w-full p-4 text-sm leading-relaxed overflow-y-auto bg-dark-800/50 custom-scrollbar whitespace-pre-wrap font-mono">
                      {diffElements}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRestart}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 font-medium flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          처음부터 다시
        </button>
        <button
          onClick={handleExportWord}
          className="px-3 py-2 text-[11px] font-semibold text-zinc-300 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
        >
          Word
        </button>
        <button
          onClick={handleDownload}
          className="px-3 py-2 text-[11px] font-semibold text-zinc-300 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
        >
          Markdown
        </button>
        <button
          onClick={handleExportPdf}
          className="px-4 py-2 text-[11px] font-bold text-white bg-gradient-to-r from-brand-500 to-brand-600 rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all shadow-md shadow-brand-500/30 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PDF로 내보내기
        </button>
      </div>
    </div>
  );
};
