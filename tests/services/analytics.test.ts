import { describe, it, expect, beforeEach, vi } from 'vitest';

// analytics.ts has module-level side effects (auto session_start + import.meta.env).
// We need to re-import fresh for each test suite.

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Must import after mocking localStorage
import { track, getAnalyticsSummary, clearAnalytics } from '../../services/analytics';

describe('analytics', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('track은 localStorage에 이벤트를 저장한다', () => {
    clearAnalytics();
    track({ type: 'restart' });
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    const lastEvent = stored[stored.length - 1];
    expect(lastEvent.event.type).toBe('restart');
    expect(lastEvent.sessionId).toBeTruthy();
    expect(lastEvent.timestamp).toBeTruthy();
  });

  it('track은 다양한 이벤트 타입을 저장한다', () => {
    clearAnalytics();
    track({ type: 'analysis_start', resumeLength: 100, jdLength: 50, hasGithub: false });
    track({ type: 'tab_switch', from: 'gap-map', to: 'resume' });
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(stored.length).toBeGreaterThanOrEqual(2);
  });

  it('getAnalyticsSummary는 올바른 구조를 반환한다', () => {
    clearAnalytics();
    track({ type: 'restart' });
    track({ type: 'restart' });
    track({ type: 'ats_analyze' });
    const summary = getAnalyticsSummary();
    expect(summary).toHaveProperty('totalEvents');
    expect(summary).toHaveProperty('totalSessions');
    expect(summary).toHaveProperty('eventCounts');
    expect(summary).toHaveProperty('latestEvents');
  });

  it('clearAnalytics는 localStorage를 비운다', () => {
    track({ type: 'restart' });
    clearAnalytics();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('resummeter_analytics');
  });

  it('sessionId는 세션 내에서 동일하다', () => {
    clearAnalytics();
    track({ type: 'restart' });
    track({ type: 'ats_analyze' });
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    const ids = stored.map((e: any) => e.sessionId);
    // 모든 이벤트의 sessionId가 동일
    expect(new Set(ids).size).toBe(1);
  });
});
