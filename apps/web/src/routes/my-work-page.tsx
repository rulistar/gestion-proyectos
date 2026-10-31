import {
  ALL_PEOPLE,
  daysRemainingLabel,
  groupMyWork,
  type MyTask,
  type Project,
} from '@gestion/shared';
import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Check, PanelRightClose, PanelRightOpen, Wrench } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { useAccess } from '@/lib/access';
import { useCurrentUser } from '@/lib/auth';
import { todayIso, weekStartIso } from '@/lib/dates';
import { dueInfo } from '@/lib/due';
import { myTasksQueryOptions } from '@/lib/my-work';
import { peopleQueryOptions } from '@/lib/people';
import { projectsQueryOptions } from '@/lib/projects';
import { TASK_STATUSES, useMoveTask } from '@/lib/tasks';
import { useSavedToggle } from '@/lib/use-menu-open';
import { cn } from '@/lib/utils';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/mi-trabajo');

/** Mi trabajo (HU-28b): lo que tengo pendiente en este espacio, por fecha de fin */
export function MyWorkPage() {
  const { workspaceId } = route.useParams();
  const me = useCurrentUser();
  const today = todayIso();
  const weekStart = weekStartIso();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  // De quién se ve el trabajo (HU-52): por omisión, de todos los que puedo ver
  const [person, setPerson] = useState(ALL_PEOPLE);
  // Al cambiar de persona se conserva la lista anterior mientras llega la nueva
  const { data: tasks = [] } = useQuery({
    ...myTasksQueryOptions(workspaceId, weekStart, person),
    placeholderData: keepPreviousData,
  });
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  // Las mías (soy el Responsable): basta con poder modificar "las mías" (ADR-0006). Las de otra
  // persona que sigo solo se ven (HU-52); el Admin puede con todas
  const access = useAccess(workspaceId);
  const isAdmin = access.role === 'ADMIN';
  const canUpdate = (task: MyTask) =>
    isAdmin ||
    (task.responsible?.id === access.personId && access.permissions.tasks.update !== 'NONE');
  const work = groupMyWork(tasks, today, weekStart);
  // El saludo usa el nombre de mi persona en este espacio (alias, HU-34), si lo tiene
  const { data: people = [] } = useQuery(peopleQueryOptions(workspaceId));
  const myName = people.find((person) => person.userId === me.id)?.name ?? me.name;
  const firstName = myName.split(' ')[0];
  // A quiénes puedo ver además de mí (HU-52): el Admin, a todos; los demás, a quienes sigue
  const others = people.filter(
    (p) => p.userId !== me.id && (isAdmin ? !p.archived : access.watchedPersonIds.includes(p.id)),
  );
  const canPick = isAdmin || access.watchedPersonIds.length > 0;
  const onlyMine = !canPick || person === access.personId;
  const whose =
    person === ALL_PEOPLE
      ? isAdmin
        ? 'todas las personas'
        : 'ti y las personas que sigues'
      : (others.find((p) => p.id === person)?.name ?? 'ti');
  // Panel de proyectos activos y mantenimientos (HU-48): se oculta para dar espacio a las tareas
  const panel = useSavedToggle('mi-trabajo-panel-visible');

  const kpis = [
    { label: 'Vencen hoy', value: work.kpis.dueToday, color: '#E8C468' },
    { label: 'Vencidas', value: work.kpis.overdue, color: '#D98884' },
    { label: 'En curso', value: work.kpis.inProgress, color: '#8FB8D9' },
    { label: 'Hechas esta semana', value: work.kpis.doneThisWeek, color: '#8FC9A0' },
  ];
  const groups = [
    { label: 'Vencidas', tone: 'text-destructive', tasks: work.overdue },
    { label: 'Hoy', tone: 'text-warning-foreground', tasks: work.today },
    { label: 'Próximos 7 días', tone: 'text-foreground', tasks: work.thisWeek },
    { label: 'Más adelante o sin fecha', tone: 'text-muted-foreground', tasks: work.later },
  ].filter((group) => group.tasks.length > 0);

  return (
    <div className="grid gap-3">
      <PageHeader
        title={`Hola, ${firstName}`}
        description={
          onlyMine
            ? `Esto es lo que tienes pendiente en ${workspace.name}.`
            : `Lo pendiente de ${whose} en ${workspace.name}.`
        }
      >
        {canPick && (
          <NativeSelect
            aria-label="Ver el trabajo de"
            value={person}
            onChange={(event) => setPerson(event.target.value)}
            className="h-8 w-56"
          >
            <option value={ALL_PEOPLE}>
              {isAdmin ? 'Todas las personas' : 'Yo y a quienes sigo'}
            </option>
            {access.personId && <option value={access.personId}>Yo</option>}
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={panel.toggle}
          aria-expanded={panel.open}
          title="Proyectos activos y mantenimientos"
        >
          {panel.open ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
          {panel.open ? 'Ocultar panel' : 'Mostrar panel'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="gap-1 border-l-4 py-3"
            style={{ borderLeftColor: kpi.color }}
          >
            <CardContent>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={cn('grid items-start gap-4', panel.open && 'lg:grid-cols-[1fr_20rem]')}>
        <Card>
          <CardHeader>
            <CardTitle>{onlyMine ? 'Mis tareas' : 'Tareas'}</CardTitle>
            <CardDescription>
              {onlyMine
                ? 'Las que tienes asignadas en todos los proyectos, por fecha de fin'
                : `Las de ${whose}, por fecha de fin`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes tareas pendientes. Cuando te asignen una, aparecerá aquí.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="grid gap-2">
                  <h2 className={`text-sm font-semibold ${group.tone}`}>
                    {group.label} · {group.tasks.length}
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {group.tasks.map((task) => (
                      <MyTaskRow
                        key={task.id}
                        workspaceId={workspaceId}
                        task={task}
                        today={today}
                        canUpdate={canUpdate(task)}
                        compact={!panel.open}
                        showResponsible={!onlyMine}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </CardContent>
        </Card>

        {panel.open && (
          <div className="grid gap-4">
            <ActiveProjectsCard workspaceId={workspaceId} projects={projects} today={today} />
            <MaintenanceCard workspaceId={workspaceId} projects={projects} />
          </div>
        )}
      </div>
    </div>
  );
}

function MyTaskRow({
  workspaceId,
  task,
  today,
  canUpdate,
  compact,
  showResponsible,
}: {
  workspaceId: string;
  task: MyTask;
  today: string;
  canUpdate: boolean;
  /** Con el panel oculto (HU-48): título y descripción en un solo renglón */
  compact: boolean;
  /** Viendo el trabajo de otros (HU-52): de quién es cada tarea */
  showResponsible: boolean;
}) {
  const move = useMoveTask(workspaceId, task.projectId, task.id);
  const due = dueInfo(task.endDate, today);

  function markDone() {
    move.mutate(
      { status: 'DONE', statusReason: null },
      {
        onSuccess: () => toast.success(`"${task.title}" quedó Hecha`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <li className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/40">
      {canUpdate && (
        <button
          type="button"
          onClick={markDone}
          disabled={move.isPending}
          aria-label={`Marcar "${task.title}" como Hecha`}
          title="Marcar como Hecha"
          className="group flex size-5 shrink-0 items-center justify-center rounded border-2 border-muted-foreground/50 hover:border-primary disabled:opacity-50"
        >
          <Check aria-hidden className="size-3 text-primary opacity-0 group-hover:opacity-100" />
        </button>
      )}
      <div className={cn('min-w-0 flex-1', compact && 'flex items-baseline gap-3')}>
        <p className={cn('truncate font-medium', compact && 'shrink-0 max-w-[60%]')}>
          {task.title}
        </p>
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {task.type.expedited ? `⚡ ${task.type.name}` : task.type.name} ·{' '}
          <Link
            to="/w/$workspaceId/p/$projectId"
            params={{ workspaceId, projectId: task.projectId }}
            className="hover:underline"
          >
            {task.projectName}
          </Link>
          {task.status !== 'PENDING' && ` · ${TASK_STATUSES[task.status]}`}
          {showResponsible && ` · ${task.responsible?.name ?? 'Sin responsable'}`}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${due.className}`}>
        {due.text}
      </span>
    </li>
  );
}

/** Proyectos que no están terminados ni cancelados, con su avance (HU-06) */
function ActiveProjectsCard({
  workspaceId,
  projects,
  today,
}: {
  workspaceId: string;
  projects: Project[];
  today: string;
}) {
  const active = projects.filter(
    (p) => p.type.behavior === 'WITH_END' && p.status !== 'DONE' && p.status !== 'CANCELLED',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyectos activos</CardTitle>
        <CardDescription>
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="font-medium">
            Ver todos
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay proyectos activos.</p>
        )}
        {active.map((project) => (
          <div key={project.id} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                to="/w/$workspaceId/p/$projectId"
                params={{ workspaceId, projectId: project.id }}
                className="truncate text-sm font-medium"
              >
                {project.name}
              </Link>
              <span className="text-sm font-semibold tabular-nums">
                {project.progress.percent}%
              </span>
            </div>
            <ProgressBar percent={project.progress.percent} label={`Avance de ${project.name}`} />
            <p className="text-xs text-muted-foreground">
              {daysRemainingLabel(project.endDate, today)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Mantenimientos (comportamiento Continuo, HU-21) con sus tareas abiertas y vencidas */
function MaintenanceCard({ workspaceId, projects }: { workspaceId: string; projects: Project[] }) {
  const maintenance = projects.filter(
    (p) => p.type.behavior === 'ONGOING' && p.status !== 'DONE' && p.status !== 'CANCELLED',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mantenimientos</CardTitle>
        <CardDescription>
          <Link
            to="/w/$workspaceId/mantenimientos"
            params={{ workspaceId }}
            className="font-medium"
          >
            Ver todos
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {maintenance.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay mantenimientos activos.</p>
        )}
        {maintenance.map((project) => (
          <div key={project.id} className="flex items-center gap-3">
            <Wrench aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <Link
                to="/w/$workspaceId/p/$projectId"
                params={{ workspaceId, projectId: project.id }}
                className="block truncate text-sm font-medium"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">{project.type.name}</p>
            </div>
            <div className="text-right text-xs">
              <p className="tabular-nums">{project.progress.openTasks} abiertas</p>
              {project.progress.overdueTasks > 0 && (
                <p className="font-semibold text-destructive tabular-nums">
                  {project.progress.overdueTasks} vencidas
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
