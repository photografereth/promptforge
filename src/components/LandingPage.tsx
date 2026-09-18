import React, { useState } from 'react';

interface LandingPageProps {
  onEnterApp: () => void;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp, onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-amber-500 selection:text-neutral-950">
      {/* Top Banner / Status Strip */}
      <div className="border-b border-neutral-900 bg-neutral-950/80 px-4 py-2 text-center text-xs tracking-wider text-neutral-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-mono text-[11px] uppercase text-neutral-300">
              SISTEMA ATIVO • GOOGLE FLOW (OMNI 1.1 FLASH & VEO ATÉ 10S) • TIKTOK SHOP READY
            </span>
          </div>
          <div className="font-mono text-[11px] text-neutral-400">
            LICENÇAS INDIVIDUAIS • SESSÃO ÚNICA PROTEGIDA
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 border-b border-neutral-900/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-base sm:text-lg font-black tracking-tight text-neutral-100 uppercase">
              FLOW PROMPT FORGE
            </span>
            <span className="hidden md:inline-block font-mono text-[10px] tracking-widest uppercase border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-amber-400 rounded">
              AFFILIATE SUITE V1.4
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs uppercase font-medium tracking-wider text-neutral-400">
            <a href="#solucao" className="hover:text-neutral-200 transition-colors">
              A Solução
            </a>
            <a href="#arquitetura" className="hover:text-neutral-200 transition-colors">
              3 Agentes
            </a>
            <a href="#produtos" className="hover:text-neutral-200 transition-colors">
              Produtos Campeões
            </a>
            <a href="#seguranca" className="hover:text-neutral-200 transition-colors">
              Anti-Trapaça
            </a>
            <a href="#planos" className="hover:text-amber-400 transition-colors">
              Planos & Acesso
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEnterApp}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-300 border border-neutral-800 hover:border-neutral-700 hover:text-white bg-neutral-900/80 rounded transition-all cursor-pointer"
            >
              Acessar Plataforma
            </button>
            <a
              href="#planos"
              className="hidden sm:inline-block px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded transition-all shadow-sm cursor-pointer"
            >
              Assinar Agora
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-neutral-900 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-1 rounded text-xs font-mono text-amber-300 uppercase tracking-widest mb-6">
            AUTOMAÇÃO DE CRIATIVOS DE ALTA RETENÇÃO PARA O TIKTOK SHOP
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-100 uppercase leading-[1.08] max-w-4xl mx-auto">
            PARE DE PERDER HORAS TESTANDO PRODUTOS. ESCALE VENDAS COM ENGENHARIA DE PROMPTS EXCLUSIVA.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-neutral-400 max-w-3xl mx-auto leading-relaxed">
            Identifique os produtos campeões com maior comissão no TikTok Shop e gere prompts
            cinematográficos calibrados para os modelos de vídeo de alta fidelidade como <strong className="text-neutral-200 font-semibold">Omni 1.1 Flash</strong> e <strong className="text-neutral-200 font-semibold">Veo</strong> (vídeos até 10s) e <strong className="text-neutral-200 font-semibold">Nano Banana</strong>. 
            Você só adiciona a sua modelo e gera criativos em 30 segundos nos arquétipos <strong className="text-neutral-200 font-semibold">POV</strong>, <strong className="text-neutral-200 font-semibold">UGC</strong> e <strong className="text-neutral-200 font-semibold">Movimento</strong>.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#planos"
              className="w-full sm:w-auto px-8 py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-sm font-bold uppercase tracking-wider rounded transition-all text-center shadow-lg cursor-pointer"
            >
              Garantir Licença Pessoal — R$ 119/mês
            </a>
            <button
              type="button"
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-neutral-700 text-sm font-bold uppercase tracking-wider rounded transition-all text-center cursor-pointer"
            >
              Abrir Ferramenta (Modo Demonstração)
            </button>
          </div>

          <div className="mt-8 text-xs font-mono text-neutral-500 uppercase tracking-wider">
            LICENÇA INDIVIDUAL EXCLUSIVA • PROTEÇÃO ANTI-COMPARTILHAMENTO • SUPORTE DIRETO
          </div>

          {/* Metric Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-900 border border-neutral-900 rounded-lg overflow-hidden">
            <div className="bg-neutral-950 p-6 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-neutral-100">03</div>
              <div className="text-xs uppercase font-medium text-neutral-400 mt-1">
                Agentes Diretores (POV, UGC, B-Roll)
              </div>
            </div>
            <div className="bg-neutral-950 p-6 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">100%</div>
              <div className="text-xs uppercase font-medium text-neutral-400 mt-1">
                Safe Zone TikTok (9:16 Sem Cortes)
              </div>
            </div>
            <div className="bg-neutral-950 p-6 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-neutral-100">30s</div>
              <div className="text-xs uppercase font-medium text-neutral-400 mt-1">
                Tempo Médio por Prompt Completo
              </div>
            </div>
            <div className="bg-neutral-950 p-6 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">ZERO</div>
              <div className="text-xs uppercase font-medium text-neutral-400 mt-1">
                Espera por Listas Vazadas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Section */}
      <section id="solucao" className="py-20 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
              DIAGNÓSTICO DE MERCADO
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-100 uppercase">
              O GARGALO QUE IMPEDE AFILIADOS DE ESCALAR NO TIKTOK SHOP
            </h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
              O modelo tradicional de criar vídeos com inteligência artificial para o TikTok Shop é quebrado.
              Afiliados perdem dias escrevendo prompts manuais que produzem vídeos com aspecto artificial de plástico,
              distorcem a embalagem real do produto e violam as políticas de comércio da plataforma.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Amateur / Costly Way */}
            <div className="border border-red-950/60 bg-neutral-950 p-6 sm:p-8 rounded-lg">
              <div className="text-xs font-mono text-red-400 uppercase tracking-wider mb-3">
                O MÉTODO COMUM (LENTO E CARO)
              </div>
              <h3 className="text-lg font-bold text-neutral-200 uppercase mb-4">
                Tentativa e Erro sem Validação
              </h3>
              <ul className="space-y-3.5 text-xs sm:text-sm text-neutral-400">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-red-500 font-bold">[ X ]</span>
                  <span>
                    Aguardar dias em grupos de Telegram para receber listas de produtos que já foram saturados por centenas de outros afiliados.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-red-500 font-bold">[ X ]</span>
                  <span>
                    Prompts genéricos que geram rostos plásticos e embalagens irreconhecíveis, destruindo a confiança do comprador.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-red-500 font-bold">[ X ]</span>
                  <span>
                    Vídeos cortados: o botão da sacola de compras cobre a demonstração do produto ou a chamada para ação.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-red-500 font-bold">[ X ]</span>
                  <span>
                    Contas punidas por alegações médicas de cura milagrosa proibidas pelas diretrizes do TikTok.
                  </span>
                </li>
              </ul>
            </div>

            {/* The Flow Prompt Forge Way */}
            <div className="border border-emerald-950/70 bg-neutral-950 p-6 sm:p-8 rounded-lg relative">
              <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">
                COM O FLOW PROMPT FORGE (AUTÔNOMO)
              </div>
              <h3 className="text-lg font-bold text-neutral-200 uppercase mb-4">
                Automação Industrial de Criativos
              </h3>
              <ul className="space-y-3.5 text-xs sm:text-sm text-neutral-300">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                  <span>
                    <strong>Identificação instantânea de produtos campeões</strong> com volume validado, margem e link de comissão imediata.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                  <span>
                    <strong>Ancoragem multimodal por IA:</strong> o frasco, tampa, rótulo e textura física do produto são travados de forma idêntica entre cortes.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                  <span>
                    <strong>Safe Zone 9:16 nativa:</strong> composição matemática garantindo que nenhum elemento vital seja encoberto pelo carrinho ou ícones laterais.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                  <span>
                    <strong>Rastreamento de personagem:</strong> você anexa a foto da sua modelo e os traços faciais se mantêm constantes em todas as cenas.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Specialized Agents Architecture */}
      <section id="arquitetura" className="py-20 border-b border-neutral-900 bg-neutral-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
              ENGENHARIA CINEMATOGRÁFICA
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-100 uppercase">
              3 ARQUÉTIPOS DIRECIONADOS PARA O ALGORITMO DO TIKTOK
            </h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
              Diferente de geradores generalistas, o Flow Prompt Forge possui 3 motores de direção de cena pré-calibrados para reter o usuário nos primeiros 2 segundos e converter no final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Agent 1: POV */}
            <div className="border border-neutral-800 bg-neutral-900/40 p-6 rounded-lg flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-amber-400 uppercase tracking-wider mb-2">
                  ARQUÉTIPO 01
                </div>
                <h3 className="text-lg font-bold text-neutral-100 uppercase mb-3">
                  AGENTE POV (Ponto de Vista 1ª Pessoa)
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-4">
                  Perspectiva subjetiva direta através dos olhos do comprador. Foco tátil nas mãos interagindo com o produto, unboxing físico e demonstração de textura da fórmula com profundidade de campo suave.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
                LENTE: 24mm f/1.8 • ENQUADRAMENTO: Macro / Detalhe • FOCO: Sensorial & Tátil
              </div>
            </div>

            {/* Agent 2: UGC */}
            <div className="border border-neutral-800 bg-neutral-900/40 p-6 rounded-lg flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-sky-400 uppercase tracking-wider mb-2">
                  ARQUÉTIPO 02
                </div>
                <h3 className="text-lg font-bold text-neutral-100 uppercase mb-3">
                  AGENTE UGC (Criadora Autêntica)
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-4">
                  Visual de smartphone 4K real com iluminação natural. Textura orgânica de pele com microporos visíveis (sem aspecto artificial de IA), gancho de retenção nos primeiros 2 segundos e tom comunicativo de recomendação genuína.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
                LENTE: 35mm Frontal • ENQUADRAMENTO: Plano Médio 9:16 • FOCO: Conexão Humana
              </div>
            </div>

            {/* Agent 3: Movimento */}
            <div className="border border-neutral-800 bg-neutral-900/40 p-6 rounded-lg flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-emerald-400 uppercase tracking-wider mb-2">
                  ARQUÉTIPO 03
                </div>
                <h3 className="text-lg font-bold text-neutral-100 uppercase mb-3">
                  AGENTE MOVIMENTO (B-Roll Dinâmico)
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-4">
                  Planos cinematográficos fluidos com travelling orbital 360° em volta do produto. Iluminação comercial com reflexos volumétricos em vidro, plástico, metal e acabamentos premium.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
                LENTE: 50mm Óptica • ENQUADRAMENTO: Orbital 360° • FOCO: Desejo Visual & Status
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Winning Products & Telegram Ecosystem */}
      <section id="produtos" className="py-20 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
                VELOCIDADE DE EXECUÇÃO
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-100 uppercase leading-tight">
                MÁQUINA DE PRODUTOS CAMPEÕES SEM DEPENDER DE TERCEIROS
              </h2>
              <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
                Você não precisa ficar esperando alguém postar uma recomendação em grupos de Telegram para começar a vender. Com o Flow Prompt Forge, você tem acesso imediato à curadoria dos melhores produtos, links de afiliação e taxas de comissão para aplicar nos 3 agentes em segundos.
              </p>

              <div className="mt-8 space-y-4">
                <div className="border border-neutral-800 bg-neutral-900/40 p-4 rounded">
                  <div className="font-bold text-sm text-neutral-200 uppercase">
                    Opção A: Acesso Imediato à Plataforma Web (R$ 119/mês)
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Crie e customize prompts a qualquer hora do dia ou da noite. Você escolhe o produto da esteira, carrega a foto do seu personagem e gera criativos com autonomia absoluta.
                  </div>
                </div>

                <div className="border border-neutral-800 bg-neutral-900/40 p-4 rounded">
                  <div className="font-bold text-sm text-neutral-200 uppercase">
                    Opção B: Alertas no Telegram VIP
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Para quem prefere receber diariamente no smartphone o produto selecionado com o melhor link e briefing pré-estruturado diretamente no canal fechado.
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-neutral-800 bg-neutral-900/80 p-6 rounded-lg">
              <div className="font-mono text-xs text-neutral-500 uppercase tracking-wider pb-3 border-b border-neutral-800 flex justify-between">
                <span>FLUXO SIMPLIFICADO EM 3 ETAPAS</span>
                <span className="text-amber-400 font-bold">TEMPO ESTIMADO: 30 SEG</span>
              </div>

              <div className="mt-6 space-y-6">
                <div className="flex gap-4">
                  <div className="font-mono text-sm font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 w-8 h-8 rounded flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-200 uppercase">
                      Escolha o Produto Campeão
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Selecione um produto da esteira ou envie as fotos do seu frasco/embalagem para a IA ancorar os detalhes físicos invariáveis.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="font-mono text-sm font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 w-8 h-8 rounded flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-200 uppercase">
                      Adicione a Foto da Sua Modelo
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Faça o upload do rosto ou estilo da criadora. O algoritmo trava os traços faciais para manter consistência absoluta em todas as cenas.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="font-mono text-sm font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 w-8 h-8 rounded flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-200 uppercase">
                      Gere os Prompts em 1 Clique
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Receba o código de prompt otimizado para Omni 1.1 Flash e Veo (vídeos até 10s) com safe zone ativa, lente calibrada e sem termos proibidos pelo TikTok.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Anti-Cheat System */}
      <section id="seguranca" className="py-20 border-b border-neutral-900 bg-neutral-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
              INFRAESTRUTURA & PROTEÇÃO
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-100 uppercase">
              LICENÇA PESSOAL EXCLUSIVA E SISTEMA ANTI-TRAPAÇA
            </h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
              O Flow Prompt Forge foi construído para proteger a vantagem competitiva dos assinantes sérios.
              Nenhum rateio, revenda de logins ou vazamento de banco de dados é tolerado pela nossa arquitetura.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="border border-neutral-800 bg-neutral-900/30 p-6 rounded-lg">
              <div className="font-mono text-xs text-amber-400 uppercase tracking-wider mb-2">
                TRAVA 01
              </div>
              <h3 className="text-base font-bold text-neutral-200 uppercase mb-2">
                Sessão Única Ativa
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cada licença permite apenas um dispositivo conectado por vez. Tentativas de login simultâneo deslogam a sessão anterior imediatamente.
              </p>
            </div>

            <div className="border border-neutral-800 bg-neutral-900/30 p-6 rounded-lg">
              <div className="font-mono text-xs text-amber-400 uppercase tracking-wider mb-2">
                TRAVA 02
              </div>
              <h3 className="text-base font-bold text-neutral-200 uppercase mb-2">
                Fingerprint de IP e Hardware
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Detecção inteligente de acessos simultâneos anômalos em cidades ou países distintos para impedir o compartilhamento indevido de contas.
              </p>
            </div>

            <div className="border border-neutral-800 bg-neutral-900/30 p-6 rounded-lg">
              <div className="font-mono text-xs text-amber-400 uppercase tracking-wider mb-2">
                TRAVA 03
              </div>
              <h3 className="text-base font-bold text-neutral-200 uppercase mb-2">
                Rate Limiting Anti-Bot
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Proteção no nível do servidor contra raspagem de dados (scraping) e scripts piratas que tentam sobrecarregar a API da plataforma.
              </p>
            </div>

            <div className="border border-neutral-800 bg-neutral-900/30 p-6 rounded-lg">
              <div className="font-mono text-xs text-amber-400 uppercase tracking-wider mb-2">
                TRAVA 04
              </div>
              <h3 className="text-base font-bold text-neutral-200 uppercase mb-2">
                Garantia de Estabilidade
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Circuit-breaker integrado e balanceamento de carga para garantir 99.9% de uptime mesmo nos horários de pico de postagem do TikTok.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Checkout Section */}
      <section id="planos" className="py-20 border-b border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
            CONDIÇÕES DE ACESSO
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-100 uppercase">
            ESCOLHA O SEU PLANO DE ACESSO EXCLUSIVO
          </h2>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Tenha em mãos a esteira completa para identificar produtos campeões e gerar criativos sem depender de filas ou terceiros.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-10 inline-flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-neutral-800 text-neutral-100 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Mensal (R$ 119/mês)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-amber-400 text-neutral-950 font-black shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Anual (R$ 79/mês • Economize 33%)
            </button>
          </div>

          {/* Pricing Cards Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
            {/* Monthly Card */}
            <div className={`border p-8 rounded-lg flex flex-col justify-between transition-all ${
              billingCycle === 'monthly'
                ? 'border-amber-400/80 bg-neutral-900/60 shadow-xl'
                : 'border-neutral-800 bg-neutral-950 opacity-90'
            }`}>
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-neutral-400">
                    USO MENSAL FLEXÍVEL
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
                    CARTÃO OU PIX
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black font-mono text-neutral-100">
                    R$ 119
                  </span>
                  <span className="text-sm font-medium text-neutral-400">
                    / mês
                  </span>
                </div>

                <p className="mt-4 text-xs text-neutral-400 leading-relaxed">
                  Cobrança mensal no cartão de crédito ou Pix com liberdade total para pausar ou cancelar quando desejar.
                </p>

                <div className="mt-6 pt-6 border-t border-neutral-800 space-y-3 text-xs text-neutral-300">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Acesso irrestrito à plataforma web 24/7</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Os 3 Agentes: POV, UGC e Movimento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Galeria multirreferência de produto e modelo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Catálogo de produtos campeões e comissões</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Acesso exclusivo à comunidade VIP no Telegram</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">[ OK ]</span>
                    <span>Licença individual com sessão única anti-trapaça</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => onSelectPlan('monthly')}
                  className="w-full py-4 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs uppercase tracking-wider rounded transition-all cursor-pointer text-center"
                >
                  Assinar Plano Mensal — R$ 119,00 / mês
                </button>
              </div>
            </div>

            {/* Annual Card */}
            <div className={`border p-8 rounded-lg flex flex-col justify-between relative transition-all ${
              billingCycle === 'annual'
                ? 'border-amber-400 bg-neutral-900/90 shadow-2xl ring-1 ring-amber-400/40'
                : 'border-neutral-800 bg-neutral-950 opacity-90'
            }`}>
              {/* Badge */}
              <div className="absolute -top-3 right-6 bg-amber-400 text-neutral-950 font-mono text-[10px] font-black uppercase px-3 py-1 rounded tracking-wider shadow">
                ECONOMIZE 33% (R$ 480/ANO)
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-amber-400 font-bold">
                    PLANO ANUAL EXCLUSIVO
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">
                    CONDIÇÃO DE FUNDADOR
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black font-mono text-neutral-100">
                    R$ 79
                  </span>
                  <span className="text-sm font-medium text-neutral-400">
                    / mês
                  </span>
                </div>
                <div className="font-mono text-[11px] text-amber-400/90 mt-1">
                  Cobrado em parcela única de R$ 948,00 / ano (79 × 12)
                </div>

                <p className="mt-4 text-xs text-neutral-400 leading-relaxed">
                  Para afiliados, criadores e agências focados em escala contínua com custo mensal reduzido de R$ 79.
                </p>

                <div className="mt-6 pt-6 border-t border-neutral-800 space-y-3 text-xs text-neutral-300">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span><strong>Tudo incluído no Plano Mensal</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span>Desconto real de R$ 480 por ano vs. mensal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span>Travamento do valor de R$ 79/mês nas renovações</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span>Prioridade máxima no processamento de IA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span>Suporte VIP e esteiras prioritárias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">[ OK ]</span>
                    <span>Acesso antecipado a novos agentes e presets</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => onSelectPlan('annual')}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded transition-all shadow-lg cursor-pointer text-center"
                >
                  Garantir Plano Anual — 12x R$ 79 (R$ 948/ano)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 border-b border-neutral-900 bg-neutral-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
              DÚVIDAS FREQUENTES
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100 uppercase">
              PERGUNTAS E RESPOSTAS OBJETIVAS
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Como funciona o acesso à plataforma após a confirmação do pagamento?',
                a: 'A liberação é imediata. Você recebe as credenciais de acesso para a plataforma web e o link de convite exclusivo para ingressar no canal VIP do Telegram.',
              },
              {
                q: 'Eu preciso ter conhecimento técnico de programação ou edição de vídeo?',
                a: 'Não. A ferramenta foi projetada para que você apenas selecione o arquétipo desejado (POV, UGC ou Movimento), anexe as imagens do produto e da sua modelo, e copie o prompt final diretamente para a ferramenta de geração.',
              },
              {
                q: 'Como funciona a segurança e a trava anti-compartilhamento?',
                a: 'Cada conta possui uma chave de licença de uso individual. O sistema monitora sessões ativas simultâneas e faz o logout automático caso outra máquina tente utilizar o mesmo login ao mesmo tempo.',
              },
              {
                q: 'Qual a diferença entre usar a plataforma web e aguardar os envios do Telegram?',
                a: 'Pela plataforma web você tem total autonomia: pode garimpar produtos a qualquer hora, customizar roteiros e gerar dezenas de variações sem depender do horário em que novos produtos são postados no canal do Telegram.',
              },
              {
                q: 'Os prompts gerados respeitam as políticas do TikTok Shop?',
                a: 'Sim. Todos os prompts passam por um filtro ativo contra promessas médicas milagrosas (anti-claims) e incluem a safe zone vertical 9:16 para que nenhuma informação seja coberta pelo botão de compra.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="border border-neutral-800 bg-neutral-900/40 rounded-lg overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 text-sm font-bold text-neutral-200 uppercase cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="font-mono text-xs text-amber-400 font-bold shrink-0">
                    {openFaq === idx ? '[-]' : '[+]'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-xs sm:text-sm text-neutral-400 leading-relaxed border-t border-neutral-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Strip */}
      <section className="py-16 bg-neutral-950 border-b border-neutral-900 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-100 uppercase">
            PRONTO PARA ACELERAR SUAS OPERAÇÕES NO TIKTOK SHOP?
          </h2>
          <p className="mt-3 text-sm text-neutral-400 max-w-2xl mx-auto">
            Junte-se aos criadores e afiliados que automatizaram a criação de criativos de alta retenção.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#planos"
              className="w-full sm:w-auto px-8 py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer"
            >
              Garantir Minha Licença Exclusiva
            </a>
            <button
              type="button"
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer"
            >
              Experimentar Plataforma
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-neutral-950 text-neutral-500 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            FLOW PROMPT FORGE © {new Date().getFullYear()} • TODOS OS DIREITOS RESERVADOS.
          </div>
          <div className="flex items-center gap-6 uppercase text-[11px]">
            <span>TERMOS DE USO</span>
            <span>PRIVACIDADE</span>
            <span>SEGURANÇA</span>
            <span>STATUS: 99.9% UPTIME</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
