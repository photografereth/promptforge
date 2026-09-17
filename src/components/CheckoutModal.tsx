import React, { useState } from 'react';

interface CheckoutModalProps {
  isOpen: boolean;
  plan: 'monthly' | 'annual';
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  plan,
  onClose,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const price = plan === 'monthly' ? 'R$ 119,00' : 'R$ 948,00';
  const recurrence = plan === 'monthly' ? 'por mês (cartão ou pix)' : 'por ano (equivale a 12x R$ 79,00)';

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setCompleted(true);
      setTimeout(() => {
        onSuccess();
      }, 1400);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-lg p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase text-amber-400">
              CHECKOUT SEGURO • FLOW PROMPT FORGE
            </span>
            <h3 className="text-base sm:text-lg font-black uppercase text-neutral-100 tracking-tight mt-0.5">
              Assinatura de Licença Pessoal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-neutral-400 hover:text-white px-2 py-1 bg-neutral-900 border border-neutral-800 rounded cursor-pointer"
          >
            [ FECHAR ]
          </button>
        </div>

        {completed ? (
          <div className="py-12 text-center space-y-3">
            <div className="font-mono text-xs text-emerald-400 font-bold uppercase tracking-widest">
              [ PAGAMENTO CONFIRMADO ]
            </div>
            <h4 className="text-xl font-bold uppercase text-white">
              Sua Licença Foi Ativada com Sucesso
            </h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Sessão única autorizada para <strong className="text-neutral-200">{email}</strong>. Redirecionando para a plataforma...
            </p>
            <div className="font-mono text-[11px] text-amber-400 pt-2">
              [ INGRESSANDO NO AMBIENTE AUTORIZADO... ]
            </div>
          </div>
        ) : (
          <form onSubmit={handleSimulatePayment} className="mt-5 space-y-5">
            {/* Plan Summary Box */}
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-neutral-400 uppercase">PLANO SELECIONADO</span>
                <span className="font-bold text-neutral-100 uppercase">
                  {plan === 'monthly' ? 'Plano Mensal Flexível' : 'Plano Anual Fundador'}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-neutral-800">
                <span className="text-neutral-400">VALOR DA LICENÇA:</span>
                <div className="text-right">
                  <span className="font-mono text-lg font-black text-amber-400">{price}</span>
                  <span className="text-[10px] text-neutral-500 ml-1">/{recurrence}</span>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome ou marca"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  E-mail para Liberação de Licença
                </label>
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-2">
                Método de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`py-2.5 px-3 border rounded text-center font-mono font-bold cursor-pointer transition-all ${
                    paymentMethod === 'pix'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  [ PIX • APROVAÇÃO INSTANTÂNEA ]
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2.5 px-3 border rounded text-center font-mono font-bold cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  [ CARTÃO DE CRÉDITO ]
                </button>
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <div className="p-3 bg-neutral-900/40 border border-neutral-800 rounded text-[11px] text-neutral-400 space-y-1">
              <div className="font-mono text-neutral-300 font-bold uppercase">
                GARANTIA DE SEGURANÇA E ANTI-TRAPAÇA:
              </div>
              <p>
                Sua chave de licença é individual e intransferível. A plataforma autoriza 1 sessão única simultânea e disponibiliza o acesso imediato ao motor de produtos campeões e ao canal do Telegram.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isProcessing
                ? 'PROCESSANDO E VINCULANDO SESSÃO...'
                : `CONFIRMAR ASSINATURA — ${price}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
