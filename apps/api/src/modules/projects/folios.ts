import {
  FOLIO_PREFIXES,
  folioPeriod,
  formatFolio,
  isRepeatableFolio,
  parseFolioTemplate,
  type ProjectBehavior,
} from '@gestion/shared';
import type { Tx } from '../../db/client.js';

/** El folio ya lo tiene otro contenedor del espacio, aunque esté en la papelera (→ 409) */
export class DuplicateFolioError extends Error {
  constructor(readonly folio: string) {
    super('Folio duplicado');
  }
}

/**
 * ¿Otro contenedor del espacio ya usa ese folio? Sin distinguir mayúsculas ("mt2610-001" =
 * "MT2610-001"). Cuenta también lo que está en la papelera: al restaurarlo no habría dos iguales.
 */
async function folioTaken(tx: Tx, workspaceId: string, folio: string, exceptId?: string) {
  const found = await tx.project.findFirst({
    where: {
      workspaceId,
      folio: { equals: folio, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * Siguiente folio libre del espacio para ese prefijo y periodo (HU-38), p. ej. "MT2610-004". El
 * upsert es atómico en PostgreSQL (INSERT ... ON CONFLICT DO UPDATE): dos altas a la vez nunca
 * reciben el mismo número. Si alguien ya tecleó a mano ese número, se salta al siguiente.
 */
async function nextFolio(tx: Tx, workspaceId: string, prefix: string, period: string) {
  for (;;) {
    const counter = await tx.folioCounter.upsert({
      where: { workspaceId_prefix_period: { workspaceId, prefix, period } },
      create: { workspaceId, prefix, period, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });
    const folio = formatFolio(prefix, period, counter.lastNumber);
    if (!(await folioTaken(tx, workspaceId, folio))) return folio;
  }
}

/**
 * Folio que se guardará (HU-38):
 * - vacío al crear → el automático de su sección (PY, MT o ACT) y del mes del usuario;
 * - vacío al editar → vacío;
 * - solo el formato ("MT", "PY2611-") → se completa con el número vigente;
 * - "Sin folio" → se respeta: es el único que puede repetirse (HU-43);
 * - cualquier otro → se respeta, si no lo tiene otro contenedor del espacio (o es el que ya tenía).
 */
export async function resolveFolio(
  tx: Tx,
  workspaceId: string,
  requested: string | null,
  {
    behavior,
    today,
    current,
  }: {
    behavior: ProjectBehavior;
    today: string;
    current?: { id: string; folio: string | null };
  },
): Promise<string | null> {
  if (requested === null) {
    return current
      ? null
      : nextFolio(tx, workspaceId, FOLIO_PREFIXES[behavior], folioPeriod(today));
  }
  const template = parseFolioTemplate(requested);
  if (template) {
    return nextFolio(tx, workspaceId, template.prefix, template.period ?? folioPeriod(today));
  }
  if (isRepeatableFolio(requested)) return requested;
  // Conservar el folio que ya tenía no se valida: puede venir repetido de antes de HU-38
  if (current && current.folio?.toLowerCase() === requested.toLowerCase()) return requested;
  if (await folioTaken(tx, workspaceId, requested, current?.id)) {
    throw new DuplicateFolioError(requested);
  }
  return requested;
}
