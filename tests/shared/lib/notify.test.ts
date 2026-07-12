import { describe, it, expect, beforeEach, vi } from 'vitest';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import { notifyError } from '../../../shared/lib/notify';
import { GeminiAPIError } from '../../../shared/lib/errors';

describe('notifyError', () => {
  beforeEach(() => toastError.mockClear());

  it('rate-limit 에러를 친화적 메시지로 토스트한다', () => {
    const err = notifyError(new Error('429 Too Many Requests'));
    expect(err.code).toBe('RATE_LIMIT');
    expect(toastError).toHaveBeenCalledOnce();
    const [msg] = toastError.mock.calls[0];
    expect(msg).toContain('한도');
  });

  it('재시도 가능 + onRetry 제공 시 재시도 액션을 붙인다', () => {
    const onRetry = vi.fn();
    notifyError(new Error('rate limit'), { onRetry });
    const [, opts] = toastError.mock.calls[0] as [string, { action?: { label: string; onClick: () => void } }];
    expect(opts.action?.label).toBe('재시도');
    opts.action?.onClick();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('onRetry가 없으면 액션을 붙이지 않는다', () => {
    notifyError(new Error('rate limit'));
    const [, opts] = toastError.mock.calls[0] as [string, { action?: unknown }];
    expect(opts.action).toBeUndefined();
  });

  it('이미 GeminiAPIError면 재분류하지 않고 그대로 사용한다', () => {
    const original = new GeminiAPIError('원본 메시지', 'SCHEMA_MISMATCH', false);
    const err = notifyError(original);
    expect(err).toBe(original);
    expect(toastError.mock.calls[0][0]).toBe('원본 메시지');
    // retryable=false → 액션 없음
    const [, opts] = toastError.mock.calls[0] as [string, { action?: unknown }];
    expect(opts.action).toBeUndefined();
  });

  it('UNKNOWN 코드일 때 fallback 메시지를 사용한다', () => {
    notifyError({ weird: true }, { fallback: '대체 메시지' });
    expect(toastError.mock.calls[0][0]).toBe('대체 메시지');
  });
});
