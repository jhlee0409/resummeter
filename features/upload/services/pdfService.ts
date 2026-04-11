import * as pdfjsLib from 'pdfjs-dist';
import type { PdfValidationError, PdfExtractionProgress, PdfExtractionResult } from '../../../types';
// @ts-ignore — Vite ?url import for static asset URL
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

let currentLoadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function validatePdfFile(file: File): Promise<PdfValidationError | null> {
  if (file.size > MAX_FILE_SIZE) {
    return 'TOO_LARGE';
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = PDF_MAGIC_BYTES.every((byte, i) => header[i] === byte);
  if (!isPdf) {
    return 'INVALID_FORMAT';
  }

  return null;
}

export async function extractPdfText(
  file: File,
  onProgress: (progress: PdfExtractionProgress) => void,
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  onProgress({ currentPage: 0, totalPages: 0, phase: 'validating' });

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  currentLoadingTask = loadingTask;

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    pdf = await loadingTask.promise;
  } catch (error: any) {
    currentLoadingTask = null;
    if (error?.name === 'PasswordException') {
      throw Object.assign(new Error('ENCRYPTED'), { pdfError: 'ENCRYPTED' as PdfValidationError });
    }
    if (error?.name === 'InvalidPDFException') {
      throw Object.assign(new Error('CORRUPTED'), { pdfError: 'CORRUPTED' as PdfValidationError });
    }
    throw Object.assign(new Error('UNKNOWN'), { pdfError: 'UNKNOWN' as PdfValidationError });
  }

  try {
    // Parallel page extraction with per-page progress
    let completedCount = 0;
    const pagePromises: Promise<string>[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      pagePromises.push(
        pdf.getPage(i).then(async (page) => {
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];
          let pageText = '';
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (!item.str) continue;
            pageText += item.str;

            if (item.hasEOL) {
              pageText += '\n';
              continue;
            }

            if (j >= items.length - 1) continue;
            const next = items[j + 1];
            if (!next?.str) continue;

            const fontSize = Math.abs(item.transform[0]) || 12;
            const yDiff = Math.abs(item.transform[5] - next.transform[5]);

            // Different line: any y-position change beyond 1px
            if (yDiff > 1) {
              // Large gap = paragraph break, small gap = line break
              pageText += yDiff > fontSize * 1.5 ? '\n\n' : '\n';
            } else {
              // Same line: check horizontal gap for word spacing
              const itemEnd = item.transform[4] + (item.width || 0);
              const nextStart = next.transform[4];
              const gap = nextStart - itemEnd;
              if (gap > fontSize * 0.15) {
                pageText += ' ';
              }
            }
          }
          completedCount++;
          onProgress({
            currentPage: completedCount,
            totalPages: pdf.numPages,
            phase: 'extracting',
          });
          return pageText;
        }),
      );
    }

    const pageTexts = await Promise.all(pagePromises);
    const fullText = pageTexts.join('\n\n');

    // Thumbnail rendering
    onProgress({ currentPage: pdf.numPages, totalPages: pdf.numPages, phase: 'rendering-thumbnail' });

    let thumbnailDataUrl: string | null = null;
    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 0.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await firstPage.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        thumbnailDataUrl = canvas.toDataURL('image/png');
      }
    } catch {
      // Thumbnail failure is non-critical
    }

    // Metadata
    let author: string | undefined;
    let title: string | undefined;
    try {
      const meta = await pdf.getMetadata();
      const info = meta?.info as any;
      if (info?.Author) author = info.Author;
      if (info?.Title) title = info.Title;
    } catch {
      // Metadata failure is non-critical
    }

    const result: PdfExtractionResult = {
      text: fullText,
      pageCount: pdf.numPages,
      charCount: fullText.length,
      lineCount: fullText.split('\n').length,
      thumbnailDataUrl,
      metadata: { author, title },
    };

    return result;
  } finally {
    currentLoadingTask = null;
    try {
      await pdf.destroy();
    } catch {
      // Cleanup failure is non-critical
    }
  }
}

export function cancelExtraction(): void {
  if (currentLoadingTask) {
    currentLoadingTask.destroy();
    currentLoadingTask = null;
  }
}

const ERROR_MESSAGES: Record<PdfValidationError, string> = {
  TOO_LARGE: '파일 크기가 10MB를 초과합니다. 더 작은 파일을 업로드해 주세요.',
  INVALID_FORMAT: '유효한 PDF 파일이 아닙니다. 파일을 확인해 주세요.',
  ENCRYPTED: '암호화된 PDF입니다. 암호를 해제한 후 다시 업로드해 주세요.',
  CORRUPTED: '손상된 PDF 파일입니다. 다른 파일을 업로드해 주세요.',
  UNKNOWN: 'PDF 처리 중 알 수 없는 오류가 발생했습니다.',
};

export function getErrorMessage(error: PdfValidationError): string {
  return ERROR_MESSAGES[error];
}
