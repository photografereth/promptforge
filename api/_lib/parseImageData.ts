export function parseImageData(input: any): { data: string; mimeType: string } | null {
  if (!input) return null;
  let dataStr = typeof input === 'string' ? input : input.data || input.dataUrl || '';
  let mimeType = input.mimeType || 'image/jpeg';

  if (!dataStr || typeof dataStr !== 'string') return null;

  const match = dataStr.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    dataStr = match[2];
  }

  return { data: dataStr.trim(), mimeType };
}
