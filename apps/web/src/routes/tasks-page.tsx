import {
  canUpdateTask,
  filterTasks,
  hasActiveFilters,
  sortTasks,
  type TaskSortKey,
  type WorkspaceTask,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { SortTh } from '@/components/sort-th';
import { EditTaskPanel } from '@/components/task-board';
import { TaskFiltersBar } from '@/components/task-filters-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { containerFacts, taskFacts, useAccess } from '@/lib/access';
import { nextSort } from '@/lib/sort';
import { formatDate, todayIso } from '@/lib/dates';
import { dueInfo } from '@/lib/due';
import { peopleQueryOptions } from '@/lib/people';
import { projectTypesQueryOptions } from '@/lib/project-types';
import { projectsQueryOptions } from '@/lib/projects';
import { allowedTaskTypes, taskTypeClass, taskTypesQueryOptions } from '@/lib/task-types';
import { TASK_STATUSES, workspaceTasksQueryOptions } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/tareas');

/**
 * Vista "Tareas" (HU-39): las de todo el espacio (proyectos, mantenimientos y actividades) con
 * filtros y orden en la URL, como la lista de proyectos (HU-09). Clic en una tarea para editarla.
 */
export function TasksPage() {
  const { workspaceId } = route.useParams();
  const filters = route.useSearch();
  const navigate = route.useNavigate();
  const today = todayIso();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: tasks } = useSuspenseQuery(workspaceTasksQueryOptions(workspaceId));
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const { data: projectTypes } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const { data: taskTypes } = useSuspenseQuery(taskTypesQueryOptions(workspaceId));
  const { data: people } = useSuspenseQuery(peopleQueryOptions(workspaceId));
  const access = useAccess(workspaceId);
  const [editingId, setEditingId] = useState<string>();

  const visible = sortTasks(filterTasks(tasks, filters, today), filters.sort, filters.dir);
  const hidden = tasks.length - visible.length;
  const editing = tasks.find((task) => task.id === editingId);
  const editingProject = projects.find((project) => project.id === editing?.project.id);

  // `replace` evita llenar el historial con cada letra del buscador
  function onFilters(search: typeof filters) {
    void navigate({ search, replace: true });
  }

  const th = (column: TaskSortKey, label: string) => (
    <SortTh
      column={column}
      sort={filters.sort}
      dir={filters.dir ?? 'asc'}
      onSort={(key) => onFilters({ ...filters, ...nextSort(filters, key) })}
    >
      {label}
    </SortTh>
  );

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Tareas"
        description={`${workspace.name} · todas las tareas de proyectos, mantenimientos y actividades`}
      >
        <span className="text-sm text-muted-foreground">
          {tasks.length === 0
            ? 'Todavía no hay tareas'
            : `${visible.length} de ${tasks.length}${hidden > 0 && !hasActiveFilters(filters) ? ' (hechas y canceladas ocultas)' : ''}`}
        </span>
      </PageHeader>

      {editing && editingProject && (
        <EditTaskPanel
          key={editing.id}
          task={editing}
          workspaceId={workspaceId}
          projectId={editing.project.id}
          people={people}
          types={allowedTaskTypes(
            taskTypes,
            projectTypes.find((type) => type.id === editingProject.type.id),
            editingProject.allowedTaskTypeIds,
            editing.type.id,
          )}
          onClose={() => setEditingId(undefined)}
        />
      )}

      {tasks.length > 0 && (
        <Card>
          <CardContent className="grid gap-3">
            <TaskFiltersBar
              projects={projects}
              taskTypes={taskTypes}
              people={people}
              filters={filters}
              onChange={onFilters}
            />
            {visible.length === 0 ? (
              <div className="grid justify-items-center gap-2 py-8 text-center">
                <p className="font-medium">Ninguna tarea coincide con los filtros</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFilters({ sort: filters.sort, dir: filters.dir })}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      {th('title', 'Tarea')}
                      {th('project', 'Contenedor')}
                      {th('type', 'Tipo')}
                      {th('responsible', 'Responsable')}
                      {th('status', 'Estado')}
                      {th('endDate', 'Fin')}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        workspaceId={workspaceId}
                        today={today}
                        onEdit={
                          canUpdateTask(access, taskFacts(task, containerFacts(task.project)))
                            ? () => setEditingId(task.id)
                            : undefined
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
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
  onEdit,
}: {
  task: WorkspaceTask;
  workspaceId: string;
  today: string;
  /** Sin permiso de edición, el título no es un botón */
  onEdit: (() => void) | undefined;
}) {
  const finished = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = dueInfo(task.endDate, today);
  return (
    <tr className="border-b last:border-0">
      <Td
        className={cn('min-w-56', finished ? 'text-muted-foreground line-through' : 'font-medium')}
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
      </Td>
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
