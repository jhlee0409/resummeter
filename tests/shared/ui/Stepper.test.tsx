import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from '../../../shared/ui/Stepper';
import { AppStep } from '../../../types';

describe('Stepper', () => {
  it('3개 스텝(정보 입력/AI 분석/검토 및 수정)을 렌더링한다', () => {
    render(<Stepper currentStep={AppStep.UPLOAD} />);
    expect(screen.getByText('정보 입력')).toBeInTheDocument();
    expect(screen.getByText('AI 분석')).toBeInTheDocument();
    expect(screen.getByText('검토 및 수정')).toBeInTheDocument();
  });

  it('currentStep이 UPLOAD면 01 번호를 보여주고 완료 체크는 없다', () => {
    const { container } = render(<Stepper currentStep={AppStep.UPLOAD} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    // 완료 체크 SVG는 없어야 함
    expect(container.querySelectorAll('svg').length).toBe(0);
  });

  it('currentStep이 REVIEW면 이전 스텝들은 체크(SVG)로 표시된다', () => {
    const { container } = render(<Stepper currentStep={AppStep.REVIEW} />);
    // UPLOAD(0), ANALYSIS(1) 두 스텝이 완료 → 체크 SVG 2개
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
    // 현재 스텝(REVIEW)의 번호 03은 아직 표시됨
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('AppStep enum 값(숫자)을 currentStep으로 받아들인다', () => {
    // ANALYSIS(1) 전달 시 UPLOAD만 완료
    const { container } = render(<Stepper currentStep={AppStep.ANALYSIS} />);
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('현재 스텝 라벨은 강조 스타일(text-zinc-200)을 가진다', () => {
    render(<Stepper currentStep={AppStep.ANALYSIS} />);
    const currentLabel = screen.getByText('AI 분석');
    expect(currentLabel.className).toContain('text-zinc-200');
  });
});
