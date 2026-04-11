import { describe, it, expect, vi } from 'vitest';

// pdfService imports pdfjs-dist which needs a worker, so we mock the module
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

import { validatePdfFile, getErrorMessage } from '../../services/pdfService';

describe('validatePdfFile', () => {
  it('10MB 초과 파일은 TOO_LARGE 반환', async () => {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    expect(await validatePdfFile(bigFile)).toBe('TOO_LARGE');
  });

  it('정확히 10MB는 통과', async () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const content = new Uint8Array(10 * 1024 * 1024);
    content.set(pdfHeader, 0);
    const file = new File([content], 'exact.pdf', { type: 'application/pdf' });
    expect(await validatePdfFile(file)).toBeNull();
  });

  it('PDF 매직 바이트가 없으면 INVALID_FORMAT', async () => {
    const notPdf = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], 'not.pdf');
    expect(await validatePdfFile(notPdf)).toBe('INVALID_FORMAT');
  });

  it('유효한 PDF 헤더는 null 반환 (통과)', async () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    const file = new File([pdfHeader], 'valid.pdf', { type: 'application/pdf' });
    expect(await validatePdfFile(file)).toBeNull();
  });
});

describe('getErrorMessage', () => {
  it('TOO_LARGE → 크기 초과 메시지', () => {
    expect(getErrorMessage('TOO_LARGE')).toContain('10MB');
  });

  it('INVALID_FORMAT → 유효하지 않은 PDF 메시지', () => {
    expect(getErrorMessage('INVALID_FORMAT')).toContain('유효한 PDF');
  });

  it('ENCRYPTED → 암호화 메시지', () => {
    expect(getErrorMessage('ENCRYPTED')).toContain('암호화');
  });

  it('CORRUPTED → 손상 메시지', () => {
    expect(getErrorMessage('CORRUPTED')).toContain('손상');
  });

  it('UNKNOWN → 알 수 없는 오류 메시지', () => {
    expect(getErrorMessage('UNKNOWN')).toContain('알 수 없는');
  });
});
