import { z } from 'zod';
import { optionalId } from './common.js';
import { summarizeTasks, type ProjectProgress } from './progress.js';
import type { TaskStatus } from './tasks.js';

/** Una fase contiene tareas y otras fases, hasta 4 niveles (HU-07) */
export const MAX_PHASE_DEPTH = 4;

/** Fase de un proyecto: solo nombre y orden; avance y fechas se calculan (summarizePhase) */
export const phaseSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  /** Fase que la contiene; null = primer nivel */
  parentId: z.uuid().nullable(),
  name: z.string(),
  /** Orden entre sus hermanas */
  position: z.number().int(),
});
export type Phase = z.infer<typeof phaseSchema>;

export const phaseListSchema = z.array(phaseSchema);

const phaseName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'Máximo 120 caracteres');

/** Cuerpo de POST .../projects/:projectId/phases; sin parentId va al primer nivel */
export const createPhaseSchema = z.object({ name: phaseName, parentId: optionalId });
export type CreatePhaseInput = z.infer<typeof createPhaseSchema>;

/** Cuerpo de PATCH .../phases/:phaseId: renombrar */
export const renamePhaseSchema = z.object({ name: phaseName });
export type RenamePhaseInput = z.infer<typeof renamePhaseSchema>;

/** Cuerpo de POST .../phases/:phaseId/move: subir o bajar entre sus hermanas */
export const movePhaseSchema = z.object({ direction: z.enum(['up', 'down']) });
export type MovePhaseInput = z.infer<typeof movePhaseSchema>;

type PhaseLike = Pick<Phase, 'id' | 'parentId' | 'position'>;

/** Lo que una fase necesita de cada tarea para calcular su avance y sus fechas */
export interface PhaseTask {
  phaseId: string | null;
  status: TaskStatus;
  estimatedMinutes: number | null;
  startDate: string | null;
  endDate: string | null;
}

/** Nivel de cada fase: 1 = primer nivel. Una fase cuya madre no está en la lista cuenta como 1 */
export function phaseDepths(phases: readonly PhaseLike[]): Map<string, number> {
  const byId = new Map(phases.map((phase) => [phase.id, phase]));
  const depths = new Map<string, number>();
  const depthOf = (phase: PhaseLike, seen: Set<string>): number => {
    const known = depths.get(phase.id);
    if (known !== undefined) return known;
    const parent = phase.parentId ? byId.get(phase.parentId) : undefined;
    // `seen` evita un ciclo infinito si los datos vinieran mal
    const depth = parent && !seen.has(parent.id) ? depthOf(parent, seen.add(phase.id)) + 1 : 1;
    depths.set(phase.id, depth);
    return depth;
  };
  for (const phase of phases) depthOf(phase, new Set());
  return depths;
}

