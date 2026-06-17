import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreDashboard } from '../../../components/ScoreDashboard';
import type { CoachingResult, UserInputData, ScoringResult } from '../../../types';

const baseUserInput: UserInputData = {
  resumeText: 'resume',
  jobDescription: 'jd',
  companyName: 'Acme',
  jobTitle: 'FE',
  githubRepos: [],
};

function makeResult(overrides: Partial<CoachingResult> = {}): CoachingResult {
  return {
    matchScore: 72,
    summary: '요약',
    gapMap: [],
    actionItems: [],
    quickWins: [],
    optimizedResume: '',
    insights: [],
    ...overrides,
  };
}

function makeScoring(overrides: Partial<ScoringResult> = {}): ScoringResult {
  return {
    matchScore: 85,
    level: 'strong_match',
    penalties: [],
    warnings: [],
    breakdown: {
      hardRequirement: 0,
      hardSkill: 0,
      experience: 0,
      softSkill: 0,
      domain: 0,
    },
    ...overrides,
  };
}

describe('ScoreDashboard', () => {
  it('matchScore를 렌더링한다 (scoringResult 없을 때 result.matchScore 사용)', () => {
    const result = makeResult({ matchScore: 72 });
    render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('scoringResult가 있으면 scoring.matchScore가 우선 표시된다', () => {
    const scoring = makeScoring({ matchScore: 85, level: 'strong_match' });
    const result = makeResult({ matchScore: 50, scoringResult: scoring });
    render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('level별 라벨을 LEVEL_LABELS에서 가져와 표시한다', () => {
    const scoring = makeScoring({ level: 'strong_match' });
    const result = makeResult({ scoringResult: scoring });
    const { rerender } = render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.getByText('강력 추천')).toBeInTheDocument();

    rerender(
      <ScoreDashboard
        result={makeResult({ scoringResult: makeScoring({ level: 'conditional' }) })}
        originalData={baseUserInput}
        editedResume=""
      />
    );
    expect(screen.getByText('조건부 추천')).toBeInTheDocument();
  });

  it('scoringResult가 있으면 감점 내역 영역(breakdown)을 보여준다', () => {
    const scoring = makeScoring({
      level: 'conditional',
      breakdown: {
        hardRequirement: 5,
        hardSkill: 10,
        experience: 0,
        softSkill: 0,
        domain: 0,
      },
    });
    const result = makeResult({ scoringResult: scoring });
    render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.getByText('감점 내역')).toBeInTheDocument();
    // breakdown 카테고리 라벨이 보여져야 함 (value > 0 만) — 전 직무 범용화로 '기술 스택'→'핵심 역량'
    expect(screen.getByText('핵심 역량')).toBeInTheDocument();
  });

  it('scoringResult가 없으면 감점 내역을 렌더링하지 않는다', () => {
    const result = makeResult();
    render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.queryByText('감점 내역')).not.toBeInTheDocument();
  });

  it('data_insufficient level이면 breakdown을 숨긴다', () => {
    const scoring = makeScoring({ level: 'data_insufficient' });
    const result = makeResult({ scoringResult: scoring });
    render(<ScoreDashboard result={result} originalData={baseUserInput} editedResume="" />);
    expect(screen.queryByText('감점 내역')).not.toBeInTheDocument();
  });
});
