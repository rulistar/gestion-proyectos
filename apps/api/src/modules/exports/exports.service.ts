import {
  CSV_BASE_COLUMNS,
  detailCell,
  detailColumns,
  orderedPhases,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  SECTION_LABELS,
  summarizePhase,
  TASK_STATUS_LABELS,
  toCsv,
  type Phase,
  type Project,
  type Task,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';
import { listDetailFields } from '../detail-fields/detail-fields.service.js';
import { listPeople } from '../people/people.service.js';
import { listProjectTypes } from '../project-types/project-types.service.js';
import { listProjects } from '../projects/projects.service.js';
import { listTaskOrigins } from '../task-origins/task-origins.service.js';
import { listTasks } from '../tasks/tasks.service.js';
import { listTaskTypes } from '../task-types/task-types.service.js';
import type { WorkspaceAccess } from '../workspaces/access.js';
import { projectVisibleWhere, taskVisibleWhere } from '../workspaces/visibility.js';

type ProjectWithContent = Project & { phases: Phase[]; tasks: Task[] };

/**
 * Lo que ve quien exporta (ADR-0006): sus contenedores visibles con sus fases y tareas visibles.
 * Nada de la papelera (RNF-05): los servicios de lista ya la excluyen.
 */
async function visibleContent(db: Db, access: WorkspaceAccess): Promise<ProjectWithContent[]> {
  const { workspaceId } = access;
  const projects = await listProjects(db, workspaceId, undefined, projectVisibleWhere(access));
  const visibleTasks = taskVisibleWhere(access);
  const phases = await db.phase.findMany({
    where: { workspaceId, projectId: { in: projects.map((p) => p.id) }, ...notDeleted },
    select: { id: true, projectId: true, parentId: true, name: true, position: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      phases: phases.filter((phase) => phase.projectId === project.id),
      tasks: await listTasks(db, workspaceId, project.id, visibleTasks),
    })),
  );
}

/**
 * Respaldo completo en JSON (HU-13): catálogos, personas y los contenedores visibles con sus fases y
 * tareas. `version` permite que Importar (HU-14) reconozca el formato.
 */
export async function exportJson(db: Db, access: WorkspaceAccess, workspaceName: string) {
  const { workspaceId } = access;
  const [projectTypes, taskTypes, taskOrigins, detailFields, people, projects] = await Promise.all([
    listProjectTypes(db, workspaceId),
    listTaskTypes(db, workspaceId),
    listTaskOrigins(db, workspaceId),
    listDetailFields(db, workspaceId),
    listPeople(db, workspaceId),
    visibleContent(db, access),
  ]);
  return {
    format: 'gestor-de-proyectos',
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: { id: workspaceId, name: workspaceName },
    catalogs: { projectTypes, taskTypes, taskOrigins, detailFields },
    people,
    projects,
  };
}

/**
 * CSV para Excel (HU-13): una fila por tarea, con las columnas del prototipo, las nuevas y una por
 * campo de detalle. Un contenedor sin tareas lleva una fila con las columnas de tarea vacías.
 */
export async function exportCsv(db: Db, access: WorkspaceAccess): Promise<string> {
  const [projects, fields] = await Promise.all([
    visibleContent(db, access),
    listDetailFields(db, access.workspaceId),
  ]);
  const columns = detailColumns(fields);
  const header = [...CSV_BASE_COLUMNS, ...columns.container, ...columns.task];

  const rows: string[][] = [header];
  for (const project of projects) {
    // Fase con su ruta ("Módulo 101 / Tema 1") y sus fechas calculadas (HU-07)
    const names = new Map(project.phases.map((phase) => [phase.id, phase.name]));
    const pathOf = new Map<string, string>();
    for (const { phase } of orderedPhases(project.phases)) {
      const parent = phase.parentId ? pathOf.get(phase.parentId) : undefined;
      pathOf.set(phase.id, parent ? `${parent} / ${phase.name}` : (names.get(phase.id) ?? ''));
    }
    const containerCells = (header: string) => {
      const field = fields.find(
        (f) => f.projectTypeId === project.type.id && columns.header(f) === header,
      );
      return field ? detailCell(field, project.details[field.id]) : '';
    };
    const projectPart = [
      project.name,
      project.area ?? '',
      project.classification ?? '',
      PROJECT_STATUS_LABELS[project.status],
      PROJECT_PRIORITY_LABELS[project.priority],
      project.startDate ?? '',
      project.endDate ?? '',
    ];
    const extraProject = [
      SECTION_LABELS[project.type.behavior],
      project.type.name,
      project.folio ?? '',
    ];

    const taskRows = project.tasks.length > 0 ? project.tasks : [null];
    for (const task of taskRows) {
      const phase = task?.phaseId ? project.phases.find((p) => p.id === task.phaseId) : undefined;
      const summary = phase ? summarizePhase(project.phases, project.tasks, phase.id) : undefined;
      const taskCells = (name: string) => {
        const field = fields.find((f) => f.taskTypeId === task?.type.id && f.name === name);
        return field && task ? detailCell(field, task.details[field.id]) : '';
      };
      rows.push([
        ...projectPart,
        phase ? (pathOf.get(phase.id) ?? phase.name) : '',
        summary?.startDate ?? '',
        summary?.endDate ?? '',
        task?.title ?? '',
        task?.type.name ?? '',
        task?.estimatedMinutes?.toString() ?? '',
        task?.startDate ?? '',
        task?.endDate ?? '',
        task ? (task.status === 'DONE' ? 'Sí' : 'No') : '',
        ...extraProject,
        task ? TASK_STATUS_LABELS[task.status] : '',
        task?.responsible?.name ?? '',
        task?.origin?.name ?? '',
        task?.originDetail ?? '',
        ...columns.container.map(containerCells),
        ...columns.task.map(taskCells),
      ]);
    }
  }
  return toCsv(rows);
}

/** Nombre del archivo: "Monex-2026-10-31.csv" (sin caracteres raros, para cualquier sistema) */
export function exportFileName(workspaceName: string, today: string, extension: string): string {
  const slug =
    workspaceName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'espacio';
  return `${slug}-${today}.${extension}`;
}
