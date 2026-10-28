import {
  daysRemainingLabel,
  groupMyWork,
  roleHasPermission,
  type MyTask,
  type Project,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Check, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { ProgressBar } from '@/components/progress-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/lib/auth';
import { todayIso, weekStartIso } from '@/lib/dates';
import { dueInfo } from '@/lib/due';
import { myTasksQueryOptions } from '@/lib/my-work';
import { peopleQueryOptions } from '@/lib/people';
import { projectsQueryOptions } from '@/lib/projects';
import { TASK_STATUSES, useMoveTask } from '@/lib/tasks';
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
  const { data: tasks } = useSuspenseQuery(myTasksQueryOptions(workspaceId, weekStart));
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const canUpdate = roleHasPermission(workspace.role, 'task.update');
  const work = groupMyWork(tasks, today, weekStart);
  // El saludo usa el nombre de mi persona en este espacio (alias, HU-34), si lo tiene
  const { data: people = [] } = useQuery(peopleQueryOptions(workspaceId));
  const myName = people.find((person) => person.userId === me.id)?.name ?? me.name;
  const firstName = myName.split(' ')[0];

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
        description={`Esto es lo que tienes pendiente en ${workspace.name}.`}
      />

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

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Mis tareas</CardTitle>
            <CardDescription>
              Las que tienes asignadas en todos los proyectos, por fecha de fin
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
                        canUpdate={canUpdate}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ActiveProjectsCard workspaceId={workspaceId} projects={projects} today={today} />
          <MaintenanceCard workspaceId={workspaceId} projects={projects} />
        </div>
      </div>
    </div>
  );
}

function MyTaskRow({
  workspaceId,
  task,
  today,
  canUpdate,
}: {
  workspaceId: string;
  task: MyTask;
  today: string;
  canUpdate: boolean;
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
    <li className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
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
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.type.expedited ? `⚡ ${task.type.name}` : task.type.name} ·{' '}
          <Link
            to="/w/$workspaceId/p/$projectId"
            params={{ workspaceId, projectId: task.projectId }}
            className="hover:underline"
          >
            {task.projectName}
          </Link>
          {task.status !== 'PENDING' && ` · ${TASK_STATUSES[task.status]}`}
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
