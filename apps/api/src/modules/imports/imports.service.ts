import {
  defaultUsesPhases,
  MAX_PHASE_DEPTH,
  normalize,
  validateDetails,
  type DetailField,
  type DetailValues,
  type ImportContainer,
  type ImportData,
  type ImportPreview,
  type ImportTask,
  type ProjectBehavior,
  type ProjectStatus,
  type TaskStatus,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate } from '../../db/dates.js';
import { listDetailFields, parseDetails } from '../detail-fields/detail-fields.service.js';
import { resolveFolio } from '../projects/folios.js';
import { realDatesFor } from '../projects/projects.service.js';
import { completedAtFor, startedAtFor } from '../tasks/tasks.service.js';
import { availableIn } from '../people/people.service.js';

/** Límites para que una carga no tumbe el servicio gratuito */
const MAX_CONTAINERS = 1000;
const MAX_TASKS = 10_000;

/** Motivo que reciben las tareas pausadas o canceladas que llegan sin él (HU-24 lo exige) */
const IMPORTED_REASON = 'Cargada desde archivo';

/** El archivo excede los límites o no trae nada que cargar (→ 400) */
export class ImportTooLargeError extends Error {}

const key = (value: string) => normalize(value.trim());

type ExistingProject = {
  id: string;
  name: string;
  folio: string | null;
  typeId: string;
  status: ProjectStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  details: unknown;
  tasks: {
    id: string;
    title: string;
    typeId: string;
    status: TaskStatus;
    completedAt: Date | null;
    startedAt: Date | null;
    details: unknown;
  }[];
  phases: { id: string; parentId: string | null; name: string }[];
};

/** Lo que ya hay en el espacio, por nombre normalizado */
async function loadWorkspace(db: Db | Tx, workspaceId: string) {
  const [projects, projectTypes, taskTypes, origins, people, fields] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, ...notDeleted },
      select: {
        id: true,
        name: true,
        folio: true,
        typeId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        details: true,
        tasks: {
          where: notDeleted,
          select: {
            id: true,
            title: true,
            typeId: true,
            status: true,
            completedAt: true,
            startedAt: true,
            details: true,
          },
        },
        phases: { where: notDeleted, select: { id: true, parentId: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.projectType.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        behavior: true,
        archivedAt: true,
        allowedTaskTypes: { select: { taskTypeId: true } },
      },
      orderBy: { position: 'asc' },
    }),
    db.taskType.findMany({
      where: { workspaceId },
      select: { id: true, name: true, archivedAt: true },
      orderBy: { position: 'asc' },
    }),
    db.taskOrigin.findMany({
      where: { workspaceId },
      select: { id: true, name: true, archivedAt: true },
    }),
    // Las del espacio y las compartidas con él (HU-50)
    db.person.findMany({
      where: availableIn(workspaceId),
      select: { id: true, name: true, archivedAt: true },
    }),
    listDetailFields(db as Db, workspaceId),
  ]);
  /** Prefiere el activo; si solo hay archivado, ese */
  const byName = <T extends { name: string; archivedAt: Date | null }>(rows: T[]) => {
    const map = new Map<string, T>();
    for (const row of rows) {
      const current = map.get(key(row.name));
      if (!current || (current.archivedAt && !row.archivedAt)) map.set(key(row.name), row);
    }
    return map;
  };
  return {
    projects: projects as ExistingProject[],
    projectTypes: byName(projectTypes),
    taskTypes: byName(taskTypes),
    origins: byName(origins),
    people: byName(people),
    fields,
  };
}

type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;

/** Contenedor existente: por folio o, si no tiene, por nombre (sin distinguir mayúsculas) */
function findProject(workspace: Workspace, container: ImportContainer) {
  if (container.folio) {
    const byFolio = workspace.projects.find(
      (p) => p.folio !== null && key(p.folio) === key(container.folio!),
    );
    if (byFolio) return byFolio;
  }
  return workspace.projects.find((p) => key(p.name) === key(container.name));
}

function findTask(project: ExistingProject | undefined, task: ImportTask) {
  return project?.tasks.find((t) => key(t.title) === key(task.title));
}

