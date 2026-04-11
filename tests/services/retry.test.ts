import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../services/retry';

describe('withRetry', () => {
  it('성공하면 결과를 반환한다', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retryable하지 않은 에러는 즉시 throw', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Some random error'));
    await expect(withRetry(fn, 3, 10)).rejects.toThrow('Some random error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('429 에러는 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rate limit 에러는 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('timeout 에러는 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
  });

  it('deadline 에러는 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Deadline exceeded'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
  });

  it('maxAttempts 도달하면 마지막 에러를 throw', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('429 rate limited'));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow('429 rate limited');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('비-Error 객체도 처리한다', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    await expect(withRetry(fn, 1, 10)).rejects.toBe('string error');
  });

  it('기본 maxAttempts는 3', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout error'));
    await expect(withRetry(fn, undefined, 10)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
