import { FOLIO_PREFIXES, folioPeriod, formatFolio, type ProjectBehavior } from '@gestion/shared';
import type { Tx } from '../../db/client.js';

/**
 * Siguiente folio automático del espacio (HU-38), p. ej. "MT2610-004". El upsert es atómico en
 * PostgreSQL (INSERT ... ON CONFLICT DO UPDATE): dos altas a la vez nunca reciben el mismo número.
 * `today` es la fecha local del usuario (AAAA-MM-DD): decide el mes del contador.
 */
export async function nextFolio(
  tx: Tx,
  workspaceId: string,
  behavior: ProjectBehavior,
  today: string,
): Promise<string> {
  const prefix = FOLIO_PREFIXES[behavior];
  const period = folioPeriod(today);
  const counter = await tx.folioCounter.upsert({
    where: { workspaceId_prefix_period: { workspaceId, prefix, period } },
    create: { workspaceId, prefix, period, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return formatFolio(prefix, period, counter.lastNumber);
}
