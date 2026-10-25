const dateFormat = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  // La fecha "2026-11-15" es medianoche UTC: se formatea en UTC para que no se mueva un día
  timeZone: 'UTC',
});

/** "2026-11-15" → "15 nov 2026"; sin fecha → "—" */
export function formatDate(isoDate: string | null): string {
  return isoDate ? dateFormat.format(new Date(`${isoDate}T00:00:00Z`)) : '—';
}

/** Fecha de hoy en la zona horaria del usuario, como AAAA-MM-DD */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 95 → "1 h 35 min"; 45 → "45 min"; 120 → "2 h" */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
