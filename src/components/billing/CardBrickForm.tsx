import { useEffect, useId, useRef, useState } from 'react';

interface BrickController {
  unmount: () => void;
}

interface MercadoPagoConstructor {
  new (
    publicKey: string,
    options?: { locale: string }
  ): {
    bricks: () => {
      create: (name: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController>;
    };
  };
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkPromise: Promise<void> | null = null;

// O SDK é carregado do CDN oficial do Mercado Pago: os dados do cartão ficam num iframe
// dele e nunca passam pelo nosso servidor. Só o token de uso único chega ao backend.
function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('Não foi possível carregar o formulário de pagamento.'));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

interface CardBrickFormProps {
  amount: number;
  publicKey: string;
  onToken: (token: string) => Promise<void>;
}

export function CardBrickForm({ amount, publicKey, onToken }: CardBrickFormProps) {
  const containerId = `card-brick-${useId().replace(/:/g, '')}`;
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controller: BrickController | null = null;

    loadSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        const created = await mp.bricks().create('cardPayment', containerId, {
          initialization: { amount },
          customization: {
            visual: { style: { theme: 'dark' } },
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async (cardFormData: { token: string }) => {
              await onTokenRef.current(cardFormData.token);
            },
            onError: () => setLoadError('Não foi possível processar os dados do cartão. Confira e tente novamente.'),
          },
        });
        if (cancelled) created.unmount();
        else controller = created;
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });

    return () => {
      cancelled = true;
      controller?.unmount();
    };
  }, [publicKey, amount, containerId]);

  return (
    <div>
      {loadError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {loadError}
        </p>
      )}
      <div id={containerId} />
    </div>
  );
}
