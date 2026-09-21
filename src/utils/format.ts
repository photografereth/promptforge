const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

export function formatBRL(value: number): string {
  return brlFmt.format(value);
}
