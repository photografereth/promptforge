import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

export const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Política de Privacidade" lastUpdated="23 de setembro de 2026">
    <p>
      Esta Política de Privacidade descreve como [RAZÃO SOCIAL] ("PromptForge", "nós") trata os dados
      pessoais de quem usa o Flow Prompt Forge, em conformidade com a Lei Geral de Proteção de Dados
      (Lei nº 13.709/2018, "LGPD").
    </p>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">1. Quem é o controlador</h2>
      <p>
        [RAZÃO SOCIAL], CNPJ/CPF [CNPJ/CPF], é o controlador dos dados pessoais tratados no serviço.
        Contato: [E-MAIL DE CONTATO].
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">2. Quais dados coletamos</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong className="text-neutral-100">Dados de cadastro:</strong> e-mail e, se você informar,
          nome de exibição.
        </li>
        <li>
          <strong className="text-neutral-100">Dados de uso:</strong> contagem diária de gerações de
          IA (para aplicar o limite descrito nos Termos de Uso), histórico de eventos de assinatura
          (para suporte e auditoria de cobrança).
        </li>
        <li>
          <strong className="text-neutral-100">Dados de pagamento:</strong> não coletamos nem
          armazenamos dados de cartão. O processamento é feito inteiramente pelo Mercado Pago;
          recebemos apenas o status da cobrança (aprovado, recusado, cancelado) e identificadores da
          transação.
        </li>
        <li>
          <strong className="text-neutral-100">Conteúdo enviado por você:</strong> prompts, texto e
          imagens de produto/referência que você envia às funcionalidades de IA são transmitidos à API
          do Google Gemini para gerar a resposta e não são armazenados pelo PromptForge após a resposta
          ser retornada.
        </li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">3. Por que tratamos esses dados (base legal)</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong className="text-neutral-100">Execução do contrato</strong> (art. 7º, V, LGPD): manter
          sua conta, processar sua assinatura, aplicar o limite de uso, dar suporte.
        </li>
        <li>
          <strong className="text-neutral-100">Cumprimento de obrigação legal</strong> (art. 7º, II):
          manter registros necessários para fins fiscais e de defesa em caso de disputa de cobrança.
        </li>
        <li>
          <strong className="text-neutral-100">Legítimo interesse</strong> (art. 7º, IX), quando
          aplicável: prevenção a fraude e abuso do serviço.
        </li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">4. Com quem compartilhamos</h2>
      <ul className="list-disc list-inside space-y-2">
        <li><strong className="text-neutral-100">Supabase:</strong> hospeda nosso banco de dados e sistema de autenticação.</li>
        <li><strong className="text-neutral-100">Mercado Pago:</strong> processa pagamentos e cobranças recorrentes.</li>
        <li><strong className="text-neutral-100">Google (API do Gemini):</strong> processa os prompts e imagens que você envia às funcionalidades de IA, para gerar a resposta.</li>
      </ul>
      <p className="mt-2">Não vendemos seus dados pessoais a terceiros.</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">5. Transferência internacional</h2>
      <p>
        A API do Google Gemini pode processar dados fora do Brasil. Esse processamento é limitado ao
        necessário para gerar a resposta da funcionalidade de IA que você usou, e segue as salvaguardas
        contratuais do próprio provedor.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">6. Por quanto tempo guardamos os dados</h2>
      <p>
        Mantemos os dados da sua conta enquanto ela estiver ativa. Registros de cobrança são mantidos
        pelo prazo exigido pela legislação fiscal aplicável, mesmo após o cancelamento da conta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">7. Seus direitos como titular (art. 18 da LGPD)</h2>
      <p>Você pode solicitar, a qualquer momento, via [E-MAIL DE CONTATO]:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>confirmação de que tratamos seus dados;</li>
        <li>acesso aos dados;</li>
        <li>correção de dados incompletos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>portabilidade dos dados a outro fornecedor;</li>
        <li>eliminação dos dados tratados com base no seu consentimento;</li>
        <li>informação sobre com quem compartilhamos seus dados;</li>
        <li>revogação do consentimento, quando aplicável.</li>
      </ul>
      <p className="mt-2">Responderemos dentro do prazo previsto na LGPD.</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">8. Segurança</h2>
      <p>
        Usamos práticas técnicas razoáveis para proteger seus dados (controle de acesso, criptografia
        em trânsito, isolamento de dados por usuário no banco de dados). Nenhum sistema é 100% livre de
        risco; se houver um incidente de segurança relevante, avisaremos conforme exigido por lei.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">9. Cookies</h2>
      <p>
        Usamos apenas o cookie de sessão estritamente necessário para manter você autenticado (via
        Supabase Auth). Não usamos cookies de rastreamento, analytics ou publicidade de terceiros.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">10. Encarregado de dados (DPO)</h2>
      <p>Contato do encarregado: [E-MAIL DE CONTATO].</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">11. Alterações nesta Política</h2>
      <p>Podemos atualizar esta Política. Mudanças relevantes serão comunicadas por e-mail ou aviso no serviço.</p>
    </section>
  </LegalPageLayout>
);
