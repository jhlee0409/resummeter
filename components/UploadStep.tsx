import React, { useRef, useState } from 'react';
import { UserInputData, GithubRepo } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Handle potential ESM default export mismatch for pdfjs-dist
// The module might be exported as 'default' depending on the CDN bundler
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Set the worker source for pdf.js to a classic script (UMD) from cdnjs to avoid MIME/Module type issues with Workers
// Ensure the version matches the one in importmap
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

interface UploadStepProps {
  data: UserInputData;
  onChange: <K extends keyof UserInputData>(field: K, value: UserInputData[K]) => void;
  onNext: () => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ data, onChange, onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for JD URL fetching
  const [jdMode, setJdMode] = useState<'text' | 'url'>('text');
  const [jdUrl, setJdUrl] = useState('');
  const [isFetchingJd, setIsFetchingJd] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  // Ensure we have at least one input if data is somehow empty
  const repos = data.githubRepos.length > 0 ? data.githubRepos : [{ url: '', description: '' }];

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use the pdfjs object derived above
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    // Iterate through each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items with basic layout preservation
      const pageText = textContent.items.map((item: any) => {
        return item.str + (item.hasEOL ? '\n' : ' ');
      }).join('');
      
      fullText += pageText + '\n\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setIsParsingPdf(true);
      try {
        const text = await extractTextFromPdf(file);
        onChange('resumeText', text);
      } catch (error) {
        console.error("PDF Parsing Error:", error);
        alert("PDF 파일 변환에 실패했습니다. (Worker Error 가능성) 텍스트를 직접 복사해서 붙여넣어 주세요.");
      } finally {
        setIsParsingPdf(false);
      }
    } else {
      // Text or Markdown
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onChange('resumeText', text);
      };
      reader.readAsText(file);
    }
  };

  // --- GitHub Repo Handling ---
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

  // --- Job Description Fetching Logic ---
  const fetchJdContent = async () => {
    if (!jdUrl) return;
    
    setIsFetchingJd(true);
    setFetchError(null);

    try {
      // Use a CORS proxy to fetch external HTML
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(jdUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();

      if (data.contents) {
        // Parse HTML string to DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');

        // Clean up: Remove scripts, styles, nav, footer to get core text
        const elementsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'];
        elementsToRemove.forEach(tag => {
          doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        // Get text content and clean up whitespace
        let textContent = doc.body.textContent || "";
        textContent = textContent.replace(/\s+/g, ' ').trim();

        if (textContent.length < 50) {
           throw new Error("텍스트를 충분히 추출할 수 없습니다. 사이트가 봇을 차단했거나 SPA일 수 있습니다.");
        }

        onChange('jobDescription', textContent);
        setJdMode('text'); // Switch back to text view to show result
      } else {
        throw new Error("콘텐츠를 불러오는데 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      setFetchError("콘텐츠를 가져올 수 없습니다. 해당 사이트의 보안 설정 때문일 수 있으니 직접 복사해서 붙여넣어 주세요.");
    } finally {
      setIsFetchingJd(false);
    }
  };

  const isFormValid = data.resumeText.trim() !== '' && data.jobDescription.trim() !== '' && areReposValid;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">1. 정보 업로드</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Resume */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              현재 이력서
            </label>
            <div className="space-y-2">
               <button
                onClick={() => !isParsingPdf && fileInputRef.current?.click()}
                disabled={isParsingPdf}
                className={`w-full py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 bg-white ${isParsingPdf ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isParsingPdf ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      PDF 텍스트 추출 중...
                    </>
                ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      이력서 업로드 (PDF/Text/Markdown)
                    </>
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".txt,.md,.json,.pdf" 
                onChange={handleFileUpload} 
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">또는 텍스트 붙여넣기</span>
                </div>
              </div>
              <textarea
                className="w-full h-64 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-mono bg-white text-slate-900"
                placeholder="여기에 기존 이력서 내용을 붙여넣으세요..."
                value={data.resumeText}
                onChange={(e) => onChange('resumeText', e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Job Description & GitHub */}
          <div className="space-y-6">
            
            {/* Job Description Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-slate-700">
                  목표 채용 공고 (JD)
                </label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setJdMode('text')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${jdMode === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    텍스트
                  </button>
                  <button
                    onClick={() => setJdMode('url')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${jdMode === 'url' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    URL 가져오기
                  </button>
                </div>
              </div>

              {jdMode === 'text' ? (
                <textarea
                  className="w-full h-40 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-white text-slate-900"
                  placeholder="지원하려는 채용 공고의 내용을 여기에 붙여넣으세요..."
                  value={data.jobDescription}
                  onChange={(e) => onChange('jobDescription', e.target.value)}
                />
              ) : (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <p className="text-xs text-slate-500">
                    채용 공고 URL을 입력하세요 (예: 원티드, 링크드인 등). 텍스트 추출을 시도합니다.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="https://company.com/careers/..."
                      className="flex-1 p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                      value={jdUrl}
                      onChange={(e) => setJdUrl(e.target.value)}
                    />
                    <button 
                      onClick={fetchJdContent}
                      disabled={isFetchingJd || !jdUrl}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors flex items-center"
                    >
                      {isFetchingJd ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : '가져오기'}
                    </button>
                  </div>
                  {fetchError && (
                    <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                      {fetchError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* GitHub Section */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                GitHub 리포지토리
              </label>
              
              <div className="space-y-4">
                {repos.map((repo, index) => {
                  const repoPath = repo.url.replace('https://github.com/', '');
                  const isEmpty = repoPath === '';
                  const isValid = !isEmpty && githubRegex.test(repoPath);
                  
                  return (
                    <div key={index} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                       <div className="flex rounded-md shadow-sm relative">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-sm">
                          github.com/
                        </span>
                        <input
                          type="text"
                          className={`flex-1 block w-full rounded-none sm:text-sm p-2.5 border outline-none transition-colors bg-white text-slate-900
                            ${!isEmpty && !isValid ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
                            ${repos.length > 1 ? 'border-r-0' : 'rounded-r-md'}
                          `}
                          placeholder="username/repo"
                          value={repoPath}
                          onChange={(e) => handleRepoChange(index, 'url', e.target.value)}
                        />
                        
                        {/* Validation Icon */}
                        <div className={`absolute inset-y-0 ${repos.length > 1 ? 'right-10' : 'right-0'} pr-3 flex items-center pointer-events-none`}>
                          {!isEmpty && isValid && (
                            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!isEmpty && !isValid && (
                            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {repos.length > 1 && (
                          <button
                            onClick={() => removeRepoField(index)}
                            className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="리포지토리 삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      {/* Repo Description Input */}
                      <div className="relative">
                        <input
                            type="text"
                            className="w-full text-sm p-2.5 pl-3 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-900 placeholder-slate-400"
                            placeholder="프로젝트 설명, 주요 PR, 해결한 이슈, README 작성 노력 등을 적어주세요."
                            value={repo.description}
                            onChange={(e) => handleRepoChange(index, 'description', e.target.value)}
                        />
                      </div>

                      {!isEmpty && !isValid && (
                        <p className="text-xs text-red-600 pl-1">
                          잘못된 형식입니다. "username/repo" 형식이어야 합니다.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addRepoField}
                className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 mt-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                리포지토리 추가
              </button>

              <p className="text-xs text-slate-500 mt-1">
                 입력된 정보는 AI가 코드 분석 시 문맥을 이해하는 데 사용됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!isFormValid || isParsingPdf}
          className={`px-8 py-3 rounded-lg font-semibold text-white shadow-lg transition-all transform hover:-translate-y-0.5
            ${isFormValid && !isParsingPdf ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'}
          `}
        >
          분석 및 최적화 시작 &rarr;
        </button>
      </div>
    </div>
  );
};