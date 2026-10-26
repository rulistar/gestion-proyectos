import { formatDate } from './dates';

/** Mañana (AAAA-MM-DD) a partir de hoy */
function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Fecha de fin de una tarea abierta, coloreada por urgencia (HU-28): vencida en rojo, hoy y
 * mañana en dorado, lo demás en gris. `today` es la fecha local del usuario.
 */
export function dueInfo(endDate: string | null, today: string) {
  if (endDate === null) {
    return { text: 'Sin fecha', overdue: false, className: 'bg-muted text-muted-foreground' };
  }
  if (endDate < today) {
    return {
      text: `Vencida: ${formatDate(endDate)}`,
      overdue: true,
      className: 'bg-destructive/10 text-destructive',
    };
  }
  const soon = 'bg-warning/30 text-warning-foreground';
  if (endDate === today) return { text: 'Hoy', overdue: false, className: soon };
  if (endDate === nextDay(today)) return { text: 'Mañana', overdue: false, className: soon };
  return { text: formatDate(endDate), overdue: false, className: 'bg-muted text-foreground' };
}
