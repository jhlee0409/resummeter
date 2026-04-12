import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSessionState } from '../../../shared/hooks/useSessionState';

// sessionStorage mock (jsdom provides one, but we control it explicitly for reliability)
const store: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k in store) delete store[k];
  }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

describe('useSessionState', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  it('sessionStorage에 저장된 값이 있으면 그 값으로 초기화한다', () => {
    store['greeting'] = JSON.stringify('hello');
    const { result } = renderHook(() => useSessionState<string>('greeting', 'default'));
    expect(result.current[0]).toBe('hello');
  });

  it('sessionStorage에 없으면 initialValue로 초기화한다', () => {
    const { result } = renderHook(() => useSessionState<number>('count', 42));
    expect(result.current[0]).toBe(42);
  });

  it('setState 호출 시 sessionStorage에 저장된다', () => {
    const { result } = renderHook(() => useSessionState<number>('count', 0));
    act(() => {
      result.current[1](7);
    });
    expect(result.current[0]).toBe(7);
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('count', JSON.stringify(7));
    expect(store['count']).toBe(JSON.stringify(7));
  });

  it('재마운트 시 저장된 값이 복원된다 (렌더 간 유지)', () => {
    const { result: r1, unmount } = renderHook(() => useSessionState<string>('session-key', 'init'));
    act(() => {
      r1.current[1]('updated');
    });
    unmount();

    const { result: r2 } = renderHook(() => useSessionState<string>('session-key', 'init'));
    expect(r2.current[0]).toBe('updated');
  });

  it('JSON.parse 실패 시 initialValue로 폴백한다', () => {
    store['broken'] = '{not valid json';
    const { result } = renderHook(() => useSessionState<string>('broken', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('객체 타입도 직렬화/역직렬화된다', () => {
    const initial = { a: 1, b: 'x' };
    const { result } = renderHook(() => useSessionState<typeof initial>('obj', initial));
    act(() => {
      result.current[1]({ a: 2, b: 'y' });
    });
    expect(result.current[0]).toEqual({ a: 2, b: 'y' });
    expect(JSON.parse(store['obj'])).toEqual({ a: 2, b: 'y' });
  });
});
