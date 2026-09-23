import React from 'react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({ title, lastUpdated, children }) => (
  <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-amber-500 selection:text-neutral-950">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <a
        href="/"
        className="font-mono text-[11px] uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
      >
        ← Voltar para o Flow Prompt Forge
      </a>
      <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight text-neutral-100">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500">Última atualização: {lastUpdated}</p>
      <div className="mt-10 space-y-8 text-neutral-300 leading-relaxed text-sm sm:text-base">{children}</div>
    </div>
  </div>
);
