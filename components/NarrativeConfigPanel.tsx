import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import * as Collapsible from '@radix-ui/react-collapsible';
import { NarrativeSectionSpec, NarrativeFramework, NarrativeSectionType } from '../types';

interface NarrativeConfigPanelProps {
  specs: NarrativeSectionSpec[];
  framework: NarrativeFramework;
  onFrameworkChange: (fw: NarrativeFramework) => void;
  onChange: (specs: NarrativeSectionSpec[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  progress?: { completed: number; total: number };
}

const SECTION_TYPE_LABELS: Record<NarrativeSectionType, string> = {
  'self-introduction': '자기소개',
  'career-project': '경력/프로젝트',
  'technical-skills': '보유기술',
  'motivation': '지원동기',
  'growth-plan': '성장계획',
  'custom': '기타 (직접입력)',
};

const CHAR_LIMIT_OPTIONS = [500, 800, 1000, 1500, 2000];

const MAX_SECTIONS = 4;

export const NarrativeConfigPanel: React.FC<NarrativeConfigPanelProps> = ({
  specs,
  framework,
  onFrameworkChange,
  onChange,
  onGenerate,
  isGenerating,
  progress,
}) => {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  const togglePromptExpanded = (specId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      next.has(specId) ? next.delete(specId) : next.add(specId);
      return next;
    });
  };

  const handleAddSection = (type: NarrativeSectionType) => {
    if (specs.length >= MAX_SECTIONS) return;

    const newSpec: NarrativeSectionSpec = {
      id: crypto.randomUUID(),
      type,
      framework,
      charLimit: 1000,
      customTitle: type === 'custom' ? '' : undefined,
    };

    onChange([...specs, newSpec]);
  };

