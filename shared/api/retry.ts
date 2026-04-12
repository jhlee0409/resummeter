/**
 * Retry with exponential backoff for transient Gemini API failures.
 */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
  timeoutMs = 60000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimited = msg.includes('429') || msg.toLowerCase().includes('rate limit');
      const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('deadline');
      const isRetryable = isRateLimited || isTimeout;

      if (attempt === maxAttempts || !isRetryable) {
        throw e;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`Gemini API retry ${attempt}/${maxAttempts} after ${Math.round(delay)}ms: ${msg.slice(0, 100)}`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}
