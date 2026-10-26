import {
  daysRemainingLabel,
  roleHasPermission,
  type Member,
  type Project,
  type ProjectProgress,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { TaskBoard } from '@/components/task-board';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinutes, todayIso } from '@/lib/dates';
import { projectQueryOptions, useDeleteProject, useUpdateProject } from '@/lib/projects';
import { tasksQueryOptions, useCreateTask } from '@/lib/tasks';
import { membersQueryOptions, workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/p/$projectId');

/** Un proyecto: sus tareas (HU-08) y sus datos, editables si mi rol lo permite (HU-05) */
export function ProjectPage() {
  const { workspaceId, projectId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: project } = useSuspenseQuery(projectQueryOptions(workspaceId, projectId));
  const { data: tasks } = useSuspenseQuery(tasksQueryOptions(workspaceId, projectId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));
  const canEditTasks = roleHasPermission(workspace.role, 'task.update');
  const canCreateTasks = roleHasPermission(workspace.role, 'task.create');
  const canDeleteTasks = roleHasPermission(workspace.role, 'task.delete');
  const canDeleteProject = roleHasPermission(workspace.role, 'project.delete');

  return (
    <div className="grid gap-4">
      <div>
        <Link
          to="/w/$workspaceId"
          params={{ workspaceId }}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {workspace.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {project.folio && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">
              {project.folio}
            </span>
          )}
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
          {canDeleteProject && (
            <DeleteProjectButton
              workspaceId={workspaceId}
              projectId={projectId}
              name={project.name}
            />
          )}
        </div>
      </div>

      <ProjectPeople project={project} />

      <ProgressSummary progress={project.progress} endDate={project.endDate} />

      <Card>
        <CardHeader>
          <CardTitle>Tareas</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskBoard
            workspaceId={workspaceId}
            projectId={projectId}
            tasks={tasks}
            members={members}
            canEdit={canEditTasks}
            canDelete={canDeleteTasks}
          />
        </CardContent>
      </Card>

      {canCreateTasks && (
        <CreateTaskCard workspaceId={workspaceId} projectId={projectId} members={members} />
      )}

      <ProjectDetailsCard workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}

/** Dar de baja (HU-15): el proyecto y sus tareas van a la papelera, de donde el Admin los recupera */
function DeleteProjectButton({
  workspaceId,
  projectId,
  name,
}: {
  workspaceId: string;
  projectId: string;
  name: string;
}) {
  const navigate = useNavigate();
  const remove = useDeleteProject(workspaceId, projectId);

  function handleConfirm() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(`"${name}" se envió a la papelera`);
        void navigate({ to: '/w/$workspaceId', params: { workspaceId } });
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" className="ml-auto" disabled={remove.isPending}>
          <Trash2 aria-hidden />
          Dar de baja
        </Button>
      }
      title={`¿Dar de baja "${name}"?`}
      description="El proyecto y sus tareas se van a la papelera: dejan de verse en listas y avances. El Admin puede restaurarlos desde la papelera."
      confirmLabel="Dar de baja"
      onConfirm={handleConfirm}
    />
  );
}

/** Descripción y personas del proyecto (HU-31); solo se muestra lo que tiene valor */
function ProjectPeople({ project }: { project: Project }) {
  const people = [
    { label: 'Solicitante', value: project.requester },
    { label: 'Asignado a', value: project.assignedTo },
    { label: 'Project manager', value: project.projectManager },
    { label: 'Gte. Consultoría', value: project.consultingManager },
    { label: 'Business partner', value: project.businessPartner },
  ].filter((person) => person.value);
  if (!project.description && people.length === 0) return null;

  return (
    <div className="grid gap-3">
      {project.description && (
        <p className="max-w-3xl whitespace-pre-line text-muted-foreground">{project.description}</p>
      )}
      {people.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {people.map((person) => (
            <div key={person.label}>
              <dt className="text-muted-foreground">{person.label}</dt>
              <dd className="font-medium">{person.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** % de avance, minutos pendientes y días restantes (HU-06) */
function ProgressSummary({
  progress,
  endDate,
}: {
  progress: ProjectProgress;
  endDate: string | null;
}) {
  const stats = [
    { label: 'Tareas hechas', value: `${progress.doneTasks} de ${progress.totalTasks}` },
    { label: 'Minutos pendientes', value: formatMinutes(progress.pendingMinutes) },
    { label: 'Fecha de fin', value: daysRemainingLabel(endDate, todayIso()) },
  ];

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-3">
          <ProgressBar percent={progress.percent} label="Avance del proyecto" className="h-3" />
          <span className="text-lg font-semibold tabular-nums">{progress.percent}%</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="font-medium">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function CreateTaskCard({
  workspaceId,
  projectId,
  members,
}: {
  workspaceId: string;
  projectId: string;
  members: Member[];
}) {
  const createTask = useCreateTask(workspaceId, projectId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva tarea</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskForm
          members={members}
          submitLabel="Crear tarea"
          isPending={createTask.isPending}
          error={createTask.error?.message}
          onSubmit={(data, form) => createTask.mutate(data, { onSuccess: () => form.reset() })}
        />
      </CardContent>
    </Card>
  );
}

/** Datos del proyecto, plegados por defecto: lo de todos los días son las tareas */
function ProjectDetailsCard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: project } = useSuspenseQuery(projectQueryOptions(workspaceId, projectId));
  const updateProject = useUpdateProject(workspaceId, projectId);
  const canEdit = roleHasPermission(workspace.role, 'project.update');

  return (
    <Card>
      <details>
        <summary className="cursor-pointer px-6 font-semibold">Datos del proyecto</summary>
        <CardContent className="pt-4">
          {/* key: si los datos cambian (al guardar), el formulario se vuelve a crear con ellos */}
          <ProjectForm
            key={JSON.stringify(project)}
            project={project}
            submitLabel="Guardar cambios"
            readOnly={!canEdit}
            isPending={updateProject.isPending}
            error={updateProject.error?.message}
            status={
              updateProject.isSuccess && (
                <p role="status" className="text-sm text-muted-foreground">
                  Cambios guardados
                </p>
              )
            }
            onSubmit={(data) => updateProject.mutate(data)}
          />
        </CardContent>
      </details>
    </Card>
  );
}
