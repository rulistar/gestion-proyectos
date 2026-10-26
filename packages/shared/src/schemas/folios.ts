import type { ProjectBehavior } from './project-types.js';

/**
 * Prefijo del folio automático según el comportamiento del contenedor (HU-38): todos los
 * mantenimientos comparten MT, los proyectos usan PY y las actividades ACT.
 */
export const FOLIO_PREFIXES: Record<ProjectBehavior, string> = {
  WITH_END: 'PY',
  ONGOING: 'MT',
  ON_DEMAND: 'ACT',
};

/** Periodo del contador: AAMM de la fecha local del usuario ("2026-10-28" → "2610") */
export function folioPeriod(today: string): string {
  return today.slice(2, 4) + today.slice(5, 7);
}

/**
 * Folio automático (decisión del PO): prefijo + AAMM + "-" + contador de 3 dígitos, que vuelve a
 * empezar cada mes. Pasado el 999 sigue creciendo (MT2610-1000).
 */
export function formatFolio(prefix: string, period: string, number: number): string {
  return `${prefix}${period}-${String(number).padStart(3, '0')}`;
}
