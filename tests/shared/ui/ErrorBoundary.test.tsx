import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('터졌어요');
  return <div>ok-child</div>;
}

describe('ErrorBoundary', () => {
  // React logs caught errors; silence to keep test output clean
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('에러가 없으면 children을 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('ok-child')).toBeInTheDocument();
  });

  it('자식이 throw하면 기본 fallback UI를 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
    expect(screen.getByText('터졌어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('custom fallback prop을 사용한다', () => {
    render(
      <ErrorBoundary fallback={<div>custom-fallback</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText('오류가 발생했습니다')).not.toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 에러 상태가 초기화된다', async () => {
    const user = userEvent.setup();

    // 먼저 에러 상태를 만들어본다
    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();

    // 다음 렌더에서 자식은 throw하지 않도록 바꾼 후, 버튼 클릭으로 상태 reset
    rerender(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    // 여전히 hasError 상태라 fallback 표시됨 (reset 전)
    const resetBtn = screen.getByRole('button', { name: '다시 시도' });
    await user.click(resetBtn);

    // reset 후 children 렌더
    expect(screen.getByText('ok-child')).toBeInTheDocument();
    expect(screen.queryByText('오류가 발생했습니다')).not.toBeInTheDocument();
  });
});