/** La fase y todas las que contiene, a cualquier nivel */
export function phaseDescendantIds(phases: readonly PhaseLike[], phaseId: string): Set<string> {
  const ids = new Set([phaseId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const phase of phases) {
      if (phase.parentId && ids.has(phase.parentId) && !ids.has(phase.id)) {
        ids.add(phase.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Las fases como esquema: cada madre seguida de sus hijas, en su orden, con su nivel. Sirve para
 * los selectores (con sangría) y para recorrer el árbol.
 */
export function orderedPhases<P extends PhaseLike>(
  phases: readonly P[],
): { phase: P; depth: number }[] {
  const ids = new Set(phases.map((phase) => phase.id));
  const childrenOf = (parentId: string | null) =>
    phases
      .filter((phase) =>
        parentId === null
          ? phase.parentId === null || !ids.has(phase.parentId)
          : phase.parentId === parentId,
      )
      .sort((a, b) => a.position - b.position);
  const result: { phase: P; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const phase of childrenOf(parentId)) {
      result.push({ phase, depth });
      visit(phase.id, depth + 1);
    }
  };
  visit(null, 1);
  return result;
}

/** Avance y fechas de una fase, calculados con todo lo que contiene */
export type PhaseSummary = Pick<
  ProjectProgress,
  'totalTasks' | 'doneTasks' | 'percent' | 'pendingMinutes'
> & {
  /** Inicio más temprano de sus tareas (null si ninguna tiene) */
  startDate: string | null;
  /** Fin más tardío de sus tareas (null si ninguna tiene) */
  endDate: string | null;
};

/**
 * Avance (reglas de HU-06) y fechas de una fase con las tareas de ella y de sus subfases, a
 * cualquier nivel (HU-07). No se capturan a mano.
 */
export function summarizePhase(
  phases: readonly PhaseLike[],
  tasks: readonly PhaseTask[],
  phaseId: string,
): PhaseSummary {
  const ids = phaseDescendantIds(phases, phaseId);
  const inside = tasks.filter((task) => task.phaseId !== null && ids.has(task.phaseId));
  const starts = inside.flatMap((task) => (task.startDate ? [task.startDate] : []));
  const ends = inside.flatMap((task) => (task.endDate ? [task.endDate] : []));
  return {
    ...summarizeTasks(inside),
    // Las fechas AAAA-MM-DD se comparan como texto
    startDate: starts.length > 0 ? starts.reduce((a, b) => (b < a ? b : a)) : null,
    endDate: ends.length > 0 ? ends.reduce((a, b) => (b > a ? b : a)) : null,
  };
}

/** Tareas sueltas: sin fase, o con una fase que no está en la lista */
export function loosePhaseTasks<T extends Pick<PhaseTask, 'phaseId'>>(
  phases: readonly Pick<Phase, 'id'>[],
  tasks: readonly T[],
): T[] {
  const ids = new Set(phases.map((phase) => phase.id));
  return tasks.filter((task) => task.phaseId === null || !ids.has(task.phaseId));
}

/** Un renglón de la Lista agrupada por fase (HU-26): el encabezado de una fase o una tarea */
export type PhaseListRow<P, T> =
  | { kind: 'phase'; phase: P; depth: number; count: number }
  | { kind: 'loose'; count: number }
  | { kind: 'task'; task: T; depth: number; phaseId: string | null };

/**
 * Agrupa las tareas por fase, con sangría (HU-26): cada fase, sus tareas (en el orden recibido, ya
 * filtrado y ordenado) y luego sus subfases. Al final, "Sin fase". Una fase sin tareas en ella ni en
 * sus subfases no aparece. `count` = tareas de la fase y de sus subfases.
 * Ejemplo: "Módulo 101" (2), su tarea, "Tema 1" (1), su tarea, y "Sin fase" (1) con la suelta.
 */
export function groupTasksByPhase<P extends PhaseLike, T extends { phaseId: string | null }>(
  tasks: readonly T[],
  phases: readonly P[],
): PhaseListRow<P, T>[] {
  const known = new Set(phases.map((phase) => phase.id));
  const byPhase = new Map<string | null, T[]>();
  for (const task of tasks) {
    const key = task.phaseId !== null && known.has(task.phaseId) ? task.phaseId : null;
    byPhase.set(key, [...(byPhase.get(key) ?? []), task]);
  }
  const rows: PhaseListRow<P, T>[] = [];
  for (const { phase, depth } of orderedPhases(phases)) {
    let count = 0;
    for (const id of phaseDescendantIds(phases, phase.id)) count += byPhase.get(id)?.length ?? 0;
    if (count === 0) continue;
    rows.push({ kind: 'phase', phase, depth, count });
    for (const task of byPhase.get(phase.id) ?? []) {
      rows.push({ kind: 'task', task, depth: depth + 1, phaseId: phase.id });
    }
  }
  const loose = byPhase.get(null) ?? [];
  if (loose.length > 0) {
    rows.push({ kind: 'loose', count: loose.length });
    for (const task of loose) rows.push({ kind: 'task', task, depth: 2, phaseId: null });
  }
  return rows;
}
