import React, { useState, useEffect } from 'react';
import {
  saveVersion,
  getVersions,
  deleteVersion,
  compareVersions
} from './service';
import { ResumeVersion, VersionComparison } from '../../types';

interface Props {
  currentResumeText: string;
  currentJobDescription: string;
  currentScore?: number;
}

export default function VersionManagerView({
  currentResumeText,
  currentJobDescription,
  currentScore
}: Props) {
  const [versionName, setVersionName] = useState('');
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = () => {
    setVersions(getVersions());
  };

  const handleSave = () => {
    if (!versionName.trim()) {
      showToast('버전 이름을 입력해주세요');
      return;
    }

    saveVersion(versionName, currentResumeText, currentJobDescription, currentScore);
    setVersionName('');
    loadVersions();
    showToast('버전이 저장되었습니다');
  };

  const handleDelete = (id: string) => {
    if (confirm('이 버전을 삭제하시겠습니까?')) {
      deleteVersion(id);
      selectedVersions.delete(id);
      setSelectedVersions(new Set(selectedVersions));
      loadVersions();
      setComparison(null);
      showToast('버전이 삭제되었습니다');
    }
  };

  const handleCheckboxChange = (id: string) => {
    const newSelected = new Set(selectedVersions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      if (newSelected.size >= 2) {
        const [first] = Array.from(newSelected);
        newSelected.delete(first);
      }
      newSelected.add(id);
    }
    setSelectedVersions(newSelected);
    setComparison(null);
  };

  const handleCompare = () => {
    if (selectedVersions.size !== 2) return;

    const [idA, idB] = Array.from(selectedVersions);
    const versionA = versions.find(v => v.id === idA);
    const versionB = versions.find(v => v.id === idB);

    if (versionA && versionB) {
      const result = compareVersions(versionA, versionB);
      setComparison(result);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* 상단: 현재 버전 저장 */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-2xl font-bold mb-4 text-slate-100">현재 버전 저장</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="버전 이름 (예: 네이버 지원용, 카카오 최종본)"
              className="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100 placeholder-slate-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              저장
            </button>
          </div>
          {currentScore !== undefined && (
            <p className="mt-3 text-sm text-slate-400">
              현재 매칭 점수: <span className="text-blue-400 font-semibold">{currentScore}점</span>
            </p>
          )}
        </div>
      </div>

      {/* 중앙: 버전 목록 */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-100">저장된 버전</h2>
          {selectedVersions.size === 2 && (
            <button
              onClick={handleCompare}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors"
            >
              비교하기
            </button>
          )}
        </div>

        {versions.length === 0 ? (
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-12 border border-slate-700/50 text-center">
            <p className="text-slate-400 text-lg">저장된 버전이 없습니다</p>
            <p className="text-slate-500 text-sm mt-2">위에서 현재 이력서를 저장해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border transition-all ${
                  selectedVersions.has(version.id)
                    ? 'border-violet-500 shadow-lg shadow-violet-500/20'
                    : 'border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedVersions.has(version.id)}
                      onChange={() => handleCheckboxChange(version.id)}
                      className="w-5 h-5 rounded accent-violet-600 cursor-pointer"
                    />
                    <h3 className="font-bold text-slate-100">{version.name}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(version.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="삭제"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-slate-400 mb-2">
                  {formatDate(version.updatedAt)}
                </p>

                {version.matchScore !== undefined && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-700/50 rounded-full">
                    <span className="text-xs text-slate-400">매칭 점수</span>
                    <span className="text-sm font-bold text-blue-400">
                      {version.matchScore}점
                    </span>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-3 line-clamp-2">
                  {version.resumeText.substring(0, 80)}...
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단: 비교 뷰 */}
      {comparison && (
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-2xl font-bold mb-6 text-slate-100">버전 비교</h2>

            {/* 비교 대상 정보 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-sm text-slate-400 mb-1">버전 A</p>
                <h3 className="font-bold text-slate-100 mb-2">{comparison.versionA.name}</h3>
                <p className="text-xs text-slate-500">{formatDate(comparison.versionA.updatedAt)}</p>
                {comparison.scoreComparison && (
                  <p className="text-sm text-blue-400 font-semibold mt-2">
                    {comparison.scoreComparison.a}점
                  </p>
                )}
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-sm text-slate-400 mb-1">버전 B</p>
                <h3 className="font-bold text-slate-100 mb-2">{comparison.versionB.name}</h3>
                <p className="text-xs text-slate-500">{formatDate(comparison.versionB.updatedAt)}</p>
                {comparison.scoreComparison && (
                  <p className="text-sm text-blue-400 font-semibold mt-2">
                    {comparison.scoreComparison.b}점
                  </p>
                )}
              </div>
            </div>

            {/* 점수 비교 */}
            {comparison.scoreComparison && (
              <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <h3 className="font-semibold text-slate-100 mb-3">매칭 점수 비교</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1">버전 A</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {comparison.scoreComparison.a}점
                    </p>
                  </div>
                  <div className="text-2xl text-slate-600">vs</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1">버전 B</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {comparison.scoreComparison.b}점
                    </p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm text-slate-400 mb-1">차이</p>
                    <p className={`text-2xl font-bold ${
                      comparison.scoreComparison.b > comparison.scoreComparison.a
                        ? 'text-green-400'
                        : comparison.scoreComparison.b < comparison.scoreComparison.a
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}>
                      {comparison.scoreComparison.b > comparison.scoreComparison.a ? '+' : ''}
                      {comparison.scoreComparison.b - comparison.scoreComparison.a}점
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Diff 결과 */}
            <div className="bg-slate-900/70 rounded-lg p-6 border border-slate-700/50 overflow-auto max-h-96">
              <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-red-900/50 rounded"></span>
                <span className="text-xs text-slate-400">삭제</span>
                <span className="inline-block w-3 h-3 bg-green-900/50 rounded ml-4"></span>
                <span className="text-xs text-slate-400">추가</span>
              </h3>
              <pre
                className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ __html: comparison.diffHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
