/**
 * 범용 증빙 파일 → base64 (Gemini 멀티모달 inlineData용).
 * PDF/이미지를 원본 그대로 모델에 넘겨 레이아웃/도표/이미지까지 해석.
 */

export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_EVIDENCE_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export function isSupportedEvidenceFile(file: File): boolean {
  const t = file.type;
  if (SUPPORTED_EVIDENCE_MIME.includes(t)) return true;
  // 일부 환경에서 type이 비어있을 수 있어 확장자 폴백
  return /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
}

function guessMime(file: File): string {
  if (file.type) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  return 'application/octet-stream';
}

/** File → { mimeType, dataBase64 } (data: 프리픽스 없는 순수 base64) */
export async function fileToBase64(file: File): Promise<{ mimeType: string; dataBase64: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000; // 큰 파일에서 call stack 초과 방지
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  return { mimeType: guessMime(file), dataBase64: btoa(binary) };
}
