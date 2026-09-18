const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

// Redimensiona (lado maior <= 1600px) e reencoda como JPEG via canvas, para manter
// o corpo das requisições de análise multimodal dentro do limite de 4.5MB das
// Vercel Serverless Functions mesmo com várias fotos de celular em alta resolução.
export function compressImageFile(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao decodificar a imagem.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D não suportado neste navegador.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve({ dataUrl, mimeType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
