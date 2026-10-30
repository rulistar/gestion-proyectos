import { canUpdateTask, filterTasks, hasActiveFilters, sortTasks } from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { EditTaskPanel } from '@/components/task-board';
import { TaskFiltersBar } from '@/components/task-filters-bar';
import { TaskTable } from '@/components/task-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { containerFacts, taskFacts, useAccess } from '@/lib/access';
import { nextSort } from '@/lib/sort';
import { todayIso } from '@/lib/dates';
import { peopleQueryOptions } from '@/lib/people';
import { projectTypesQueryOptions } from '@/lib/project-types';
import { projectsQueryOptions } from '@/lib/projects';
import { taskOriginsQueryOptions } from '@/lib/task-origins';
import { allowedTaskTypes, taskTypesQueryOptions } from '@/lib/task-types';
import { workspaceTasksQueryOptions } from '@/lib/tasks';
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
  const { data: origins = [] } = useQuery(taskOriginsQueryOptions(workspaceId));
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
              origins={origins}
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
              <TaskTable
                tasks={visible}
                workspaceId={workspaceId}
                today={today}
                sort={filters.sort}
                dir={filters.dir ?? 'asc'}
                onSort={(key) => onFilters({ ...filters, ...nextSort(filters, key) })}
                onEdit={(task) =>
                  canUpdateTask(access, taskFacts(task, containerFacts(task.project)))
                    ? () => setEditingId(task.id)
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
