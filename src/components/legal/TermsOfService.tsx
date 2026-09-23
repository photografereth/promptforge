import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

export const TermsOfService: React.FC = () => (
  <LegalPageLayout title="Termos de Uso" lastUpdated="23 de setembro de 2026">
    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">1. Quem somos</h2>
      <p>
        [RAZÃO SOCIAL], inscrita no CNPJ/CPF sob o nº [CNPJ/CPF], doravante "PromptForge", oferece o
        serviço descrito nestes Termos de Uso ("Termos"). Dúvidas: [E-MAIL DE CONTATO].
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">2. O que é o serviço</h2>
      <p>
        O Flow Prompt Forge é uma ferramenta que gera e aprimora prompts em linguagem natural para uso
        com o Google Flow (modelos Veo e Nano Banana/Gemini), voltada para criadores de conteúdo do
        TikTok Shop. O serviço não gera imagens ou vídeos — gera o texto do prompt que você usa em
        outra ferramenta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">3. Cadastro e conta</h2>
      <p>
        Para usar o serviço você precisa criar uma conta com e-mail e senha (ou provedor OAuth
        suportado). Você é responsável por manter suas credenciais em sigilo e por toda atividade
        realizada na sua conta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">4. Planos e cobrança</h2>
      <p>
        O acesso ao serviço é pago, por assinatura recorrente (mensal ou anual, conforme o plano
        exibido no momento da contratação). A cobrança é processada pelo Mercado Pago; o PromptForge
        nunca tem acesso aos dados do seu cartão. A assinatura renova automaticamente ao fim de cada
        ciclo, até que você cancele.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">5. Direito de arrependimento</h2>
      <p>
        Nos termos do art. 49 do Código de Defesa do Consumidor, você pode desistir da assinatura em
        até 7 (sete) dias corridos contados da primeira cobrança, com reembolso integral e
        cancelamento imediato do acesso. Após esse prazo, o cancelamento (seção 6) não gera reembolso
        proporcional do período já pago.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">6. Cancelamento</h2>
      <p>
        Você pode cancelar a qualquer momento. O acesso permanece ativo até o fim do período já pago.
        Em caso de falha na cobrança de renovação, mantemos o acesso por um período de carência antes
        de suspender a conta, com aviso.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">7. Limite de uso</h2>
      <p>
        As funcionalidades de IA (aprimoramento de prompt, preenchimento automático, análise de
        referências e importação de produto) têm um limite diário compartilhado de gerações por conta,
        que reseta à meia-noite (horário de São Paulo). O limite existe para manter o serviço
        sustentável para todos os usuários e pode ser ajustado; mudanças relevantes serão comunicadas.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">8. Uso aceitável</h2>
      <p>Você concorda em não:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>tentar acessar o serviço além do seu uso individual autorizado;</li>
        <li>fazer engenharia reversa, raspagem automatizada (scraping) ou contornar limites técnicos do serviço;</li>
        <li>revender, sublicenciar ou compartilhar credenciais de acesso;</li>
        <li>usar o serviço para gerar conteúdo ilegal, enganoso ou que viole direitos de terceiros.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">9. Propriedade dos resultados</h2>
      <p>
        Os prompts gerados a partir do seu uso do serviço são seus, para usar como quiser. O
        PromptForge não reivindica direitos sobre o conteúdo gerado.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">10. Disponibilidade e limitação de responsabilidade</h2>
      <p>
        O serviço depende de provedores externos (Google, Mercado Pago, Supabase) e pode sofrer
        indisponibilidades fora do nosso controle. O serviço é fornecido "como está"; na extensão
        máxima permitida por lei, não respondemos por lucros cessantes ou danos indiretos decorrentes
        do uso ou impossibilidade de uso do serviço.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">11. Alterações nestes Termos</h2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail ou aviso no
        serviço, com antecedência razoável. O uso continuado após a alteração implica concordância com
        os novos Termos.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">12. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do seu domicílio para
        dirimir eventuais controvérsias, conforme o Código de Defesa do Consumidor.
      </p>
    </section>
  </LegalPageLayout>
);
