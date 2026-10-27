import {
  daysRemainingLabel,
  filterProjects,
  hasActiveFilters,
  roleHasPermission,
  sortProjects,
  type Project,
  type ProjectFilters,
  type ProjectSortKey,
  type ProjectBehavior,
  type Person,
  type ProjectType,
  type TaskType,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectFiltersBar } from '@/components/project-filters-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDate, formatMinutes, todayIso } from '@/lib/dates';
import { projectTypesQueryOptions, SECTIONS } from '@/lib/project-types';
import { PROJECT_PRIORITIES, projectsQueryOptions, useCreateProject } from '@/lib/projects';
import { peopleQueryOptions } from '@/lib/people';
import { taskTypesQueryOptions } from '@/lib/task-types';
import { ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

// Son los id de las rutas (no la URL): cuelgan de la ruta sin URL "app", de ahí el /app
const projectsRoute = getRouteApi('/app/w/$workspaceId');
const maintenanceRoute = getRouteApi('/app/w/$workspaceId/mantenimientos');
const activitiesRoute = getRouteApi('/app/w/$workspaceId/actividades');

// Los filtros y el orden viven en la URL (HU-09, ADR-0003); `replace` evita llenar el historial
export function WorkspacePage() {
  const { workspaceId } = projectsRoute.useParams();
  const filters = projectsRoute.useSearch();
  const navigate = projectsRoute.useNavigate();
  return (
    <ContainersPage
      workspaceId={workspaceId}
      behavior="WITH_END"
      filters={filters}
      onFilters={(search) => void navigate({ search, replace: true })}
    />
  );
}

export function MaintenancePage() {
  const { workspaceId } = maintenanceRoute.useParams();
  const filters = maintenanceRoute.useSearch();
  const navigate = maintenanceRoute.useNavigate();
  return (
    <ContainersPage
      workspaceId={workspaceId}
      behavior="ONGOING"
      filters={filters}
      onFilters={(search) => void navigate({ search, replace: true })}
    />
  );
}

export function ActivitiesPage() {
  const { workspaceId } = activitiesRoute.useParams();
  const filters = activitiesRoute.useSearch();
  const navigate = activitiesRoute.useNavigate();
  return (
    <ContainersPage
      workspaceId={workspaceId}
      behavior="ON_DEMAND"
      filters={filters}
      onFilters={(search) => void navigate({ search, replace: true })}
    />
  );
}

/**
 * Proyectos, mantenimientos o actividades del espacio (HU-05, HU-21): los contenedores cuyos tipos
 * tienen ese comportamiento, con las columnas que se miden en él (ADR-0004 §2)
 */
function ContainersPage({
  workspaceId,
  behavior,
  filters,
  onFilters,
}: {
  workspaceId: string;
  behavior: ProjectBehavior;
  filters: ProjectFilters;
  onFilters: (next: ProjectFilters) => void;
}) {
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: allProjects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const { data: allTypes } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const { data: taskTypes } = useSuspenseQuery(taskTypesQueryOptions(workspaceId));
  const { data: people } = useSuspenseQuery(peopleQueryOptions(workspaceId));
  const section = SECTIONS[behavior];
  const projects = allProjects.filter((p) => p.type.behavior === behavior);
  const types = allTypes.filter((t) => t.behavior === behavior && !t.archived);
  const canCreate = roleHasPermission(workspace.role, 'project.create') && types.length > 0;
  // Con varios tipos (Mtto correctivo y evolutivo) se muestra la columna Tipo
  const sectionTypes = allTypes.filter((t) => t.behavior === behavior);
  const showType = sectionTypes.length > 1;
  const visible = sortProjects(filterProjects(projects, filters), filters.sort, filters.dir);
  const hidden = projects.length - visible.length;

  /** Clic en un encabezado: la misma columna invierte el orden; otra columna empieza ascendente */
  function sortBy(key: ProjectSortKey) {
    const dir = filters.sort === key && filters.dir !== 'desc' ? 'desc' : 'asc';
    onFilters({ ...filters, sort: key, dir });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{section.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {workspace.name} · tu rol: {ROLE_LABELS[workspace.role]}
          </p>
        </div>
        {canCreate && (
          <CreateProjectDialog
            workspaceId={workspaceId}
            label={section.newLabel}
            types={types}
            taskTypes={taskTypes}
            people={people}
          />
        )}
      </div>

      <Card>
        {/* El conteo a la derecha del título ahorra una línea */}
        <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle>{section.title}</CardTitle>
          <CardDescription>
            {projects.length === 0
              ? section.empty
              : `${visible.length} de ${projects.length}${hidden > 0 && !hasActiveFilters(filters) ? ' (terminados y cancelados ocultos)' : ''}`}
          </CardDescription>
        </CardHeader>
        {projects.length > 0 && (
          <CardContent className="grid gap-4">
            <ProjectFiltersBar
              projects={projects}
              types={sectionTypes}
              filters={filters}
              onChange={onFilters}
            />
            {visible.length === 0 ? (
              <div className="grid justify-items-center gap-2 py-8 text-center">
                <p className="font-medium">Ningún proyecto coincide con los filtros</p>
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
                <ContainersTable
                  workspaceId={workspaceId}
                  projects={visible}
                  behavior={behavior}
                  showType={showType}
                  sort={filters.sort}
                  dir={filters.dir ?? 'asc'}
                  onSort={sortBy}
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Encabezado que ordena por su columna (HU-09); muestra la flecha del orden actual */
function SortTh({
  column,
  sort,
  dir,
  onSort,
  children,
}: {
  column: ProjectSortKey;
  sort: ProjectSortKey | undefined;
  dir: 'asc' | 'desc';
  onSort: (column: ProjectSortKey) => void;
  children: ReactNode;
}) {
  const active = sort === column;
  return (
    <th
      className="py-2 pr-4 font-medium"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
      >
        {children}
        {active &&
          (dir === 'asc' ? (
            <ArrowUp aria-hidden className="size-3" />
          ) : (
            <ArrowDown aria-hidden className="size-3" />
          ))}
      </button>
    </th>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`py-2 pr-4 ${className}`}>{children}</td>;
}

function ContainersTable({
  workspaceId,
  projects,
  behavior,
  showType,
  sort,
  dir,
  onSort,
}: {
  workspaceId: string;
  projects: Project[];
  behavior: ProjectBehavior;
  showType: boolean;
  sort: ProjectSortKey | undefined;
  dir: 'asc' | 'desc';
  onSort: (column: ProjectSortKey) => void;
}) {
  const today = todayIso();
  /** Encabezado ordenable de una columna */
  const th = (column: ProjectSortKey, label: string) => (
    <SortTh column={column} sort={sort} dir={dir} onSort={onSort}>
      {label}
    </SortTh>
  );

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b">
          {th('folio', 'Folio')}
          {th('name', 'Nombre')}
          {showType && th('type', 'Tipo')}
          {behavior !== 'ON_DEMAND' && th('sprint', 'Sprint')}
          {/* Decisión del PO: Solicitante solo en Actividades; en el proyecto se sigue viendo */}
          {behavior === 'ON_DEMAND' && th('requester', 'Solicitante')}
          {th('status', 'Estado')}
          {th('priority', 'Prioridad')}
          {behavior === 'WITH_END' ? (
            <>
              {th('percent', 'Avance')}
              {th('pending', 'Pendiente')}
              {th('endDate', 'Fin')}
            </>
          ) : (
            <>
              {th('open', 'Abiertas')}
              {th('overdue', 'Vencidas')}
              {behavior === 'ONGOING' && th('doneThisMonth', 'Hechas este mes')}
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className="border-b last:border-0">
            <Td className="whitespace-nowrap text-muted-foreground">{project.folio ?? '—'}</Td>
            <Td className="font-medium">
              <Link
                to="/w/$workspaceId/p/$projectId"
                params={{ workspaceId, projectId: project.id }}
                className="hover:underline"
              >
                {project.name}
              </Link>
            </Td>
            {showType && <Td className="whitespace-nowrap">{project.type.name}</Td>}
            {behavior !== 'ON_DEMAND' && (
              <Td className="whitespace-nowrap">{project.sprint ?? '—'}</Td>
            )}
            {behavior === 'ON_DEMAND' && <Td>{project.requester?.name ?? '—'}</Td>}
            <Td>
              <ProjectStatusBadge status={project.status} />
            </Td>
            <Td>{PROJECT_PRIORITIES[project.priority]}</Td>
            {behavior === 'WITH_END' ? (
              <>
                <Td>
                  <div className="flex min-w-28 items-center gap-2">
                    <ProgressBar
                      percent={project.progress.percent}
                      label={`Avance de ${project.name}`}
                    />
                    <span className="w-9 text-right tabular-nums">{project.progress.percent}%</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatMinutes(project.progress.pendingMinutes)}
                </Td>
                <td className="py-2 whitespace-nowrap">
                  {formatDate(project.endDate)}
                  <span className="block text-xs text-muted-foreground">
                    {daysRemainingLabel(project.endDate, today)}
                  </span>
                </td>
              </>
            ) : (
              <>
                <Td className="tabular-nums">{project.progress.openTasks}</Td>
                <Td
                  className={
                    project.progress.overdueTasks > 0
                      ? 'font-semibold text-destructive tabular-nums'
                      : 'tabular-nums'
                  }
                >
                  {project.progress.overdueTasks}
                </Td>
                {behavior === 'ONGOING' && (
                  <Td className="tabular-nums">{project.progress.doneThisMonth}</Td>
                )}
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Al crear, se abre el contenedor nuevo: lo siguiente casi siempre es agregarle tareas */
function CreateProjectDialog({
  workspaceId,
  label,
  types,
  taskTypes,
  people,
}: {
  workspaceId: string;
  label: string;
  types: ProjectType[];
  taskTypes: TaskType[];
  people: Person[];
}) {
  const createProject = useCreateProject(workspaceId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Solo el nombre es obligatorio; lo demás puede esperar.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          types={types}
          taskTypes={taskTypes}
          workspaceId={workspaceId}
          people={people}
          submitLabel="Crear"
          isPending={createProject.isPending}
          error={createProject.error?.message}
          onSubmit={(data) =>
            createProject.mutate(data, {
              onSuccess: (project) => {
                toast.success(`"${project.name}" creado`);
                setOpen(false);
                void navigate({
                  to: '/w/$workspaceId/p/$projectId',
                  params: { workspaceId, projectId: project.id },
                });
              },
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
