import {
  daysRemainingLabel,
  roleHasPermission,
  type Project,
  type ProjectBehavior,
  type ProjectType,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ProgressBar } from '@/components/progress-bar';
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
import { ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

// Son los id de las rutas (no la URL): cuelgan de la ruta sin URL "app", de ahí el /app
const projectsRoute = getRouteApi('/app/w/$workspaceId');
const maintenanceRoute = getRouteApi('/app/w/$workspaceId/mantenimientos');
const activitiesRoute = getRouteApi('/app/w/$workspaceId/actividades');

export function WorkspacePage() {
  const { workspaceId } = projectsRoute.useParams();
  return <ContainersPage workspaceId={workspaceId} behavior="WITH_END" />;
}

export function MaintenancePage() {
  const { workspaceId } = maintenanceRoute.useParams();
  return <ContainersPage workspaceId={workspaceId} behavior="ONGOING" />;
}

export function ActivitiesPage() {
  const { workspaceId } = activitiesRoute.useParams();
  return <ContainersPage workspaceId={workspaceId} behavior="ON_DEMAND" />;
}

/**
 * Proyectos, mantenimientos o actividades del espacio (HU-05, HU-21): los contenedores cuyos tipos
 * tienen ese comportamiento, con las columnas que se miden en él (ADR-0004 §2)
 */
function ContainersPage({
  workspaceId,
  behavior,
}: {
  workspaceId: string;
  behavior: ProjectBehavior;
}) {
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: allProjects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const { data: allTypes } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const section = SECTIONS[behavior];
  const projects = allProjects.filter((p) => p.type.behavior === behavior);
  const types = allTypes.filter((t) => t.behavior === behavior && !t.archived);
  const canCreate = roleHasPermission(workspace.role, 'project.create') && types.length > 0;
  // Con varios tipos (Mtto correctivo y evolutivo) se muestra la columna Tipo
  const showType = allTypes.filter((t) => t.behavior === behavior).length > 1;

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
          <CreateProjectDialog workspaceId={workspaceId} label={section.newLabel} types={types} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{section.title}</CardTitle>
          <CardDescription>
            {projects.length === 0 ? section.empty : `${projects.length} en total`}
          </CardDescription>
        </CardHeader>
        {projects.length > 0 && (
          <CardContent className="overflow-x-auto">
            <ContainersTable
              workspaceId={workspaceId}
              projects={projects}
              behavior={behavior}
              showType={showType}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="py-2 pr-4 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`py-2 pr-4 ${className}`}>{children}</td>;
}

function ContainersTable({
  workspaceId,
  projects,
  behavior,
  showType,
}: {
  workspaceId: string;
  projects: Project[];
  behavior: ProjectBehavior;
  showType: boolean;
}) {
  const today = todayIso();

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b">
          <Th>Folio</Th>
          <Th>Nombre</Th>
          {showType && <Th>Tipo</Th>}
          <Th>Solicitante</Th>
          <Th>Estado</Th>
          <Th>Prioridad</Th>
          {behavior === 'WITH_END' ? (
            <>
              <Th>Avance</Th>
              <Th>Pendiente</Th>
              <Th>Fin</Th>
            </>
          ) : (
            <>
              <Th>Abiertas</Th>
              <Th>Vencidas</Th>
              {behavior === 'ONGOING' && <Th>Hechas este mes</Th>}
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
            <Td>{project.requester ?? '—'}</Td>
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
}: {
  workspaceId: string;
  label: string;
  types: ProjectType[];
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
