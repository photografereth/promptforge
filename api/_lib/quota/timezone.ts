const TIME_ZONE = 'America/Sao_Paulo';

// Offset (em ms) da timezone em relação a UTC no instante `date`. Não assume um
// offset fixo (-3h): funciona mesmo se o Brasil reintroduzir horário de verão.
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const asIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUTC - date.getTime();
}

export function todaySaoPauloDateString(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

export function nextMidnightSaoPaulo(now: Date): Date {
  const [year, month, day] = todaySaoPauloDateString(now).split('-').map(Number);
  const tomorrowAsIfUTC = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const offsetMs = timeZoneOffsetMs(tomorrowAsIfUTC, TIME_ZONE);
  return new Date(tomorrowAsIfUTC.getTime() - offsetMs);
}
