import React, { useRef, useState, useCallback, useEffect } from 'react';
import { UserInputData, GithubRepo, PdfExtractionProgress, PdfExtractionResult, GitHubFetchResult } from '../types';
import { validatePdfFile, extractPdfText, cancelExtraction, getErrorMessage } from '../services/pdfService';
import { fetchAllRepos } from '../services/githubService';

interface UploadStepProps {
  data: UserInputData;
  onChange: <K extends keyof UserInputData>(field: K, value: UserInputData[K]) => void;
  onNext: (githubData?: import('../types').GitHubFetchResult[]) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ data, onChange, onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [jdMode, setJdMode] = useState<'text' | 'url'>('text');
  const [jdUrl, setJdUrl] = useState('');
  const [isFetchingJd, setIsFetchingJd] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfExtractionProgress | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfExtractionResult | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const [githubWarning, setGithubWarning] = useState<string | null>(null);

  const isParsingPdf = pdfProgress !== null;

  useEffect(() => {
    return () => { cancelExtraction(); };
  }, []);

  const repos = data.githubRepos.length > 0 ? data.githubRepos : [{ url: '', description: '' }];

  const processFile = async (file: File) => {
    setPdfError(null);
    setUploadedFileName(file.name);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // Validate
      const validationError = await validatePdfFile(file);
      if (validationError) {
        setPdfError(getErrorMessage(validationError));
        setUploadedFileName(null);
        return;
      }

      // Extract
      setPdfProgress({ currentPage: 0, totalPages: 0, phase: 'validating' });
      try {
        const result = await extractPdfText(file, setPdfProgress);
        setPdfResult(result);
        onChange('resumeText', result.text);
      } catch (error: any) {
        if (error?.pdfError) {
          setPdfError(getErrorMessage(error.pdfError));
        } else if (error?.message !== 'Worker was destroyed') {
          setPdfError('PDF 처리 중 알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        setPdfProgress(null);
      }
    } else {
      setPdfResult(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onChange('resumeText', text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, []);

  const handleRepoChange = (index: number, field: keyof GithubRepo, value: string) => {
    const newRepos = [...repos];
    if (field === 'url') {
      let rawValue = value;
      if (rawValue.includes('github.com/')) {
        rawValue = rawValue.split('github.com/')[1] || '';
      }
      const newUrl = rawValue.trim() === '' ? '' : `https://github.com/${rawValue}`;
      newRepos[index] = { ...newRepos[index], url: newUrl };
    } else {
      newRepos[index] = { ...newRepos[index], description: value };
    }
    onChange('githubRepos', newRepos);
  };

  const addRepoField = () => {
    onChange('githubRepos', [...repos, { url: '', description: '' }]);
  };

  const removeRepoField = (index: number) => {
    const newRepos = repos.filter((_, i) => i !== index);
    onChange('githubRepos', newRepos.length ? newRepos : [{ url: '', description: '' }]);
  };

  const githubRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+$/;
  const areReposValid = repos.every(repo => {
    if (repo.url === '') return false;
    const repoPath = repo.url.replace('https://github.com/', '');
    return githubRegex.test(repoPath);
  });

  const fetchJdContent = async () => {
    if (!jdUrl) return;
    setIsFetchingJd(true);
    setFetchError(null);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(jdUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (data.contents) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        const elementsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'];
        elementsToRemove.forEach(tag => {
          doc.querySelectorAll(tag).forEach(el => el.remove());
        });
        let textContent = doc.body.textContent || "";
        textContent = textContent.replace(/\s+/g, ' ').trim();
        if (textContent.length < 50) {
          throw new Error("텍스트를 충분히 추출할 수 없습니다.");
        }
        onChange('jobDescription', textContent);
        setJdMode('text');
      } else {
        throw new Error("콘텐츠를 불러오는데 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      setFetchError("콘텐츠를 가져올 수 없습니다. 직접 복사해서 붙여넣어 주세요.");
    } finally {
      setIsFetchingJd(false);
    }
  };

  const handleStartWithGithub = async () => {
    setIsFetchingGithub(true);
    setGithubWarning(null);

    let fetchedGithubData: import('../types').GitHubFetchResult[] | undefined;
    try {
      const reposWithUrl = data.githubRepos.filter(r => r.url.trim());
      if (reposWithUrl.length > 0) {
        const results = await fetchAllRepos(reposWithUrl);
        fetchedGithubData = results;
        onChange('githubData', results);

        const rateLimited = results.filter(r => r.status === 'rate-limited');
        const notFound = results.filter(r => r.status === 'not-found');
        const errors = results.filter(r => r.status === 'error');

        if (rateLimited.length > 0) {
          setGithubWarning(`API 제한에 도달했습니다. ${rateLimited.length}개 레포는 사용자 설명만으로 분석됩니다.`);
        } else if (notFound.length > 0 || errors.length > 0) {
          setGithubWarning(`${notFound.length + errors.length}개 레포의 데이터를 가져올 수 없습니다. 사용자 설명으로 진행합니다.`);
        }
      }
    } catch (e) {
      console.warn('GitHub data fetch failed, proceeding without:', e);
      setGithubWarning('GitHub 데이터 수집에 실패했습니다. 사용자 설명만으로 분석합니다.');
    } finally {
      setIsFetchingGithub(false);
    }

    onNext(fetchedGithubData);
  };

  const isFormValid = data.resumeText.trim() !== '' && data.jobDescription.trim() !== '' && areReposValid;
  const resumeCharCount = data.resumeText.length;
  const jdCharCount = data.jobDescription.length;

  const completedSections = [
    data.resumeText.trim() !== '',
    data.jobDescription.trim() !== '',
    areReposValid,
  ].filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Hero context banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-800 via-dark-850 to-brand-950/30 glass-card p-6 noise">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-brand-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-brand-300 text-xs font-semibold tracking-wide">AI Resume Optimizer</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-1">이력서, JD, GitHub 정보를 입력하세요</h2>
          <p className="text-zinc-500 text-sm">Gemini AI가 채용 공고에 맞춰 이력서를 최적화하고, GitHub 활동에서 숨겨진 강점을 발굴합니다.</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${completedSections >= 1 ? 'bg-brand-400' : 'bg-zinc-700'}`} />
              <div className={`w-1.5 h-1.5 rounded-full ${completedSections >= 2 ? 'bg-brand-400' : 'bg-zinc-700'}`} />
              <div className={`w-1.5 h-1.5 rounded-full ${completedSections >= 3 ? 'bg-brand-400' : 'bg-zinc-700'}`} />
            </div>
            <span className="text-xs text-zinc-600">{completedSections}/3 완료</span>
          </div>
        </div>
      </div>

      {/* Section: Resume */}
      <section className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-[11px] font-bold text-white section-num shadow-md shadow-brand-500/30">
            01
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-zinc-200">현재 이력서</h3>
            <p className="text-xs text-zinc-500 mt-0.5">PDF, 텍스트, 마크다운 파일을 업로드하거나 직접 붙여넣기</p>
          </div>
          {resumeCharCount > 0 && (
            <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full">
              {resumeCharCount.toLocaleString()}자
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isParsingPdf && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center py-7 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
              ${isDragging ? 'border-brand-400 bg-brand-500/10 scale-[1.005]' : 'border-zinc-700 hover:border-zinc-600 hover:bg-white/[0.02]'}
              ${isParsingPdf ? 'opacity-60 cursor-wait' : ''}
              ${uploadedFileName && !isParsingPdf ? 'border-emerald-500/30 bg-emerald-500/5' : ''}
            `}
          >
            {isParsingPdf ? (
              <div className="flex flex-col items-center gap-3 w-full px-4">
                <svg className="animate-spin h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-brand-400 font-medium">
                  {pdfProgress?.phase === 'validating' && '파일 검증 중...'}
                  {pdfProgress?.phase === 'extracting' && `페이지 추출 중... (${pdfProgress.currentPage}/${pdfProgress.totalPages})`}
                  {pdfProgress?.phase === 'rendering-thumbnail' && '미리보기 생성 중...'}
                </span>
                {pdfProgress?.phase === 'extracting' && pdfProgress.totalPages > 0 && (
                  <div className="w-full max-w-xs">
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(pdfProgress.currentPage / pdfProgress.totalPages) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); cancelExtraction(); setPdfProgress(null); }}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : uploadedFileName ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-3">
                  {pdfResult?.thumbnailDataUrl && (
                    <img src={pdfResult.thumbnailDataUrl} className="w-10 h-14 object-cover rounded border border-slate-200 shadow-sm" alt="PDF 미리보기" />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{uploadedFileName}</span>
                  </div>
                </div>
                {pdfResult && (
                  <span className="text-[11px] text-zinc-600">
                    {pdfResult.pageCount}페이지 | {pdfResult.charCount.toLocaleString()}자 | {pdfResult.lineCount}줄
                  </span>
                )}
                <span className="text-[11px] text-zinc-600">클릭하여 다른 파일 선택</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-400">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">PDF, TXT, MD 지원</p>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md,.json,.pdf"
              onChange={handleFileUpload}
            />
          </div>

          {pdfError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="flex-1">{pdfError}</span>
              <button onClick={() => setPdfError(null)} className="text-red-400 hover:text-red-600 ml-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-dark-950 px-3 text-[11px] text-zinc-600 font-medium">또는 직접 입력</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              className="w-full h-44 p-4 rounded-xl border border-zinc-700/50 focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/40 resize-none text-sm font-mono bg-dark-800/50 text-zinc-200 placeholder-zinc-600 transition-all focus-ring leading-relaxed"
              placeholder="여기에 기존 이력서 내용을 붙여넣으세요..."
              value={data.resumeText}
              onChange={(e) => onChange('resumeText', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Section: JD */}
      <section className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white section-num shadow-md shadow-violet-500/30">
              02
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-200">목표 채용 공고 (JD)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">지원하려는 포지션의 채용 공고 내용</p>
            </div>
          </div>
          <div className="flex bg-zinc-800/50 p-0.5 rounded-lg">
            <button
              onClick={() => setJdMode('text')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${jdMode === 'text' ? 'bg-dark-700 text-zinc-200 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              직접 입력
            </button>
            <button
              onClick={() => setJdMode('url')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${jdMode === 'url' ? 'bg-dark-700 text-violet-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              URL
            </button>
          </div>
        </div>

        <div className="p-5">
          {jdMode === 'text' ? (
            <div className="relative">
              <textarea
                className="w-full h-36 p-4 rounded-xl border border-zinc-700/50 focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/40 resize-none text-sm bg-dark-800/50 text-zinc-200 placeholder-zinc-600 transition-all focus-ring leading-relaxed"
                placeholder="채용 공고의 내용을 여기에 붙여넣으세요. 자격 요건, 우대 사항, 직무 설명 등을 포함해주세요."
                value={data.jobDescription}
                onChange={(e) => onChange('jobDescription', e.target.value)}
              />
              {jdCharCount > 0 && (
                <div className="absolute bottom-3 right-3">
                  <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                    {jdCharCount.toLocaleString()}자
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-500">
                채용 공고 URL을 입력하면 자동으로 텍스트를 추출합니다.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://wanted.co.kr/wd/..."
                  className="flex-1 px-4 py-2.5 text-sm border border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/40 outline-none bg-dark-800/50 text-zinc-200 placeholder-zinc-600 focus-ring"
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                />
                <button
                  onClick={fetchJdContent}
                  disabled={isFetchingJd || !jdUrl}
                  className="px-5 py-2.5 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center gap-2 shadow-sm shadow-violet-500/20"
                >
                  {isFetchingJd ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : '가져오기'}
                </button>
              </div>
              {fetchError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {fetchError}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section: GitHub */}
      <section className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[11px] font-bold text-white section-num shadow-md shadow-slate-500/30">
            03
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-200">GitHub 리포지토리</h3>
            <p className="text-xs text-zinc-500 mt-0.5">AI가 코드 활동, 문서화, 협업 역량을 분석합니다</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {repos.map((repo, index) => {
            const repoPath = repo.url.replace('https://github.com/', '');
            const isEmpty = repoPath === '';
            const isValid = !isEmpty && githubRegex.test(repoPath);

            return (
              <div key={index} className="rounded-xl border border-zinc-700/30 bg-dark-800/30 p-4 space-y-2.5 transition-all hover:border-zinc-600">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex rounded-lg overflow-hidden border border-zinc-700/50 bg-dark-800/50">
                    <span className="inline-flex items-center px-3 bg-zinc-800/50 text-zinc-500 text-[11px] font-mono border-r border-zinc-700/50 whitespace-nowrap">
                      github.com/
                    </span>
                    <input
                      type="text"
                      className={`flex-1 px-3 py-2 text-sm outline-none bg-transparent text-zinc-200 placeholder-zinc-600 font-mono
                        ${!isEmpty && !isValid ? 'text-red-400' : ''}
                      `}
                      placeholder="username/repo"
                      value={repoPath}
                      onChange={(e) => handleRepoChange(index, 'url', e.target.value)}
                    />
                    {!isEmpty && (
                      <div className="flex items-center px-2">
                        {isValid ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <svg className="h-2.5 w-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-red-500/15 flex items-center justify-center">
                            <svg className="h-2.5 w-2.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {repos.length > 1 && (
                    <button
                      onClick={() => removeRepoField(index)}
                      className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  className="w-full text-sm px-3 py-2 border border-zinc-700/50 rounded-lg bg-dark-800/50 text-zinc-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/40 focus-ring"
                  placeholder="프로젝트 설명, 주요 PR, 해결한 이슈, README 작성 노력 등"
                  value={repo.description}
                  onChange={(e) => handleRepoChange(index, 'description', e.target.value)}
                />

                {!isEmpty && !isValid && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    "username/repo" 형식이어야 합니다
                  </p>
                )}
              </div>
            );
          })}

          <button
            onClick={addRepoField}
            className="flex items-center gap-1.5 text-sm text-brand-400 font-semibold hover:text-brand-300 transition-colors mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            리포지토리 추가
          </button>
        </div>
      </section>

      {/* CTA */}
      <div className="flex items-center justify-between pt-1 pb-4">
        <p className="text-[11px] text-zinc-600">
          모든 데이터는 브라우저에서만 처리되며 서버에 저장되지 않습니다.
        </p>
        <div className="flex flex-col items-end gap-2">
          {githubWarning && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs">
              ⚠️ {githubWarning}
            </div>
          )}
          <button
            onClick={handleStartWithGithub}
            disabled={!isFormValid || isParsingPdf || isFetchingGithub}
            className={`group relative px-7 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-2 overflow-hidden
              ${isFormValid && !isParsingPdf && !isFetchingGithub
                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
            `}
          >
            {isFetchingGithub ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                GitHub 데이터 수집 중...
              </>
            ) : (
              <>
                AI 분석 시작
                <svg className={`w-4 h-4 transition-transform ${isFormValid ? 'group-hover:translate-x-0.5' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
