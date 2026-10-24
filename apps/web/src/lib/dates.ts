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
