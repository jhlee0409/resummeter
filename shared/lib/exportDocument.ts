/**
 * 문서 내보내기 유틸 — Markdown 텍스트를 제출 가능한 형식으로 출력.
 * 한글 폰트는 브라우저 렌더링에 위임한다(별도 폰트 임베딩 없이 한글 안전).
 * - printAsPdf: 인쇄 대화상자 → "PDF로 저장" (선택 가능한 텍스트, 의존성 없음)
 * - downloadAsWord: MS Word 호환 .doc 다운로드 (편집 가능)
 */

import { marked } from 'marked';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DOC_FONT =
  "'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

/** 인쇄/워드 공용 본문 HTML (마크다운 → HTML) */
function bodyHtml(markdown: string): string {
  return marked(markdown) as string;
}

const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: ${DOC_FONT}; color: #1a1a1a; line-height: 1.6; font-size: 11pt; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #ddd; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  p, li { font-size: 11pt; }
  ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  strong { font-weight: 700; }
  a { color: #1a1a1a; text-decoration: none; }
  hr { border: none; border-top: 1px solid #eee; margin: 12pt 0; }
`;

/**
 * 인쇄 대화상자를 열어 사용자가 "PDF로 저장"할 수 있게 한다.
 * 숨겨진 iframe에 렌더 → print() 호출 → 정리.
 */
export function printAsPdf(title: string, markdown: string): void {
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml(markdown)}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // 레이아웃이 안정된 뒤 인쇄. 텍스트 전용이라 외부 리소스 로드 대기 불필요.
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, 250);
}

/** MS Word가 여는 .doc(HTML) 파일로 다운로드한다. */
export function downloadAsWord(filename: string, title: string, markdown: string): void {
  const html =
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>` +
    `<head><meta charset='utf-8'><title>${escapeHtml(title)}</title>` +
    `<style>body{font-family:${DOC_FONT};line-height:1.6;font-size:11pt;}h2{border-bottom:1px solid #ddd;padding-bottom:3px;}</style></head>` +
    `<body>${bodyHtml(markdown)}</body></html>`;

  // ﻿(BOM)로 한글 인코딩 보존
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
