import { describe, it, expect } from 'vitest';
import { dataUrlToBlob } from './dataUrl';

describe('dataUrlToBlob', () => {
  it('decodifica base64 com o tipo certo', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(8);
  });
  it('lança para texto que não é data URL', () => {
    expect(() => dataUrlToBlob('https://x/y.png')).toThrow();
  });
});
