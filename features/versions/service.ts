import * as Diff from 'diff';
import { ResumeVersion, VersionComparison } from '../../types';

const STORAGE_KEY = 'resummeter_versions';

/**
 * localStorage 기반 이력서 버전 관리 서비스
 */

export function saveVersion(
  name: string,
  resumeText: string,
  jobDescription: string,
  matchScore?: number
): ResumeVersion {
  const now = new Date().toISOString();
  const newVersion: ResumeVersion = {
    id: `v_${Date.now()}`,
    name,
    resumeText,
    jobDescription,
    matchScore,
    createdAt: now,
    updatedAt: now
  };

  const versions = getVersions();
  versions.push(newVersion);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));

  return newVersion;
}

export function getVersions(): ResumeVersion[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const versions = JSON.parse(stored) as ResumeVersion[];
    return versions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function deleteVersion(id: string): void {
  const versions = getVersions().filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

export function compareVersions(
  versionA: ResumeVersion,
  versionB: ResumeVersion
): VersionComparison {
  const diff = Diff.diffLines(versionA.resumeText, versionB.resumeText);

  const diffHtml = diff
    .map(part => {
      if (part.added) {
        return `<span class="bg-green-900/50 text-green-300">${escapeHtml(part.value)}</span>`;
      }
      if (part.removed) {
        return `<span class="bg-red-900/50 text-red-300 line-through">${escapeHtml(part.value)}</span>`;
      }
      return `<span class="text-slate-400">${escapeHtml(part.value)}</span>`;
    })
    .join('');

  const scoreComparison =
    versionA.matchScore !== undefined && versionB.matchScore !== undefined
      ? { a: versionA.matchScore, b: versionB.matchScore }
      : null;

  return {
    versionA,
    versionB,
    diffHtml,
    scoreComparison
  };
}

export function updateVersion(
  id: string,
  updates: Partial<ResumeVersion>
): ResumeVersion | null {
  const versions = getVersions();
  const index = versions.findIndex(v => v.id === id);

  if (index === -1) return null;

  const updated = {
    ...versions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  versions[index] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));

  return updated;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
