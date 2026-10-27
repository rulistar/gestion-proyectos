import type { MoveProjectInput, MoveTaskInput } from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';

/** El tipo de contenedor elegido no existe (activo) en el espacio de destino (→ 400) */
export class InvalidTargetTypeError extends Error {}
/** El proyecto de destino no existe en ese espacio o está en la papelera (→ 404) */
export class TargetProjectNotFoundError extends Error {}
/** El destino ya tiene un contenedor con ese folio (→ 409) */
export class TargetFolioTakenError extends Error {
  constructor(readonly folio: string) {
    super('Folio repetido en el destino');
  }
}
/** El destino no admite algunos tipos de tarea que se moverían (→ 409) */
export class TargetDisallowsTaskTypesError extends Error {
  constructor(readonly taskTypes: string[]) {
    super('Tipos de tarea no admitidos en el destino');
  }
}

/**
 * Traduce personas y tipos de tarea del espacio de origen al de destino (HU-32): los catálogos
 * son por espacio, así que cada referencia se busca (o se crea) en el destino. Guarda lo ya
 * traducido para no buscar dos veces lo mismo.
 */
class CatalogMapper {
  private people = new Map<string, string>();
  private taskTypes = new Map<string, { id: string; name: string }>();

  constructor(
    private readonly tx: Tx,
    private readonly actorId: string,
    private readonly targetWorkspaceId: string,
  ) {}

