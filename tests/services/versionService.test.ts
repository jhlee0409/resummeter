import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveVersion, getVersions, deleteVersion, updateVersion, compareVersions } from '../../services/versionService';

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

describe('versionService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('saveVersion', () => {
    it('버전을 생성하고 반환한다', () => {
      const v = saveVersion('v1', '이력서 내용', 'JD 내용', 85);
      expect(v.id).toMatch(/^v_\d+$/);
      expect(v.name).toBe('v1');
      expect(v.resumeText).toBe('이력서 내용');
      expect(v.jobDescription).toBe('JD 내용');
      expect(v.matchScore).toBe(85);
      expect(v.createdAt).toBeTruthy();
      expect(v.createdAt).toBe(v.updatedAt);
    });

    it('localStorage에 저장한다', () => {
      saveVersion('v1', 'text', 'jd');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('matchScore 없이도 동작한다', () => {
      const v = saveVersion('v1', 'text', 'jd');
      expect(v.matchScore).toBeUndefined();
    });
  });

  describe('getVersions', () => {
    it('빈 스토리지에서 빈 배열 반환', () => {
      expect(getVersions()).toEqual([]);
    });

    it('저장된 버전을 updatedAt 내림차순으로 반환', () => {
      saveVersion('first', 'a', 'b');
      saveVersion('second', 'c', 'd');
      const versions = getVersions();
      expect(versions.length).toBe(2);
      // 최신이 먼저
      expect(new Date(versions[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(versions[1].updatedAt).getTime()
      );
    });

    it('잘못된 JSON은 빈 배열 반환', () => {
      store['resummeter_versions'] = '{invalid json';
      expect(getVersions()).toEqual([]);
    });
  });

  describe('deleteVersion', () => {
    it('ID로 버전을 삭제한다', () => {
      const v = saveVersion('v1', 'text', 'jd');
      deleteVersion(v.id);
      expect(getVersions()).toHaveLength(0);
    });

    it('존재하지 않는 ID는 에러 없이 무시', () => {
      saveVersion('v1', 'text', 'jd');
      deleteVersion('nonexistent');
      expect(getVersions()).toHaveLength(1);
    });
  });

  describe('updateVersion', () => {
    it('버전을 업데이트하고 반환', () => {
      const v = saveVersion('v1', 'old', 'jd');
      const updated = updateVersion(v.id, { name: 'v1-updated' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('v1-updated');
      expect(updated!.resumeText).toBe('old'); // 나머지 보존
    });

    it('updatedAt을 갱신한다', () => {
      const v = saveVersion('v1', 'text', 'jd');
      const updated = updateVersion(v.id, { name: 'new' });
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(v.updatedAt).getTime()
      );
    });

    it('존재하지 않는 ID는 null 반환', () => {
      expect(updateVersion('nonexistent', { name: 'x' })).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('두 버전의 diff HTML을 생성한다', () => {
      const a = saveVersion('v1', 'hello world', 'jd', 70);
      const b = saveVersion('v2', 'hello universe', 'jd', 85);
      const comparison = compareVersions(a, b);
      expect(comparison.diffHtml).toContain('world');
      expect(comparison.diffHtml).toContain('universe');
      expect(comparison.versionA.id).toBe(a.id);
      expect(comparison.versionB.id).toBe(b.id);
    });

    it('matchScore가 둘 다 있으면 scoreComparison 반환', () => {
      const a = saveVersion('v1', 'a', 'jd', 70);
      const b = saveVersion('v2', 'b', 'jd', 85);
      const comparison = compareVersions(a, b);
      expect(comparison.scoreComparison).toEqual({ a: 70, b: 85 });
    });

    it('matchScore가 하나라도 없으면 scoreComparison null', () => {
      const a = saveVersion('v1', 'a', 'jd');
      const b = saveVersion('v2', 'b', 'jd', 85);
      const comparison = compareVersions(a, b);
      expect(comparison.scoreComparison).toBeNull();
    });
  });
});
