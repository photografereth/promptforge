export interface EmailMessage {
  subject: string;
  html: string;
}

export interface Mailer {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function createResendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(to, message) {
      if (!apiKey || !from) throw new Error('Resend não configurado (RESEND_API_KEY/MAIL_FROM).');
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: message.subject, html: message.html }),
      });
      if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
    },
  };
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string): string {
  return (
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">` +
    `<h2>${esc(title)}</h2>${body}` +
    `<p style="color:#666;font-size:12px;margin-top:24px">Flow Prompt Forge</p></div>`
  );
}

export const emails = {
  paymentFailed(p: { graceUntil: Date; updateCardUrl: string }): EmailMessage {
    return {
      subject: 'Não conseguimos processar a cobrança da sua assinatura',
      html: layout(
        'Cobrança não aprovada',
        `<p>Não conseguimos cobrar o cartão da sua assinatura. Você continua com acesso até <strong>${dateFmt.format(p.graceUntil)}</strong>.</p>` +
          `<p>Para não perder o acesso, atualize seu cartão: <a href="${esc(p.updateCardUrl)}">${esc(p.updateCardUrl)}</a></p>`
      ),
    };
  },
  subscriptionCanceled(p: { accessUntil: Date | null }): EmailMessage {
    const access = p.accessUntil
      ? `<p>Você continua com acesso até <strong>${dateFmt.format(p.accessUntil)}</strong>.</p>`
      : `<p>O acesso foi encerrado.</p>`;
    return {
      subject: 'Sua assinatura foi cancelada',
      html: layout('Assinatura cancelada', `<p>Confirmamos o cancelamento da sua assinatura.</p>${access}`),
    };
  },
  planChangeScheduled(p: { planLabel: string; effectiveAt: Date }): EmailMessage {
    return {
      subject: 'Troca de plano agendada',
      html: layout(
        'Troca de plano agendada',
        `<p>Seu plano mudará para <strong>${esc(p.planLabel)}</strong> em <strong>${dateFmt.format(p.effectiveAt)}</strong>, na próxima renovação. Nenhuma cobrança extra agora.</p>`
      ),
    };
  },
  refundDone(p: { amount: number }): EmailMessage {
    return {
      subject: 'Reembolso concluído',
      html: layout(
        'Reembolso concluído',
        `<p>Reembolsamos <strong>${brl.format(p.amount)}</strong> e encerramos sua assinatura. O valor pode levar alguns dias para aparecer na fatura do cartão.</p>`
      ),
    };
  },
  receipt(p: { planLabel: string; amount: number; nextChargeAt: Date | null }): EmailMessage {
    const next = p.nextChargeAt ? `<p>Próxima cobrança: <strong>${dateFmt.format(p.nextChargeAt)}</strong>.</p>` : '';
    return {
      subject: 'Recibo da sua assinatura',
      html: layout(
        'Pagamento confirmado',
        `<p>Recebemos <strong>${brl.format(p.amount)}</strong> referente ao <strong>${esc(p.planLabel)}</strong>. Obrigado!</p>${next}`
      ),
    };
  },
};
