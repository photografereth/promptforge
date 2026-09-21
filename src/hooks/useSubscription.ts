import { useCallback, useEffect, useState } from 'react';
import { SUBSCRIPTION_REQUIRED_EVENT } from '../lib/apiFetch';
import { billingApi, type BillingStatus } from '../lib/billingApi';

// Estado da assinatura vindo do backend. `enabled` = usuário autenticado.
// O frontend só exibe este estado: o bloqueio real é feito no servidor.
export function useSubscription(enabled: boolean) {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await billingApi.status());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar sua assinatura.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    const onRequired = () => void refresh();
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
  }, [refresh]);

  // Entre a autenticação e o primeiro fetch, `data` e `error` são nulos: conta como carregando.
  const loading = isLoading || (enabled && data === null && error === null);
  return { data, isLoading: loading, error, refresh };
}
