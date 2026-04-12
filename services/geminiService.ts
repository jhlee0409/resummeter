// Backward compatibility shim — imports forward to new canonical locations
export { generateTailoredInstruction } from '../core/analysis/jdAnalysis';
export { coachResume } from '../core/analysis/coaching';
export { enrichEvidenceBank } from '../core/analysis/evidenceBank';
export { generateNarrativeSection, generateNarrativeSections } from '../features/narrative/service';
export { formatRepoInfo } from '../shared/prompt/formatters';
