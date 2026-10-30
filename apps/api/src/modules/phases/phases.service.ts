import {
  MAX_PHASE_DEPTH,
  phaseDescendantIds,
  type CreatePhaseInput,
  type MovePhaseInput,
  type Phase,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';

/** El tipo del contenedor no usa fases (→ 409) */
export class PhasesDisabledError extends Error {}
/** La fase madre no existe en ese proyecto (→ 400) */
export class InvalidParentPhaseError extends Error {}
/** Pasaría de MAX_PHASE_DEPTH niveles (→ 400) */
export class PhaseTooDeepError extends Error {}
/** La fase de una tarea no existe en su proyecto o el proyecto no usa fases (→ 400) */
export class InvalidPhaseError extends Error {}

const phaseSelect = {
  id: true,
  projectId: true,
  parentId: true,
  name: true,
  position: true,
} as const;

/** Fases activas del proyecto en ese workspace; si el proyecto está en la papelera, tampoco */
function phaseScope(workspaceId: string, projectId: string) {
  return { workspaceId, projectId, ...notDeleted, project: notDeleted };
}

type PhaseWhere = { workspaceId: string; projectId: string; phaseId: string };

/** Fases del proyecto (HU-07), en su orden; la web arma el esquema y calcula el avance */
export async function listPhases(db: Db, workspaceId: string, projectId: string): Promise<Phase[]> {
  return db.phase.findMany({
    where: phaseScope(workspaceId, projectId),
    select: phaseSelect,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Nivel de una fase activa: 1 = primer nivel */
async function depthOf(db: Db, phaseId: string): Promise<number> {
  let depth = 0;
  let current: string | null = phaseId;
  while (current && depth <= MAX_PHASE_DEPTH) {
    const row: { parentId: string | null } | null = await db.phase.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    depth += 1;
    current = row?.parentId ?? null;
  }
  return depth;
}

/** El contenedor ya se comprobó (existe, lo ve y lo puede modificar) */
export async function createPhase(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  { name, parentId }: CreatePhaseInput,
): Promise<Phase> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { type: { select: { usesPhases: true } } },
  });
  if (!project.type.usesPhases) throw new PhasesDisabledError();
  if (parentId) {
    const parent = await db.phase.findFirst({
      where: { id: parentId, ...phaseScope(workspaceId, projectId) },
      select: { id: true },
    });
    if (!parent) throw new InvalidParentPhaseError();
    if ((await depthOf(db, parentId)) >= MAX_PHASE_DEPTH) throw new PhaseTooDeepError();
  }
  // Al final de sus hermanas
  const last = await db.phase.aggregate({
    where: { projectId, parentId, ...notDeleted },
    _max: { position: true },
  });
  return db.phase.create({
    data: {
      workspaceId,
      projectId,
      parentId,
      name,
      position: (last._max.position ?? -1) + 1,
      ...auditCreate(actorId),
    },
    select: phaseSelect,
  });
}

/** false si la fase no existe en ese proyecto (→ 404) */
export async function renamePhase(
  db: Db,
  actorId: string,
  { workspaceId, projectId, phaseId }: PhaseWhere,
  name: string,
): Promise<boolean> {
  const { count } = await db.phase.updateMany({
    where: { id: phaseId, ...phaseScope(workspaceId, projectId) },
    data: { name, ...auditUpdate(actorId) },
  });
  return count > 0;
}

/**
 * Sube o baja la fase entre sus hermanas (intercambia el lugar con la vecina). En la primera o la
 * última no hace nada. false si la fase no existe en ese proyecto (→ 404).
 */
export async function movePhase(
  db: Db,
  actorId: string,
  { workspaceId, projectId, phaseId }: PhaseWhere,
  { direction }: MovePhaseInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const phase = await tx.phase.findFirst({
      where: { id: phaseId, ...phaseScope(workspaceId, projectId) },
      select: { parentId: true },
    });
    if (!phase) return false;
    const siblings = await tx.phase.findMany({
      where: { projectId, parentId: phase.parentId, ...notDeleted },
      select: { id: true, position: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const ids = siblings.map((sibling) => sibling.id);
    const from = ids.indexOf(phaseId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) return true;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    // Se renumeran todas: así el orden queda limpio aunque hubiera posiciones repetidas
    for (const [position, id] of ids.entries()) {
      if (siblings.find((sibling) => sibling.id === id)!.position === position) continue;
      await tx.phase.update({ where: { id }, data: { position, ...auditUpdate(actorId) } });
    }
    return true;
  });
}

/**
 * Manda la fase a la papelera con sus subfases y sus tareas (HU-07): todas reciben el mismo
 * deletedAt, así al restaurarla vuelve exactamente lo que se fue con ella. false si no existe.
 */
export async function softDeletePhase(
  db: Db,
  actorId: string,
  { workspaceId, projectId, phaseId }: PhaseWhere,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const phases = await tx.phase.findMany({
      where: phaseScope(workspaceId, projectId),
      select: { id: true, parentId: true, position: true },
    });
    if (!phases.some((phase) => phase.id === phaseId)) return false;
    const ids = [...phaseDescendantIds(phases, phaseId)];
    const data = auditSoftDelete(actorId, new Date());
    await tx.phase.updateMany({ where: { id: { in: ids }, ...notDeleted }, data });
    await tx.task.updateMany({ where: { phaseId: { in: ids }, ...notDeleted }, data });
    return true;
  });
}

/**
 * Fase que recibirá una tarea: undefined = la que ya tenía (al crear, ninguna); null = suelta;
 * otra = una fase activa del mismo proyecto, si su tipo usa fases. Inválida → InvalidPhaseError.
 */
export async function resolvePhase(
  db: Db,
  workspaceId: string,
  projectId: string,
  requested: string | null | undefined,
  current: string | null = null,
): Promise<string | null> {
  if (requested === undefined || requested === current) return current;
  if (requested === null) return null;
  const phase = await db.phase.findFirst({
    where: {
      id: requested,
      workspaceId,
      projectId,
      ...notDeleted,
      project: { ...notDeleted, type: { usesPhases: true } },
    },
    select: { id: true },
  });
  if (!phase) throw new InvalidPhaseError();
  return phase.id;
}
