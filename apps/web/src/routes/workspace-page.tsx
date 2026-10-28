import {
  canCreateContainer,
  daysRemainingLabel,
  filterProjects,
  hasActiveFilters,
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
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectFiltersBar } from '@/components/project-filters-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { SortTh } from '@/components/sort-th';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { nextSort } from '@/lib/sort';
import { formatDate, formatMinutes, todayIso } from '@/lib/dates';
import { projectTypesQueryOptions, SECTIONS } from '@/lib/project-types';
import { PROJECT_PRIORITIES, projectsQueryOptions, useCreateProject } from '@/lib/projects';
import { peopleQueryOptions } from '@/lib/people';
import { taskTypesQueryOptions } from '@/lib/task-types';
import { useAccess } from '@/lib/access';
import { roleLabel, workspaceQueryOptions } from '@/lib/workspaces';

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
  const access = useAccess(workspaceId);
  const canCreate = canCreateContainer(access, behavior) && types.length > 0;
  // Con varios tipos (Mtto correctivo y evolutivo) se muestra la columna Tipo
  const sectionTypes = allTypes.filter((t) => t.behavior === behavior);
  const showType = sectionTypes.length > 1;
  const visible = sortProjects(filterProjects(projects, filters), filters.sort, filters.dir);
  const hidden = projects.length - visible.length;

  function sortBy(key: ProjectSortKey) {
    onFilters({ ...filters, ...nextSort(filters, key) });
  }

  return (
    <div className="grid gap-3">
      {/* Título, descripción, conteo y botón en una sola línea (HU-41) */}
      <PageHeader
        title={section.title}
        description={`${workspace.name} · tu rol: ${roleLabel(workspace.role, access.permissions)}`}
      >
        <span className="text-sm text-muted-foreground">
          {projects.length === 0
            ? section.empty
            : `${visible.length} de ${projects.length}${hidden > 0 && !hasActiveFilters(filters) ? ' (terminados y cancelados ocultos)' : ''}`}
        </span>
        {canCreate && (
          <CreateProjectDialog
            workspaceId={workspaceId}
            label={section.newLabel}
            types={types}
            taskTypes={taskTypes}
            people={people}
          />
        )}
      </PageHeader>

      {projects.length > 0 && (
        <Card>
          <CardContent className="grid gap-3">
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
        </Card>
      )}
    </div>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`py-1.5 pr-4 ${className}`}>{children}</td>;
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
                <td className="py-1.5 whitespace-nowrap">
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