  /**
   * Persona del destino equivalente: la vinculada a la misma cuenta o, si no tiene cuenta, la
   * activa con el mismo nombre (sin mayúsculas). Si no existe, se crea (ADR-0005 §1).
   */
  async person(personId: string | null): Promise<string | null> {
    if (personId === null) return null;
    const cached = this.people.get(personId);
    if (cached) return cached;

    const source = await this.tx.person.findUniqueOrThrow({
      where: { id: personId },
      select: { name: true, userId: true, user: { select: { email: true } } },
    });
    const ws = this.targetWorkspaceId;
    const existing = source.userId
      ? await this.tx.person.findFirst({ where: { workspaceId: ws, userId: source.userId } })
      : await this.tx.person.findFirst({
          where: {
            workspaceId: ws,
            archivedAt: null,
            name: { equals: source.name, mode: 'insensitive' },
          },
        });
    let id = existing?.id;
    if (!id) {
      // Una persona de otra cuenta con el mismo nombre: se distingue con el correo
      const clash = await this.tx.person.findFirst({
        where: {
          workspaceId: ws,
          archivedAt: null,
          name: { equals: source.name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      const name = clash && source.user ? `${source.name} (${source.user.email})` : source.name;
      const created = await this.tx.person.create({
        data: { workspaceId: ws, name, userId: source.userId, ...auditCreate(this.actorId) },
        select: { id: true },
      });
      id = created.id;
    }
    this.people.set(personId, id);
    return id;
  }

  /** Tipo de tarea del destino con el mismo nombre (sin mayúsculas); si no existe, se crea */
  async taskType(taskTypeId: string): Promise<{ id: string; name: string }> {
    const cached = this.taskTypes.get(taskTypeId);
    if (cached) return cached;

    const source = await this.tx.taskType.findUniqueOrThrow({
      where: { id: taskTypeId },
      select: { name: true, expedited: true },
    });
    const ws = this.targetWorkspaceId;
    let target = await this.tx.taskType.findFirst({
      where: {
        workspaceId: ws,
        archivedAt: null,
        name: { equals: source.name, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
    if (!target) {
      const last = await this.tx.taskType.aggregate({
        where: { workspaceId: ws },
        _max: { position: true },
      });
      target = await this.tx.taskType.create({
        data: {
          workspaceId: ws,
          ...source,
          position: (last._max.position ?? -1) + 1,
          ...auditCreate(this.actorId),
        },
        select: { id: true, name: true },
      });
    }
    this.taskTypes.set(taskTypeId, target);
    return target;
  }
}

/** Tipos de tarea que admite un contenedor: los suyos (HU-37) o los de su tipo (HU-22); vacío = todos */
async function allowedIn(tx: Tx, projectId: string) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      allowedTaskTypes: { select: { taskTypeId: true } },
      type: { select: { allowedTaskTypes: { select: { taskTypeId: true } } } },
    },
  });
  const own = project.allowedTaskTypes.map((row) => row.taskTypeId);
  return own.length > 0 ? own : project.type.allowedTaskTypes.map((row) => row.taskTypeId);
}

const PERSON_FIELDS = [
  'requesterId',
  'assignedToId',
  'projectManagerId',
  'consultingManagerId',
  'businessPartnerId',
] as const;

/**
 * Mueve un contenedor con todas sus tareas (también las de la papelera) a otro espacio (HU-32).
 * Conserva IDs, fechas, folio e historial; traduce tipo, personas y tipos de tarea al destino.
 * false si el contenedor no existe en el origen (→ 404). Todo o nada: corre en una transacción.
 */
export async function moveProject(
  db: Db,
  actorId: string,
  sourceWorkspaceId: string,
  projectId: string,
  { targetWorkspaceId, typeId }: MoveProjectInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, workspaceId: sourceWorkspaceId, ...notDeleted },
      select: {
        folio: true,
        requesterId: true,
        assignedToId: true,
        projectManagerId: true,
        consultingManagerId: true,
        businessPartnerId: true,
        tasks: { select: { id: true, typeId: true, responsiblePersonId: true, deletedAt: true } },
      },
    });
    if (!project) return false;

    const targetType = await tx.projectType.findFirst({
      where: { id: typeId, workspaceId: targetWorkspaceId, archivedAt: null },
      select: { allowedTaskTypes: { select: { taskTypeId: true } } },
    });
    if (!targetType) throw new InvalidTargetTypeError();
    if (project.folio) {
      const taken = await tx.project.findFirst({
        where: {
          workspaceId: targetWorkspaceId,
          folio: { equals: project.folio, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (taken) throw new TargetFolioTakenError(project.folio);
    }

    const mapper = new CatalogMapper(tx, actorId, targetWorkspaceId);
    // En secuencia: la misma persona en dos campos se crea una sola vez en el destino
    const people: Partial<Record<(typeof PERSON_FIELDS)[number], string | null>> = {};
    for (const field of PERSON_FIELDS) people[field] = await mapper.person(project[field]);
    const tasks = [];
    for (const task of project.tasks) {
      tasks.push({
        ...task,
        type: await mapper.taskType(task.typeId),
        responsiblePersonId: await mapper.person(task.responsiblePersonId),
      });
    }

    // El tipo destino debe admitir las tareas activas (las de la papelera se mueven igual)
    const allowed = targetType.allowedTaskTypes.map((row) => row.taskTypeId);
    const rejected = tasks.filter(
      (task) => task.deletedAt === null && allowed.length > 0 && !allowed.includes(task.type.id),
    );
    if (rejected.length > 0) {
      throw new TargetDisallowsTaskTypesError([...new Set(rejected.map((t) => t.type.name))]);
    }

    for (const task of tasks) {
      await tx.task.update({
        where: { id: task.id },
        data: {
          workspaceId: targetWorkspaceId,
          typeId: task.type.id,
          responsiblePersonId: task.responsiblePersonId,
          ...auditUpdate(actorId),
        },
      });
    }
    // Sus tipos de tarea propios eran del catálogo de origen: en el destino admite los de su tipo
    await tx.projectTaskType.deleteMany({ where: { projectId } });
    await tx.project.update({
      where: { id: projectId },
      data: { workspaceId: targetWorkspaceId, typeId, ...people, ...auditUpdate(actorId) },
    });
    return true;
  });
}

/**
 * Mueve una tarea a otro proyecto, del mismo espacio o de otro (HU-32). En otro espacio se
 * traducen su tipo y su responsable. false si la tarea no existe en el origen (→ 404).
 */
export async function moveTask(
  db: Db,
  actorId: string,
  where: { workspaceId: string; projectId: string; taskId: string },
  { targetWorkspaceId, targetProjectId }: MoveTaskInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: {
        id: where.taskId,
        workspaceId: where.workspaceId,
        projectId: where.projectId,
        ...notDeleted,
        project: notDeleted,
      },
      select: { typeId: true, responsiblePersonId: true },
    });
    if (!task) return false;
    const target = await tx.project.findFirst({
      where: { id: targetProjectId, workspaceId: targetWorkspaceId, ...notDeleted },
      select: { id: true },
    });
    if (!target) throw new TargetProjectNotFoundError();

    const sameWorkspace = targetWorkspaceId === where.workspaceId;
    const mapper = new CatalogMapper(tx, actorId, targetWorkspaceId);
    const type = sameWorkspace
      ? await tx.taskType.findUniqueOrThrow({
          where: { id: task.typeId },
          select: { id: true, name: true },
        })
      : await mapper.taskType(task.typeId);
    const allowed = await allowedIn(tx, targetProjectId);
    if (allowed.length > 0 && !allowed.includes(type.id)) {
      throw new TargetDisallowsTaskTypesError([type.name]);
    }

    await tx.task.update({
      where: { id: where.taskId },
      data: {
        workspaceId: targetWorkspaceId,
        projectId: targetProjectId,
        typeId: type.id,
        responsiblePersonId: sameWorkspace
          ? task.responsiblePersonId
          : await mapper.person(task.responsiblePersonId),
        ...auditUpdate(actorId),
      },
    });
    return true;
  });
}
