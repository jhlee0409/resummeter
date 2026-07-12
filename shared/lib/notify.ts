/**
 * 사용자 대면 에러 표준화 — 어떤 에러든 친화적 메시지로 분류해 일관된 토스트로 노출.
 * rate-limit/timeout 등 재시도 가능한 실패에는 '재시도' 액션을 붙인다.
 * (기존: alert / 조용한 console.error가 곳곳에 흩어져 있었음)
 */

import { toast } from 'sonner';
import { classifyError, GeminiAPIError } from './errors';

interface NotifyOptions {
  /** 재시도 가능한 에러에 붙일 재시도 콜백 */
  onRetry?: () => void;
  /** 분류가 UNKNOWN일 때 대체할 메시지 */
  fallback?: string;
}

/**
 * 에러를 분류해 toast.error로 노출하고, 분류된 GeminiAPIError를 반환한다.
 * @returns 분류된 에러(코드/재시도 여부 확인용)
 */
export function notifyError(error: unknown, opts?: NotifyOptions): GeminiAPIError {
  const err = error instanceof GeminiAPIError ? error : classifyError(error);
  const message = opts?.fallback && err.code === 'UNKNOWN' ? opts.fallback : err.userMessage;

  toast.error(message, {
    duration: err.retryable ? 6000 : 5000,
    action:
      opts?.onRetry && err.retryable
        ? { label: '재시도', onClick: opts.onRetry }
        : undefined,
  });

  return err;
}
