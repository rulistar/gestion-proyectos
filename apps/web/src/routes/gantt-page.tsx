import {
  canUpdateTask,
  ganttRange,
  type GanttZoom,
  type ProjectBehavior,
  type WorkspaceGanttSearch,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { GanttChart, GanttToolbar, type GanttRow } from '@/components/gantt-chart';
import { PageHeader } from '@/components/page-header';
import { EditTaskPanel } from '@/components/task-board';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { containerFacts, taskFacts, useAccess } from '@/lib/access';
import { todayIso } from '@/lib/dates';
import { barDates, byPlannedStart, containerBars, taskBars } from '@/lib/gantt';
import { peopleQueryOptions } from '@/lib/people';
import { projectTypesQueryOptions, SECTIONS } from '@/lib/project-types';
import { projectsQueryOptions } from '@/lib/projects';
import { allowedTaskTypes, taskTypesQueryOptions } from '@/lib/task-types';
import { workspaceTasksQueryOptions } from '@/lib/tasks';
import { useCollapsed } from '@/lib/use-collapsed';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/gantt');

/**
 * Gantt del espacio (HU-27b): los contenedores de la sección elegida como barras (planeado contra
 * real) y sus tareas al desplegarlos. Ejemplo: en Proyectos, "Certificación Linux" muestra su barra
 * del 1 de noviembre al 15 de diciembre; al desplegarlo aparecen sus tareas, como en su pestaña.
 * Hechos y cancelados se ocultan salvo que se pida verlos.
 */
export function GanttPage() {
  const { workspaceId } = route.useParams();
  const search = route.useSearch();
  const navigate = useNavigate();
  const behavior: ProjectBehavior = search.behavior ?? 'WITH_END';
  const zoom = search.zoom ?? 'week';
  const today = todayIso();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const { data: tasks } = useSuspenseQuery(workspaceTasksQueryOptions(workspaceId));
  const { data: projectTypes } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const { data: taskTypes } = useSuspenseQuery(taskTypesQueryOptions(workspaceId));
  const { data: people } = useSuspenseQuery(peopleQueryOptions(workspaceId));
  const access = useAccess(workspaceId);
  const collapsed = useCollapsed(false);
  const [editingId, setEditingId] = useState<string>();

  function setSearch(next: Partial<WorkspaceGanttSearch>) {
    void navigate({
      to: '/w/$workspaceId/gantt',
      params: { workspaceId },
      search: (current: WorkspaceGanttSearch) => ({ ...current, ...next }),
      replace: true,
    });
  }

  const containers = projects
    .filter((project) => project.type.behavior === behavior)
    .filter(
      (project) =>
        search.showClosed || (project.status !== 'DONE' && project.status !== 'CANCELLED'),
    )
    .sort(byPlannedStart);
  const shownTasks = tasks.filter((task) => task.status !== 'CANCELLED').sort(byPlannedStart);
  const editing = tasks.find((task) => task.id === editingId);
  const editingProject = projects.find((project) => project.id === editing?.project.id);

  const rows: GanttRow[] = [];
  const dates: (string | null)[] = [];
  for (const project of containers) {
    const own = shownTasks.filter((task) => task.project.id === project.id);
    const bars = containerBars(project, today);
    dates.push(...barDates(bars));
    const open = collapsed.isOpen(project.id);
    rows.push({
      key: project.id,
      label: project.folio ? `${project.folio} · ${project.name}` : project.name,
      depth: 0,
      group: { open, onToggle: () => collapsed.toggle(project.id), count: own.length },
      bars,
      onOpen: () =>
        void navigate({
          to: '/w/$workspaceId/p/$projectId',
          params: { workspaceId, projectId: project.id },
          search: { tab: 'gantt', ...(zoom === 'week' ? {} : { zoom }) },
        }),
    });
    for (const task of own) {
      const taskBarsNow = taskBars(task, today);
      dates.push(...barDates(taskBarsNow));
      if (!open) continue;
      rows.push({
        key: task.id,
        label: task.title,
        depth: 1,
        bars: taskBarsNow,
        status: task.status,
        onOpen: canUpdateTask(access, taskFacts(task, containerFacts(task.project)))
          ? () => setEditingId(task.id)
          : undefined,
      });
    }
  }
  const range = ganttRange(dates, today, zoom);

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Gantt"
        description={`${workspace.name} · planeado contra real; despliega un contenedor para ver sus tareas`}
      >
        <span className="text-sm text-muted-foreground">
          {containers.length === 0 ? 'Nada que mostrar' : `${containers.length} contenedores`}
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

      <Card>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              aria-label="Sección"
              className="h-9 w-44"
              value={behavior}
              onChange={(event) =>
                setSearch({
                  behavior:
                    event.target.value === 'WITH_END'
                      ? undefined
                      : (event.target.value as ProjectBehavior),
                })
              }
            >
              {(Object.keys(SECTIONS) as ProjectBehavior[]).map((key) => (
                <option key={key} value={key}>
                  {SECTIONS[key].title}
                </option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={search.showClosed ?? false}
                onChange={(event) => setSearch({ showClosed: event.target.checked || undefined })}
              />
              Mostrar hechos y cancelados
            </label>
            <GanttToolbar
              zoom={zoom}
              onZoom={(next: GanttZoom) => setSearch({ zoom: next === 'week' ? undefined : next })}
            />
          </div>
          {containers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay {SECTIONS[behavior].title.toLowerCase()} abiertos en este espacio.
            </p>
          ) : (
            <GanttChart
              rows={rows}
              range={range}
              zoom={zoom}
              today={today}
              labelTitle="Contenedor y tareas"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
