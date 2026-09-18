import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const price = plan === 'monthly' ? 'R$ 119,00' : 'R$ 948,00';
  const recurrence = plan === 'monthly' ? 'por mês (cartão ou pix)' : 'por ano (equivale a 12x R$ 79,00)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || undefined } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      setCompleted(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível processar sua solicitação. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleProcessing(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // O navegador é redirecionado para o Google; ao voltar, a sessão já estará
      // ativa e o useSupabaseSession() do App detecta automaticamente.
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível iniciar o login com Google.');
      setIsGoogleProcessing(false);
    }
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
              [ CONTA CRIADA ]
            </div>
            <h4 className="text-xl font-bold uppercase text-white">
              Sua Conta Foi Criada com Sucesso
            </h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Sessão iniciada para <strong className="text-neutral-200">{email}</strong>. Redirecionando para a plataforma...
            </p>
            <div className="font-mono text-[11px] text-amber-400 pt-2">
              [ INGRESSANDO NO AMBIENTE AUTORIZADO... ]
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
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
              <p className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
                Pagamento será solicitado após a criação da conta — nenhuma cobrança é feita agora.
              </p>
            </div>

            {/* Auth mode toggle */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`uppercase px-2 py-1 rounded cursor-pointer ${
                  authMode === 'signup' ? 'text-amber-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Criar Conta
              </button>
              <span className="text-neutral-700">/</span>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`uppercase px-2 py-1 rounded cursor-pointer ${
                  authMode === 'login' ? 'text-amber-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Já Tenho Conta
              </button>
            </div>

            {/* Google login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleProcessing}
              className="w-full py-2.5 border border-neutral-700 rounded text-xs font-semibold text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGoogleProcessing ? 'REDIRECIONANDO...' : 'CONTINUAR COM GOOGLE'}
            </button>

            <div className="flex items-center gap-3 text-[10px] text-neutral-600 uppercase font-mono">
              <div className="flex-1 h-px bg-neutral-800" />
              ou com e-mail
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Seu nome ou marca"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  E-mail
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

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/70 border border-red-800/80 rounded text-[11px] text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Security Guarantee Notice */}
            <div className="p-3 bg-neutral-900/40 border border-neutral-800 rounded text-[11px] text-neutral-400 space-y-1">
              <div className="font-mono text-neutral-300 font-bold uppercase">
                GARANTIA DE SEGURANÇA E ANTI-TRAPAÇA:
              </div>
              <p>
                Sua conta é individual e intransferível. A plataforma autoriza 1 sessão única simultânea e disponibiliza o acesso imediato ao motor de produtos campeões e ao canal do Telegram.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isProcessing
                ? 'PROCESSANDO...'
                : authMode === 'signup'
                ? 'CRIAR CONTA E CONTINUAR'
                : 'ENTRAR'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