  const handleRemoveSection = (specId: string) => {
    onChange(specs.filter((s) => s.id !== specId));
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      next.delete(specId);
      return next;
    });
  };

  const handleUpdateSpec = (specId: string, updates: Partial<NarrativeSectionSpec>) => {
    onChange(
      specs.map((s) => (s.id === specId ? { ...s, ...updates, framework } : s))
    );
  };

  const canAddSection = specs.length < MAX_SECTIONS;

  return (
    <div className="space-y-6">
      {/* Framework Selector */}
      <div>
        <h3 className="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          서술 프레임워크 선택
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* K-STAR-K */}
          <button
            type="button"
            onClick={() => onFrameworkChange('k-star-k')}
            disabled={isGenerating}
            className={`relative group text-left p-4 rounded-xl transition-all duration-200 ${
              framework === 'k-star-k'
                ? 'bg-white/5 backdrop-blur-sm border-2 border-blue-500/50 shadow-lg shadow-blue-500/20'
                : 'bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:bg-white/10'
            } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {framework === 'k-star-k' && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 pointer-events-none" />
            )}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                  framework === 'k-star-k'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-white/30'
                }`}>
                  {framework === 'k-star-k' && (
                    <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white">K-STAR-K</h4>
              </div>
              <p className="text-xs text-white/60 mb-2">대기업 자기소개서</p>
              <p className="text-xs text-white/40 leading-relaxed font-mono">
                결론 → S → T → A → R → 가능성
              </p>
            </div>
          </button>

          {/* Tech Narrative */}
          <button
            type="button"
            onClick={() => onFrameworkChange('tech-narrative')}
            disabled={isGenerating}
            className={`relative group text-left p-4 rounded-xl transition-all duration-200 ${
              framework === 'tech-narrative'
                ? 'bg-white/5 backdrop-blur-sm border-2 border-purple-500/50 shadow-lg shadow-purple-500/20'
                : 'bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:bg-white/10'
            } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {framework === 'tech-narrative' && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-600/10 pointer-events-none" />
            )}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                  framework === 'tech-narrative'
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-white/30'
                }`}>
                  {framework === 'tech-narrative' && (
                    <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white">Tech Narrative</h4>
              </div>
              <p className="text-xs text-white/60 mb-2">IT 스타트업</p>
              <p className="text-xs text-white/40 leading-relaxed font-mono">
                문제 정의 → 기술적 접근 → 구현 → 임팩트
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Section Cards */}
      {specs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            구성된 항목 ({specs.length}/{MAX_SECTIONS})
          </h3>
          <div className="space-y-3">
            {specs.map((spec, index) => (
              <div
                key={spec.id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-white/40 w-6">#{index + 1}</span>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-300">
                      {SECTION_TYPE_LABELS[spec.type]}
                    </span>
                    {spec.type === 'custom' && (
                      <input
                        type="text"
                        value={spec.customTitle || ''}
                        onChange={(e) => handleUpdateSpec(spec.id, { customTitle: e.target.value })}
                        placeholder="서술형 질문 입력"
                        disabled={isGenerating}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(spec.id)}
                    disabled={isGenerating}
                    className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-white/60 shrink-0">글자 수 제한</label>
                  <Select.Root
                    value={String(spec.charLimit)}
                    onValueChange={(val) => handleUpdateSpec(spec.id, { charLimit: Number(val) })}
                    disabled={isGenerating}
                  >
                    <Select.Trigger className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50 cursor-pointer">
                      <Select.Value />
                      <Select.Icon>
                        <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-zinc-900 border border-white/20 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50" position="popper" sideOffset={4}>
                        <Select.Viewport>
                          {CHAR_LIMIT_OPTIONS.map((limit) => (
                            <Select.Item
                              key={limit}
                              value={String(limit)}
                              className="px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                            >
                              <Select.ItemText>{limit}자</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                {spec.type === 'custom' ? (
                  /* 기타 항목: 추가 지시 (선택) — customTitle이 질문 본문 */
                  <Collapsible.Root open={expandedPrompts.has(spec.id)} onOpenChange={() => togglePromptExpanded(spec.id)}>
                    <Collapsible.Trigger
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors disabled:opacity-50 group"
                    >
                      <svg
                        className="w-3 h-3 transition-transform group-data-[state=open]:rotate-90"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      추가 지시 (선택사항)
                    </Collapsible.Trigger>
                    <Collapsible.Content className="mt-2">
                      <textarea
                        value={spec.prompt || ''}
                        onChange={(e) => handleUpdateSpec(spec.id, { prompt: e.target.value })}
                        placeholder="예: 회사 경력 중심으로 작성, 팀 리드 경험 강조"
                        disabled={isGenerating}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none disabled:opacity-50"
                        rows={2}
                      />
                    </Collapsible.Content>
                  </Collapsible.Root>
                ) : (
                  /* 기정의 항목: 방향성 힌트 (접이식, 선택) */
                  <Collapsible.Root open={expandedPrompts.has(spec.id)} onOpenChange={() => togglePromptExpanded(spec.id)}>
                    <Collapsible.Trigger
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors disabled:opacity-50 group"
                    >
                      <svg
                        className="w-3 h-3 transition-transform group-data-[state=open]:rotate-90"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      방향성 힌트 (선택사항)
                    </Collapsible.Trigger>
                    <Collapsible.Content className="mt-2">
                      <textarea
                        value={spec.prompt || ''}
                        onChange={(e) => handleUpdateSpec(spec.id, { prompt: e.target.value })}
                        placeholder="예: 리더십 경험 중심으로, 팀 협업 사례 포함"
                        disabled={isGenerating}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none disabled:opacity-50"
                        rows={3}
                      />
                    </Collapsible.Content>
                  </Collapsible.Root>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Section */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild disabled={!canAddSection || isGenerating}>
          <button
            type="button"
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl transition-all ${
              canAddSection && !isGenerating
                ? 'border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 text-white/60 hover:text-blue-400 cursor-pointer'
                : 'border-white/10 text-white/30 cursor-not-allowed'
            }`}
            title={!canAddSection ? `최대 ${MAX_SECTIONS}개까지 추가 가능` : '항목 추가'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-semibold">항목 추가</span>
            {!canAddSection && (
              <span className="ml-2 text-xs text-amber-400/70">(최대 {MAX_SECTIONS}개)</span>
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={8}
            className="w-[var(--radix-dropdown-menu-trigger-width)] bg-zinc-900 border border-white/20 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50"
          >
            {(Object.entries(SECTION_TYPE_LABELS) as Array<[NarrativeSectionType, string]>)
              .filter(([type]) => type !== 'custom')
              .map(([type, label]) => (
              <DropdownMenu.Item
                key={type}
                onSelect={() => handleAddSection(type)}
                className="px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5 cursor-pointer outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                {label}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
            <DropdownMenu.Item
              onSelect={() => handleAddSection('custom')}
              className="px-4 py-2.5 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white italic"
            >
              기타 (직접입력)
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Generate Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={specs.length === 0 || isGenerating}
          className={`w-full relative px-6 py-4 rounded-xl font-bold text-sm transition-all ${
            specs.length === 0 || isGenerating
              ? 'bg-white/5 text-white/30 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]'
          }`}
        >
          {isGenerating ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 animate-spin text-white/80"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>
                  {progress ? `${progress.completed}/${progress.total} 항목 생성 중...` : '생성 중...'}
                </span>
              </div>
              {progress && (
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500"
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{specs.length}개 항목 생성하기</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
