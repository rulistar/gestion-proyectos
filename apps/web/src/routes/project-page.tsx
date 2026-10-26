import {
  daysRemainingLabel,
  roleHasPermission,
  type Member,
  type Project,
  type Task,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { TaskBoard } from '@/components/task-board';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatMinutes, todayIso } from '@/lib/dates';
import {
  PROJECT_PRIORITIES,
  projectQueryOptions,
  useDeleteProject,
  useUpdateProject,
} from '@/lib/projects';
import { tasksQueryOptions, useCreateTask } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import { membersQueryOptions, workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/p/$projectId');

const TABS = [
  { id: 'board', label: 'Tablero' },
  { id: 'details', label: 'Datos del proyecto' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Lo que llega en otras historias: se ve como "Pronto" para que se sepa que viene */
const SOON_TABS = [
  { label: 'Lista', story: 'HU-26' },
  { label: 'Gantt', story: 'HU-27' },
];

/** Un proyecto (HU-28c): indicadores, tablero de tareas y datos; crear y editar en ventanas */
export function ProjectPage() {
  const { workspaceId, projectId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: project } = useSuspenseQuery(projectQueryOptions(workspaceId, projectId));
  const { data: tasks } = useSuspenseQuery(tasksQueryOptions(workspaceId, projectId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));
  const [tab, setTab] = useState<TabId>('board');
  const [dialog, setDialog] = useState<'edit' | 'task'>();
  const can = (permission: Parameters<typeof roleHasPermission>[1]) =>
    roleHasPermission(workspace.role, permission);

  return (
    <div className="grid gap-5">
      <header className="grid gap-3">
        <nav aria-label="Ruta" className="text-sm text-muted-foreground">
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="hover:underline">
            Proyectos
          </Link>
          <span aria-hidden> / </span>
          <span>{project.name}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {project.folio && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">
              {project.folio}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            Prioridad {PROJECT_PRIORITIES[project.priority].toLowerCase()}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {can('project.delete') && (
              <DeleteProjectButton workspaceId={workspaceId} project={project} />
            )}
            <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>
              <Pencil aria-hidden />
              {can('project.update') ? 'Editar datos' : 'Ver datos'}
            </Button>
            {can('task.create') && (
              <Button size="sm" onClick={() => setDialog('task')}>
                <Plus aria-hidden />
                Nueva tarea
              </Button>
            )}
          </div>
        </div>
        {project.description && (
          <p className="max-w-4xl whitespace-pre-line text-muted-foreground">
            {project.description}
          </p>
        )}
      </header>

      <ProjectKpis project={project} tasks={tasks} />

      <div>
        <div role="tablist" aria-label="Vistas del proyecto" className="flex gap-1 border-b">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                tab === item.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
          {SOON_TABS.map((item) => (
            <span
              key={item.label}
              title={`Llega con ${item.story}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground/60"
            >
              {item.label}
              <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase">
                Pronto
              </span>
            </span>
          ))}
        </div>

        <div role="tabpanel" className="pt-4">
          {tab === 'board' ? (
            <TaskBoard
              workspaceId={workspaceId}
              projectId={projectId}
              tasks={tasks}
              members={members}
              canEdit={can('task.update')}
              canDelete={can('task.delete')}
            />
          ) : (
            <ProjectDetails project={project} />
          )}
        </div>
      </div>

      <EditProjectDialog
        workspaceId={workspaceId}
        project={project}
        readOnly={!can('project.update')}
        open={dialog === 'edit'}
        onClose={() => setDialog(undefined)}
      />
      <CreateTaskDialog
        workspaceId={workspaceId}
        projectId={projectId}
        members={members}
        open={dialog === 'task'}
        onClose={() => setDialog(undefined)}
      />
    </div>
  );
}

/** Avance, trabajo pendiente, fecha de fin y lo que requiere atención (HU-06, HU-28c) */
function ProjectKpis({ project, tasks }: { project: Project; tasks: Task[] }) {
  const today = todayIso();
  const { progress } = project;
  const open = tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'PAUSED'].includes(t.status));
  const paused = open.filter((t) => t.status === 'PAUSED').length;
  const overdue = open.filter((t) => t.endDate !== null && t.endDate < today).length;
  const orphan = open.filter((t) => !t.assigneeIsMember).length;
  const late = project.endDate !== null && project.endDate < today && project.status !== 'DONE';

  const attentionHint =
    [
      overdue > 0 && `${overdue} vencida${overdue === 1 ? '' : 's'}`,
      orphan > 0 && `${orphan} por reasignar`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Todo en orden';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="Avance" value={`${progress.percent}%`}>
        <ProgressBar percent={progress.percent} label="Avance del proyecto" />
        <span>
          {progress.doneTasks} de {progress.totalTasks} tareas
        </span>
      </Kpi>
      <Kpi label="Trabajo pendiente" value={formatMinutes(progress.pendingMinutes)}>
        {paused > 0
          ? `Incluye ${paused} tarea${paused === 1 ? '' : 's'} pausada${paused === 1 ? '' : 's'}`
          : `${open.length} tarea${open.length === 1 ? '' : 's'} abierta${open.length === 1 ? '' : 's'}`}
      </Kpi>
      <Kpi
        label="Fecha de fin"
        value={daysRemainingLabel(project.endDate, today)}
        tone={late ? 'text-destructive' : undefined}
      >
        {project.endDate ? formatDate(project.endDate) : 'Sin fecha planeada'}
      </Kpi>
      <Kpi
        label="Requiere atención"
        value={String(overdue + orphan)}
        tone={overdue + orphan > 0 ? 'text-destructive' : undefined}
      >
        {attentionHint}
      </Kpi>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="grid gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</p>
        <div className="grid gap-1.5 text-xs text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Pestaña "Datos del proyecto": todo lo capturado, solo lectura (se edita en la ventana) */
function ProjectDetails({ project }: { project: Project }) {
  const sections = [
    {
      title: 'Personas',
      rows: [
        ['Solicitante', project.requester],
        ['Asignado a', project.assignedTo],
        ['Project manager', project.projectManager],
        ['Gte. Consultoría', project.consultingManager],
        ['Business partner', project.businessPartner],
      ],
    },
    {
      title: 'Planeación',
      rows: [
        ['Folio', project.folio],
        ['Área', project.area],
        ['Clasificación', project.classification],
        ['Prioridad', PROJECT_PRIORITIES[project.priority]],
        ['Inicio planeado', project.startDate && formatDate(project.startDate)],
        ['Fin planeado', project.endDate && formatDate(project.endDate)],
      ],
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardContent className="grid gap-3">
            <h2 className="font-semibold">{section.title}</h2>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
      <Card className="lg:col-span-2">
        <CardContent className="grid gap-2">
          <h2 className="font-semibold">Observaciones</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {project.notes ?? 'Sin observaciones.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EditProjectDialog({
  workspaceId,
  project,
  readOnly,
  open,
  onClose,
}: {
  workspaceId: string;
  project: Project;
  readOnly: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateProject(workspaceId, project.id);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Datos del proyecto' : 'Editar proyecto'}</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>
        {/* key: al reabrir, el formulario parte de los datos actuales */}
        <ProjectForm
          key={JSON.stringify(project)}
          project={project}
          submitLabel="Guardar cambios"
          readOnly={readOnly}
          isPending={update.isPending}
          error={update.error?.message}
          onSubmit={(data) =>
            update.mutate(data, {
              onSuccess: () => {
                toast.success('Proyecto actualizado');
                onClose();
              },
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  workspaceId,
  projectId,
  members,
  open,
  onClose,
}: {
  workspaceId: string;
  projectId: string;
  members: Member[];
  open: boolean;
  onClose: () => void;
}) {
  const createTask = useCreateTask(workspaceId, projectId);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>Se agrega al tablero en la columna de su estado.</DialogDescription>
        </DialogHeader>
        <TaskForm
          members={members}
          submitLabel="Crear tarea"
          isPending={createTask.isPending}
          error={createTask.error?.message}
          onSubmit={(data, form) =>
            createTask.mutate(data, {
              onSuccess: (task) => {
                toast.success(`"${task.title}" creada`);
                form.reset();
                onClose();
              },
            })
          }
        >
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </TaskForm>
      </DialogContent>
    </Dialog>
  );
}

/** Dar de baja (HU-15): el proyecto y sus tareas van a la papelera, de donde el Admin los recupera */
function DeleteProjectButton({ workspaceId, project }: { workspaceId: string; project: Project }) {
  const navigate = useNavigate();
  const remove = useDeleteProject(workspaceId, project.id);

  function handleConfirm() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(`"${project.name}" se envió a la papelera`);
        void navigate({ to: '/w/$workspaceId', params: { workspaceId } });
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={remove.isPending}>
          <Trash2 aria-hidden />
          Dar de baja
        </Button>
      }
      title={`¿Dar de baja "${project.name}"?`}
      description="El proyecto y sus tareas se van a la papelera: dejan de verse en listas y avances. El Admin puede restaurarlos desde la papelera."
      confirmLabel="Dar de baja"
      onConfirm={handleConfirm}
    />
  );
}