/** Rutas de fase que faltan en un contenedor (cada nivel cuenta una vez) */
function missingPhaseCount(project: ExistingProject | undefined, tasks: ImportTask[]): number {
  const existing = new Set<string>();
  if (project) {
    const byId = new Map(project.phases.map((p) => [p.id, p]));
    for (const phase of project.phases) {
      const path: string[] = [];
      let current: typeof phase | undefined = phase;
      while (current) {
        path.unshift(key(current.name));
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      existing.add(path.join('/'));
    }
  }
  const missing = new Set<string>();
  for (const task of tasks) {
    const path = task.phasePath.slice(0, MAX_PHASE_DEPTH).map(key);
    for (let i = 1; i <= path.length; i++) {
      const prefix = path.slice(0, i).join('/');
      if (!existing.has(prefix)) missing.add(prefix);
    }
  }
  return missing.size;
}

/** Nombres que faltan en un catálogo, sin repetir y como vienen en el archivo */
function missingNames(names: (string | null)[], existing: Map<string, unknown>): string[] {
  const seen = new Map<string, string>();
  for (const name of names) {
    if (name && !existing.has(key(name)) && !seen.has(key(name))) seen.set(key(name), name.trim());
  }
  return [...seen.values()];
}

/**
 * Resumen previo (HU-14): qué se crea, qué se actualiza y qué se agrega a los catálogos. No escribe
 * nada; `applyImport` recalcula lo mismo y lo aplica.
 */
export async function previewImport(
  db: Db,
  workspaceId: string,
  data: ImportData,
): Promise<ImportPreview> {
  checkLimits(data);
  const workspace = await loadWorkspace(db, workspaceId);
  const tasks = data.containers.flatMap((c) => c.tasks);
  const items = data.containers.map((container) => {
    const project = findProject(workspace, container);
    const updatedTasks = container.tasks.filter((task) => findTask(project, task)).length;
    return {
      name: container.name,
      action: project ? ('update' as const) : ('create' as const),
      newTasks: container.tasks.length - updatedTasks,
      updatedTasks,
      phases: missingPhaseCount(project, container.tasks),
    };
  });
  return {
    source: data.source,
    containers: {
      created: items.filter((item) => item.action === 'create').length,
      updated: items.filter((item) => item.action === 'update').length,
    },
    tasks: {
      created: items.reduce((sum, item) => sum + item.newTasks, 0),
      updated: items.reduce((sum, item) => sum + item.updatedTasks, 0),
    },
    newCatalog: {
      projectTypes: missingNames(
        data.containers.map((c) => c.typeName),
        workspace.projectTypes,
      ),
      taskTypes: missingNames(
        tasks.map((t) => t.typeName),
        workspace.taskTypes,
      ),
      origins: missingNames(
        tasks.map((t) => t.originName),
        workspace.origins,
      ),
      people: missingNames(
        tasks.map((t) => t.responsibleName),
        workspace.people,
      ),
      phases: items.reduce((sum, item) => sum + item.phases, 0),
    },
    items: items.slice(0, 200).map(({ phases: _phases, ...item }) => item),
    warnings: [...data.warnings, ...deepPhaseWarnings(data)].slice(0, 100),
  };
}

function checkLimits(data: ImportData) {
  if (data.containers.length === 0) {
    throw new ImportTooLargeError(data.warnings[0] ?? 'El archivo no trae contenedores que cargar');
  }
  const tasks = data.containers.reduce((sum, c) => sum + c.tasks.length, 0);
  if (data.containers.length > MAX_CONTAINERS || tasks > MAX_TASKS) {
    throw new ImportTooLargeError(
      `Máximo ${MAX_CONTAINERS} contenedores y ${MAX_TASKS} tareas por archivo`,
    );
  }
}

function deepPhaseWarnings(data: ImportData): string[] {
  return data.containers.flatMap((c) =>
    c.tasks
      .filter((t) => t.phasePath.length > MAX_PHASE_DEPTH)
      .map(
        (t) =>
          `"${t.title}" (${c.name}): la fase tiene más de ${MAX_PHASE_DEPTH} niveles; se usan los primeros ${MAX_PHASE_DEPTH}`,
      ),
  );
}

/**
 * Valores de detalle por nombre → por ID de campo del tipo. Se cargan los que tengan un valor
 * válido; un obligatorio vacío no detiene la carga (son datos que ya existían en otro lado).
 */
function detailsFor(
  fields: DetailField[],
  owner: { projectTypeId: string } | { taskTypeId: string },
  byName: Record<string, string>,
  previous: DetailValues,
  warn: (message: string) => void,
  label: string,
): DetailValues {
  const own = fields.filter(
    (f) =>
      !f.archived &&
      ('projectTypeId' in owner
        ? f.projectTypeId === owner.projectTypeId
        : f.taskTypeId === owner.taskTypeId),
  );
  const input: Record<string, string> = {};
  for (const field of own) {
    const entry = Object.entries(byName).find(([name]) => key(name) === key(field.name));
    if (entry) input[field.id] = entry[1];
  }
  const { values, errors } = validateDetails(
    own.map((field) => ({ ...field, required: false })),
    input,
  );
  for (const field of own) {
    if (errors[field.id])
      warn(`${label}: ${field.name} "${input[field.id]}" — ${errors[field.id]}`);
  }
  return { ...previous, ...values };
}

/**
 * Aplica la carga (HU-14), todo en una transacción: crea lo que falta en los catálogos, crea o
 * actualiza contenedores, fases y tareas. Solo Actualizar: nunca borra. Lo vacío en el archivo no
 * borra lo que ya hay. Devuelve el mismo resumen que la vista previa más los avisos de la carga.
 */
export async function applyImport(
  db: Db,
  actorId: string,
  workspaceId: string,
  data: ImportData,
  today: string,
): Promise<ImportPreview> {
  const preview = await previewImport(db, workspaceId, data);
  const warnings = [...preview.warnings];
  const warn = (message: string) => {
    if (warnings.length < 100) warnings.push(message);
  };

  await db.$transaction(
    async (tx) => {
      const workspace = await loadWorkspace(tx, workspaceId);
      const nextPosition = async (model: 'projectType' | 'taskType' | 'taskOrigin') => {
        const delegate = tx[model] as unknown as {
          aggregate: (args: object) => Promise<{ _max: { position: number | null } }>;
        };
        const last = await delegate.aggregate({ where: { workspaceId }, _max: { position: true } });
        return (last._max.position ?? -1) + 1;
      };

      // --- Catálogos ---
      const projectTypeFor = async (name: string | null, behavior: ProjectBehavior | null) => {
        const wanted = behavior ?? 'WITH_END';
        if (name) {
          const found = workspace.projectTypes.get(key(name));
          if (found) return found;
          const created = await tx.projectType.create({
            data: {
              workspaceId,
              name: name.trim(),
              behavior: wanted,
              usesPhases: defaultUsesPhases(wanted),
              position: await nextPosition('projectType'),
              ...auditCreate(actorId),
            },
            select: {
              id: true,
              name: true,
              behavior: true,
              archivedAt: true,
              allowedTaskTypes: { select: { taskTypeId: true } },
            },
          });
          workspace.projectTypes.set(key(name), created);
          return created;
        }
        // Sin tipo: el primero activo de la sección
        return [...workspace.projectTypes.values()].find(
          (type) => type.behavior === wanted && !type.archivedAt,
        );
      };
      const taskTypeFor = async (name: string) => {
        const found = workspace.taskTypes.get(key(name));
        if (found) return found.id;
        const created = await tx.taskType.create({
          data: {
            workspaceId,
            name: name.trim(),
            position: await nextPosition('taskType'),
            ...auditCreate(actorId),
          },
          select: { id: true, name: true, archivedAt: true },
        });
        workspace.taskTypes.set(key(name), created);
        return created.id;
      };
      const originFor = async (name: string | null) => {
        if (!name) return null;
        const found = workspace.origins.get(key(name));
        if (found) return found.id;
        const created = await tx.taskOrigin.create({
          data: {
            workspaceId,
            name: name.trim(),
            position: await nextPosition('taskOrigin'),
            ...auditCreate(actorId),
          },
          select: { id: true, name: true, archivedAt: true },
        });
        workspace.origins.set(key(name), created);
        return created.id;
      };
      const personFor = async (name: string | null) => {
        if (!name) return null;
        const found = workspace.people.get(key(name));
        if (found) return found.id;
        const created = await tx.person.create({
          data: { workspaceId, name: name.trim(), ...auditCreate(actorId) },
          select: { id: true, name: true, archivedAt: true },
        });
        workspace.people.set(key(name), created);
        return created.id;
      };

      for (const container of data.containers) {
        const existing = findProject(workspace, container);
        const type = existing
          ? undefined
          : await projectTypeFor(container.typeName, container.behavior);
        let projectId: string;
        let projectTypeId: string;

        if (existing) {
          projectId = existing.id;
          projectTypeId = existing.typeId;
          const status = container.status ?? existing.status;
          await tx.project.update({
            where: { id: existing.id },
            data: {
              name: container.name,
              ...(container.area !== null && { area: container.area }),
              ...(container.classification !== null && {
                classification: container.classification,
              }),
              ...(container.priority !== null && { priority: container.priority }),
              ...(container.startDate !== null && { startDate: fromIsoDate(container.startDate) }),
              ...(container.endDate !== null && { endDate: fromIsoDate(container.endDate) }),
              status,
              ...realDatesFor(status, existing),
              details: detailsFor(
                workspace.fields,
                { projectTypeId },
                container.details,
                parseDetails(existing.details),
                warn,
                container.name,
              ),
              ...auditUpdate(actorId),
            },
          });
        } else {
          if (!type) {
            warn(
              `${container.name}: no hay un tipo de contenedor activo para su sección; se omite`,
            );
            continue;
          }
          projectTypeId = type.id;
          const status = container.status ?? 'NOT_STARTED';
          let folio: string | null;
          try {
            folio = await resolveFolio(tx, workspaceId, container.folio, {
              behavior: type.behavior,
              today,
            });
          } catch {
            warn(
              `${container.name}: el folio "${container.folio}" ya lo usa otro; se le asigna uno nuevo`,
            );
            folio = await resolveFolio(tx, workspaceId, null, { behavior: type.behavior, today });
          }
          const created = await tx.project.create({
            data: {
              workspaceId,
              typeId: type.id,
              name: container.name,
              folio,
              area: container.area,
              classification: container.classification,
              status,
              priority: container.priority ?? 'MEDIUM',
              startDate: fromIsoDate(container.startDate),
              endDate: fromIsoDate(container.endDate),
              ...realDatesFor(status, null),
              details: detailsFor(
                workspace.fields,
                { projectTypeId },
                container.details,
                {},
                warn,
                container.name,
              ),
              ...auditCreate(actorId),
            },
            select: { id: true },
          });
          projectId = created.id;
          workspace.projects.push({
            id: created.id,
            name: container.name,
            folio,
            typeId: type.id,
            status,
            startedAt: null,
            finishedAt: null,
            details: {},
            tasks: [],
            phases: [],
          });
        }
        const project = workspace.projects.find((p) => p.id === projectId)!;

        // Tipos de tarea que admite este contenedor (HU-22, HU-37): se agregan los que falten
        const ownAllowed = (
          await tx.projectTaskType.findMany({ where: { projectId }, select: { taskTypeId: true } })
        ).map((row) => row.taskTypeId);
        const typeRow = [...workspace.projectTypes.values()].find((t) => t.id === projectTypeId);
        const typeAllowed = typeRow?.allowedTaskTypes.map((row) => row.taskTypeId) ?? [];
        const allow = async (taskTypeId: string) => {
          if (ownAllowed.length > 0 && !ownAllowed.includes(taskTypeId)) {
            await tx.projectTaskType.create({
              data: { projectId, taskTypeId, createdById: actorId },
            });
            ownAllowed.push(taskTypeId);
          }
          if (typeAllowed.length > 0 && !typeAllowed.includes(taskTypeId)) {
            await tx.projectTypeTaskType.create({
              data: { projectTypeId, taskTypeId, createdById: actorId },
            });
            typeAllowed.push(taskTypeId);
            typeRow?.allowedTaskTypes.push({ taskTypeId });
          }
        };
        const defaultTaskType = () => {
          const allowed = ownAllowed.length > 0 ? ownAllowed : typeAllowed;
          return [...workspace.taskTypes.values()].find(
            (t) => !t.archivedAt && (allowed.length === 0 || allowed.includes(t.id)),
          )?.id;
        };

        // Fases: se crean los niveles que falten de cada ruta
        const phaseFor = async (path: string[]): Promise<string | null> => {
          let parentId: string | null = null;
          for (const name of path.slice(0, MAX_PHASE_DEPTH)) {
            let phase = project.phases.find(
              (p) => p.parentId === parentId && key(p.name) === key(name),
            );
            if (!phase) {
              const siblings = project.phases.filter((p) => p.parentId === parentId).length;
              phase = await tx.phase.create({
                data: {
                  workspaceId,
                  projectId,
                  parentId,
                  name: name.trim(),
                  position: siblings,
                  ...auditCreate(actorId),
                },
                select: { id: true, parentId: true, name: true },
              });
              project.phases.push(phase);
            }
            parentId = phase.id;
          }
          return parentId;
        };

        for (const task of container.tasks) {
          const existingTask = findTask(project, task);
          const typeId = task.typeName
            ? await taskTypeFor(task.typeName)
            : (existingTask?.typeId ?? defaultTaskType());
          if (!typeId) {
            warn(`"${task.title}" (${container.name}): no hay un tipo de tarea activo; se omite`);
            continue;
          }
          await allow(typeId);
          const phaseId = task.phasePath.length > 0 ? await phaseFor(task.phasePath) : undefined;
          const responsiblePersonId = await personFor(task.responsibleName);
          const originId = await originFor(task.originName);
          const label = `"${task.title}" (${container.name})`;

          if (existingTask) {
            const status = task.status ?? existingTask.status;
            await tx.task.update({
              where: { id: existingTask.id },
              data: {
                typeId,
                status,
                completedAt: completedAtFor(status, existingTask),
                startedAt: startedAtFor(status, existingTask.startedAt),
                ...(status === 'PAUSED' || status === 'CANCELLED'
                  ? { statusReason: IMPORTED_REASON }
                  : { statusReason: null }),
                ...(phaseId !== undefined && { phaseId }),
                ...(task.estimatedMinutes !== null && { estimatedMinutes: task.estimatedMinutes }),
                ...(task.startDate !== null && { startDate: fromIsoDate(task.startDate) }),
                ...(task.endDate !== null && { endDate: fromIsoDate(task.endDate) }),
                ...(responsiblePersonId !== null && { responsiblePersonId }),
                ...(originId !== null && { originId }),
                ...(task.originDetail !== null && { originDetail: task.originDetail }),
                details: detailsFor(
                  workspace.fields,
                  { taskTypeId: typeId },
                  task.details,
                  parseDetails(existingTask.details),
                  warn,
                  label,
                ),
                ...auditUpdate(actorId),
              },
            });
          } else {
            const status = task.status ?? 'PENDING';
            const created = await tx.task.create({
              data: {
                workspaceId,
                projectId,
                title: task.title,
                typeId,
                status,
                completedAt: completedAtFor(status, null),
                startedAt: startedAtFor(status, null),
                statusReason:
                  status === 'PAUSED' || status === 'CANCELLED' ? IMPORTED_REASON : null,
                phaseId: phaseId ?? null,
                estimatedMinutes: task.estimatedMinutes,
                startDate: fromIsoDate(task.startDate),
                endDate: fromIsoDate(task.endDate),
                responsiblePersonId,
                originId,
                originDetail: task.originDetail,
                details: detailsFor(
                  workspace.fields,
                  { taskTypeId: typeId },
                  task.details,
                  {},
                  warn,
                  label,
                ),
                ...auditCreate(actorId),
              },
              select: { id: true },
            });
            // Si el archivo repite la tarea, la segunda la actualiza
            project.tasks.push({
              id: created.id,
              title: task.title,
              typeId,
              status,
              completedAt: null,
              startedAt: null,
              details: {},
            });
          }
        }
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return { ...preview, warnings };
}
