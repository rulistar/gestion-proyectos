import {
  groupTasksByPhase,
  type Phase,
  type TaskSortKey,
  type WorkspaceTask,
} from '@gestion/shared';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { SortTh } from '@/components/sort-th';
import { formatDate } from '@/lib/dates';
import { dueInfo } from '@/lib/due';
import { taskTypeClass } from '@/lib/task-types';
import { TASK_STATUSES } from '@/lib/tasks';
import { cn } from '@/lib/utils';

/** Clave de "Sin fase" al plegar */
const LOOSE = 'none';

/**
 * Tabla de tareas con orden por columna: la vista Tareas del espacio (HU-39) y la pestaña Lista
 * de un proyecto (HU-26). Con `phases`, agrupa por fase con sangría y cada fase se pliega.
 */
export function TaskTable({
  tasks,
  workspaceId,
  today,
  sort,
  dir,
  onSort,
  onEdit,
  showProject = true,
  phases,
}: {
  /** Ya filtradas y ordenadas */
  tasks: WorkspaceTask[];
  workspaceId: string;
  today: string;
  sort: TaskSortKey | undefined;
  dir: 'asc' | 'desc';
  onSort: (column: TaskSortKey) => void;
  /** Sin permiso de edición devuelve undefined: el título no es un botón */
  onEdit: (task: WorkspaceTask) => (() => void) | undefined;
  /** Columna Contenedor: sobra dentro de un proyecto */
  showProject?: boolean;
  /** Fases del proyecto (HU-07): agrupa por fase */
  phases?: Phase[] | undefined;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const columns = showProject ? 6 : 5;

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const th = (column: TaskSortKey, label: string) => (
    <SortTh column={column} sort={sort} dir={dir} onSort={onSort}>
      {label}
    </SortTh>
  );

  const taskRow = (task: WorkspaceTask, depth = 0) => (
    <TaskRow
      key={task.id}
      task={task}
      workspaceId={workspaceId}
      today={today}
      depth={depth}
      showProject={showProject}
      onEdit={onEdit(task)}
    />
  );

  let body: ReactNode[];
  if (!phases) {
    body = tasks.map((task) => taskRow(task));
  } else {
    // Renglones en orden de esquema: al plegar una fase se ocultan los que están más adentro
    body = [];
    let hiddenBelow: number | null = null;
    for (const row of groupTasksByPhase(tasks, phases)) {
      const depth = row.kind === 'loose' ? 1 : row.depth;
      if (hiddenBelow !== null && depth > hiddenBelow) continue;
      hiddenBelow = null;
      if (row.kind === 'task') {
        body.push(taskRow(row.task, row.depth));
        continue;
      }
      const key = row.kind === 'phase' ? row.phase.id : LOOSE;
      const open = !collapsed.has(key);
      if (!open) hiddenBelow = depth;
      body.push(
        <tr key={`phase-${key}`} className="border-b bg-muted/40 last:border-0">
          <td colSpan={columns} className="py-1.5 pr-4">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
              style={{ paddingLeft: `${(depth - 1) * 1.25}rem` }}
            >
              {open ? (
                <ChevronDown aria-hidden className="size-4" />
              ) : (
                <ChevronRight aria-hidden className="size-4" />
              )}
              {row.kind === 'phase' ? row.phase.name : 'Sin fase'}
              <span className="font-normal text-muted-foreground">({row.count})</span>
            </button>
          </td>
        </tr>,
      );
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            {th('title', 'Tarea')}
            {showProject && th('project', 'Contenedor')}
            {th('type', 'Tipo')}
            {th('responsible', 'Responsable')}
            {th('status', 'Estado')}
            {th('endDate', 'Fin')}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`py-1.5 pr-4 ${className}`}>{children}</td>;
}

function TaskRow({
  task,
  workspaceId,
  today,
  depth,
  showProject,
  onEdit,
}: {
  task: WorkspaceTask;
  workspaceId: string;
  today: string;
  /** Nivel dentro del esquema de fases; 0 = sin agrupar */
  depth: number;
  showProject: boolean;
  onEdit: (() => void) | undefined;
}) {
  const finished = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = dueInfo(task.endDate, today);
  return (
    <tr className="border-b last:border-0">
      <td
        className={cn(
          'min-w-56 py-1.5 pr-4',
          finished ? 'text-muted-foreground line-through' : 'font-medium',
        )}
        // La sangría alinea la tarea bajo el nombre de su fase (después de la flecha)
        style={depth > 0 ? { paddingLeft: `${(depth - 1) * 1.25}rem` } : undefined}
      >
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-left hover:underline"
            title="Editar tarea"
          >
            {task.title}
          </button>
        ) : (
          task.title
        )}
      </td>
      {showProject && (
        <Td className="min-w-48">
          <Link
            to="/w/$workspaceId/p/$projectId"
            params={{ workspaceId, projectId: task.project.id }}
            className="hover:underline"
          >
            {task.project.folio && (
              <span className="text-muted-foreground">{task.project.folio} · </span>
            )}
            {task.project.name}
          </Link>
        </Td>
      )}
      <Td className="whitespace-nowrap">
        <span
          className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', taskTypeClass(task.type))}
        >
          {task.type.expedited && '⚡ '}
          {task.type.name}
        </span>
      </Td>
      <Td className={task.responsible ? '' : 'text-muted-foreground'}>
        {task.responsible?.name ?? 'Sin asignar'}
      </Td>
      <Td className="whitespace-nowrap">{TASK_STATUSES[task.status]}</Td>
      <td className="py-1.5 whitespace-nowrap">
        {finished ? (
          <span className="text-muted-foreground">{formatDate(task.endDate)}</span>
        ) : (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', due.className)}>
            {due.text}
          </span>
        )}
      </td>
    </tr>
  );
}
