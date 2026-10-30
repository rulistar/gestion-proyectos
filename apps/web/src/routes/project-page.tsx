import {
  canCreateTaskIn,
  canRemoveContainer,
  canRemoveTask,
  canUpdateContainer,
  canUpdateTask,
  daysRemainingLabel,
  filterTasks,
  hasActiveFilters,
  isMyTask,
  NOT_APPLICABLE,
  orderedPhases,
  phaseDescendantIds,
  roleHasPermission,
  sortTasks,
  type Person,
  type Phase,
  type Project,
  type ProjectSearch,
  type ProjectTab,
  type ProjectType,
  type Task,
  type TaskType,
  type TaskTypeRef,
  type WorkspaceTask,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { MoveProjectDialog } from '@/components/move-dialogs';
import { LOOSE_TASKS, PhaseOutline } from '@/components/phase-outline';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { EditTaskPanel, TaskBoard } from '@/components/task-board';
import { TaskFiltersBar } from '@/components/task-filters-bar';
import { TaskTable } from '@/components/task-table';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { containerFacts, taskFacts, useAccess } from '@/lib/access';
import { formatDate, formatMinutes, todayIso } from '@/lib/dates';
import {
  PROJECT_PRIORITIES,
  PROJECT_SCOPES,
  projectQueryOptions,
  useDeleteProject,
  useUpdateProject,
  useWorkFields,
} from '@/lib/projects';
import { projectTypesQueryOptions, SECTIONS, selectableTypes } from '@/lib/project-types';
import { allowedTaskTypes, taskTypesQueryOptions } from '@/lib/task-types';
import { tasksQueryOptions, useCreateTask } from '@/lib/tasks';
import { nextSort } from '@/lib/sort';
import { taskOriginsQueryOptions } from '@/lib/task-origins';
import { cn } from '@/lib/utils';
import { peopleQueryOptions } from '@/lib/people';
import { phasesQueryOptions } from '@/lib/phases';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/p/$projectId');

const TABS: { id: ProjectTab; label: string }[] = [
  { id: 'board', label: 'Tablero' },
  { id: 'list', label: 'Lista' },
  { id: 'phases', label: 'Fases' },
  { id: 'details', label: 'Datos del proyecto' },
];

/** Tareas de la fase elegida y de sus subfases; LOOSE_TASKS = las que no tienen fase */
function tasksOfPhase(tasks: Task[], phases: Phase[], filter: string): Task[] {
  if (filter === '') return tasks;
  const known = new Set(phases.map((phase) => phase.id));
  if (filter === LOOSE_TASKS) {
    return tasks.filter((task) => task.phaseId === null || !known.has(task.phaseId));
  }
  const ids = phaseDescendantIds(phases, filter);
  return tasks.filter((task) => task.phaseId !== null && ids.has(task.phaseId));
}

/** Lo que llega en otras historias: se ve como "Pronto" para que se sepa que viene */
const SOON_TABS = [{ label: 'Gantt', story: 'HU-27' }];

/** Un proyecto (HU-28c): indicadores, tablero de tareas y datos; crear y editar en ventanas */
export function ProjectPage() {
  const { workspaceId, projectId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: project } = useSuspenseQuery(projectQueryOptions(workspaceId, projectId));
  const { data: tasks } = useSuspenseQuery(tasksQueryOptions(workspaceId, projectId));
  const { data: people } = useSuspenseQuery(peopleQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const { data: taskTypes } = useSuspenseQuery(taskTypesQueryOptions(workspaceId));
  const projectType = types.find((type) => type.id === project.type.id);
  const taskTypeOptions = (currentId?: string) =>
    allowedTaskTypes(taskTypes, projectType, project.allowedTaskTypeIds, currentId);
  const section = SECTIONS[project.type.behavior];
  // Pestaña y filtros de la Lista en la URL (HU-26): el enlace los conserva
  const { tab: tabInUrl, ...listFilters } = route.useSearch();
  const navigate = route.useNavigate();
  const tab = tabInUrl ?? 'board';
  function setTab(next: ProjectTab) {
    void navigate({
      search: (current: ProjectSearch) => ({
        ...current,
        tab: next === 'board' ? undefined : next,
      }),
      replace: true,
    });
  }
  // Fases (HU-07): solo si el tipo del contenedor las usa
  const usesPhases = projectType?.usesPhases ?? false;
  const { data: phases = [] } = useQuery({
    ...phasesQueryOptions(workspaceId, projectId),
    enabled: usesPhases,
  });
  // Filtro del tablero por fase: "" = todas; incluye sus subfases
  const [phaseFilter, setPhaseFilter] = useState('');
  const activePhaseFilter =
    phaseFilter === LOOSE_TASKS || phases.some((phase) => phase.id === phaseFilter)
      ? phaseFilter
      : '';
  const boardTasks = usesPhases ? tasksOfPhase(tasks, phases, activePhaseFilter) : tasks;
  const [dialog, setDialog] = useState<'edit' | 'task'>();
  // Qué puedo hacer aquí, según mi matriz (ADR-0006); la API lo vuelve a decidir
  const access = useAccess(workspaceId);
  const facts = containerFacts(project);
  const canUpdate = canUpdateContainer(access, facts);
  // Si lo veo solo por tener una tarea en él, también puedo agregarle tareas
  const hasMyTask = tasks.some((task) => isMyTask(access, taskFacts(task, facts)));
  // Personal (HU-49): los campos del trabajo se pueden ocultar
  const personal = project.scope === 'PERSONAL';
  const workFields = useWorkFields();
  const showSprint = !personal || workFields.open;

  return (
    <div className="grid gap-3">
      <header className="grid gap-2">
        <nav aria-label="Ruta" className="text-sm text-muted-foreground">
          <Link to={section.to} params={{ workspaceId }} className="hover:underline">
            {section.title}
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
          <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
            {project.type.name}
          </span>
          {personal && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {PROJECT_SCOPES.PERSONAL}
            </span>
          )}
          <ProjectStatusBadge status={project.status} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            Prioridad {PROJECT_PRIORITIES[project.priority].toLowerCase()}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {personal && (
              <Button variant="ghost" size="sm" onClick={workFields.toggle}>
                {workFields.open ? 'Ocultar campos de trabajo' : 'Mostrar campos de trabajo'}
              </Button>
            )}
            {roleHasPermission(workspace.role, 'project.move') && (
              <MoveProjectDialog workspaceId={workspaceId} project={project} />
            )}
            {canRemoveContainer(access, facts) && (
              <DeleteProjectButton workspaceId={workspaceId} project={project} />
            )}
            <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>
              <Pencil aria-hidden />
              {canUpdate ? 'Editar datos' : 'Ver datos'}
            </Button>
            {canCreateTaskIn(access, facts, hasMyTask) && (
              <Button size="sm" onClick={() => setDialog('task')}>
                <Plus aria-hidden />
                Nueva tarea
              </Button>
            )}
          </div>
        </div>
        {/* Descripción y sprint lado a lado en pantallas anchas (HU-41) */}
        {(project.description ||
          (personal ? workFields.open : project.sprint || project.sprintActivities)) && (
          <div className="grid items-start gap-2 lg:grid-cols-2">
            {project.description && (
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {project.description}
              </p>
            )}
            {personal && workFields.open && <PersonalWorkFields project={project} />}
            {!personal && (project.sprint || project.sprintActivities) && (
              <div className="rounded-lg border bg-card p-3 text-sm">
                <p className="font-semibold">{project.sprint ?? 'Sprint'}</p>
                {project.sprintActivities && (
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {project.sprintActivities}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <ProjectKpis project={project} tasks={tasks} />

      <div>
        <div role="tablist" aria-label="Vistas del proyecto" className="flex gap-1 border-b">
          {TABS.filter((item) => item.id !== 'phases' || usesPhases).map((item) => (
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
            <div className="grid gap-3">
              {usesPhases && phases.length > 0 && (
                <PhaseFilter phases={phases} value={activePhaseFilter} onChange={setPhaseFilter} />
              )}
              <TaskBoard
                workspaceId={workspaceId}
                projectId={projectId}
                tasks={boardTasks}
                people={people}
                phases={usesPhases ? phases : undefined}
                canEdit={(task) => canUpdateTask(access, taskFacts(task, facts, hasMyTask))}
                canDelete={(task) => canRemoveTask(access, taskFacts(task, facts, hasMyTask))}
                taskTypeOptions={taskTypeOptions}
              />
            </div>
          ) : tab === 'list' ? (
            <ProjectTaskList
              workspaceId={workspaceId}
              project={project}
              tasks={tasks}
              people={people}
              taskTypes={taskTypes}
              phases={usesPhases ? phases : undefined}
              filters={listFilters}
              onFilters={(next) =>
                void navigate({ search: { ...next, tab: 'list' }, replace: true })
              }
              canEdit={(task) => canUpdateTask(access, taskFacts(task, facts, hasMyTask))}
              taskTypeOptions={taskTypeOptions}
            />
          ) : tab === 'phases' && usesPhases ? (
            <PhaseOutline
              workspaceId={workspaceId}
              projectId={projectId}
              phases={phases}
              tasks={tasks}
              canManage={canUpdate}
              onOpenPhase={(phaseId) => {
                setPhaseFilter(phaseId);
                setTab('board');
              }}
            />
          ) : (
            <ProjectDetails project={project} showWork={showSprint} />
          )}
        </div>
      </div>

      <EditProjectDialog
        workspaceId={workspaceId}
        project={project}
        types={selectableTypes(types, project.type.id)}
        taskTypes={taskTypes}
        people={people}
        readOnly={!canUpdate}
        open={dialog === 'edit'}
        onClose={() => setDialog(undefined)}
      />
      <CreateTaskDialog
        workspaceId={workspaceId}
        projectId={projectId}
        people={people}
        types={taskTypeOptions()}
        phases={usesPhases ? phases : undefined}
        defaultPhaseId={activePhaseFilter === LOOSE_TASKS ? undefined : activePhaseFilter}
        open={dialog === 'task'}
        onClose={() => setDialog(undefined)}
      />
    </div>
  );
}

/**
 * Pestaña Lista (HU-26): la tabla de la vista Tareas (HU-39) con este proyecto, con los mismos
 * filtros y orden en la URL. Si el tipo usa fases, agrupa por fase con sangría. Ejemplo: buscar
 * "examen" deja "Módulo 101" con su tarea "Examen 101" y oculta las fases sin coincidencias.
 */
function ProjectTaskList({
  workspaceId,
  project,
  tasks,
  people,
  taskTypes,
  phases,
  filters,
  onFilters,
  canEdit,
  taskTypeOptions,
}: {
  workspaceId: string;
  project: Project;
  tasks: Task[];
  people: Person[];
  taskTypes: TaskType[];
  phases: Phase[] | undefined;
  filters: Omit<ProjectSearch, 'tab'>;
  onFilters: (next: Omit<ProjectSearch, 'tab'>) => void;
  canEdit: (task: Task) => boolean;
  taskTypeOptions: (currentId?: string) => TaskType[];
}) {
  const { data: origins = [] } = useQuery(taskOriginsQueryOptions(workspaceId));
  const [editingId, setEditingId] = useState<string>();
  const today = todayIso();
  // Las reglas de filtro y orden de la vista Tareas piden el contenedor de cada tarea
  const projectRef: WorkspaceTask['project'] = {
    id: project.id,
    name: project.name,
    folio: project.folio,
    createdById: project.createdById,
    scope: project.scope,
    type: project.type,
  };
  const all = tasks.map((task) => ({ ...task, project: projectRef }));
  const visible = sortTasks(filterTasks(all, filters, today), filters.sort, filters.dir);
  const hidden = all.length - visible.length;
  const editing = tasks.find((task) => task.id === editingId);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay tareas.</p>;
  }

  return (
    <div className="grid gap-3">
      {editing && (
        <EditTaskPanel
          key={editing.id}
          task={editing}
          workspaceId={workspaceId}
          projectId={project.id}
          people={people}
          phases={phases}
          types={taskTypeOptions(editing.type.id)}
          onClose={() => setEditingId(undefined)}
        />
      )}
      <TaskFiltersBar
        projects={[]}
        taskTypes={taskTypes}
        people={people}
        origins={origins}
        filters={filters}
        onChange={onFilters}
        inProject
      />
      <p className="text-sm text-muted-foreground">
        {visible.length} de {all.length}
        {hidden > 0 && !hasActiveFilters(filters) ? ' (hechas y canceladas ocultas)' : ''}
      </p>
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
          onEdit={(task) => (canEdit(task) ? () => setEditingId(task.id) : undefined)}
          showProject={false}
          phases={phases && phases.length > 0 ? phases : undefined}
        />
      )}
    </div>
  );
}

/**
 * Filtro del tablero por fase (HU-07). Ejemplo: "Módulo 101" muestra sus tareas y las de "Tema 1"
 * y "Tema 2"; "Sin fase", las que no están en ninguna.
 */
function PhaseFilter({
  phases,
  value,
  onChange,
}: {
  phases: Phase[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Fase</span>
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-64"
      >
        <option value="">Todas</option>
        {orderedPhases(phases).map(({ phase, depth }) => (
          <option key={phase.id} value={phase.id}>
            {'\u00a0\u00a0'.repeat(depth - 1)}
            {phase.name}
          </option>
        ))}
        <option value={LOOSE_TASKS}>Sin fase</option>
      </NativeSelect>
    </label>
  );
}

/** Avance, trabajo pendiente, fecha de fin y lo que requiere atención (HU-06, HU-28c) */
function ProjectKpis({ project, tasks }: { project: Project; tasks: Task[] }) {
  const today = todayIso();
  const { progress } = project;
  const open = tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'PAUSED'].includes(t.status));
  const paused = open.filter((t) => t.status === 'PAUSED').length;
  const overdue = open.filter((t) => t.endDate !== null && t.endDate < today).length;
  // Actividad de alguien que ya no tiene acceso al espacio (HU-25 con personas)
  const orphan = open.filter((t) => t.responsible?.userId && !t.responsible.hasAccess).length;
  const late = project.endDate !== null && project.endDate < today && project.status !== 'DONE';

  const attentionHint =
    [
      overdue > 0 && `${overdue} vencida${overdue === 1 ? '' : 's'}`,
      orphan > 0 && `${orphan} por reasignar`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Todo en orden';

  const pendingWork = (
    <Kpi label="Trabajo pendiente" value={formatMinutes(progress.pendingMinutes)}>
      {paused > 0
        ? `Incluye ${paused} tarea${paused === 1 ? '' : 's'} pausada${paused === 1 ? '' : 's'}`
        : `${open.length} tarea${open.length === 1 ? '' : 's'} abierta${open.length === 1 ? '' : 's'}`}
    </Kpi>
  );

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {project.type.behavior === 'WITH_END' ? (
        <>
          <Kpi label="Avance" value={`${progress.percent}%`}>
            <ProgressBar percent={progress.percent} label="Avance del proyecto" />
            <span>
              {progress.doneTasks} de {progress.totalTasks} tareas
            </span>
          </Kpi>
          {pendingWork}
          <Kpi
            label="Fecha de fin"
            value={daysRemainingLabel(project.endDate, today)}
            tone={late ? 'text-destructive' : undefined}
          >
            {project.endDate ? formatDate(project.endDate) : 'Sin fecha planeada'}
          </Kpi>
        </>
      ) : (
        // Continuo y Por demanda no tienen % ni "vencido" del contenedor (ADR-0004 §2)
        <>
          <Kpi label="Abiertas" value={String(progress.openTasks)}>
            Pendientes, en curso y pausadas
          </Kpi>
          {project.type.behavior === 'ONGOING' ? (
            <Kpi label="Hechas este mes" value={String(progress.doneThisMonth)}>
              Desde el día 1
            </Kpi>
          ) : (
            pendingWork
          )}
          {project.type.behavior === 'ONGOING' ? (
            pendingWork
          ) : (
            <Kpi label="Hechas" value={String(progress.doneTasks)}>
              De {progress.totalTasks} en total
            </Kpi>
          )}
        </>
      )}
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

/**
 * Campos del trabajo de un personal (HU-49b), cuando se piden ver: cada valor con su nombre, para
 * que un "N/A" diga de qué campo es
 */
function PersonalWorkFields({ project }: { project: Project }) {
  const rows = [
    ['Project manager', project.projectManager?.name],
    ['Gte. Consultoría', project.consultingManager?.name],
    ['Business partner', project.businessPartner?.name],
    ['Sprint', project.sprint],
    ['Actividades del sprint', project.sprintActivities],
  ];
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 rounded-lg border bg-card p-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-line">{value || NOT_APPLICABLE}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Fecha real (un instante) como fecha local: "18 nov 2026" */
function formatInstant(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return formatDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

/** Fin real contra fin planeado: "3 días tarde", "A tiempo"; sin alguno de los dos, nada */
function deviationLabel(endDate: string | null, finishedAt: string | null) {
  if (!endDate || !finishedAt) return null;
  const finished = new Date(finishedAt);
  const local = Date.UTC(finished.getFullYear(), finished.getMonth(), finished.getDate());
  const days = Math.round((local - Date.parse(`${endDate}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return days === 0 ? 'A tiempo' : `${-days} día${days === -1 ? '' : 's'} antes`;
  return `${days} día${days === 1 ? '' : 's'} tarde`;
}

/** Pestaña "Datos del proyecto": todo lo capturado, solo lectura (se edita en la ventana) */
function ProjectDetails({ project, showWork }: { project: Project; showWork: boolean }) {
  // En un personal (HU-49), las personas del trabajo vacías dicen "N/A" y se pueden ocultar
  const personal = project.scope === 'PERSONAL';
  const workPerson = (person: { name: string } | null) =>
    person?.name ?? (personal ? NOT_APPLICABLE : undefined);
  const sections = [
    {
      title: 'Personas',
      rows: [
        ['Solicitante', project.requester?.name],
        ['Asignado a', project.assignedTo?.name],
        ...(showWork
          ? [
              ['Project manager', workPerson(project.projectManager)],
              ['Gte. Consultoría', workPerson(project.consultingManager)],
              ['Business partner', workPerson(project.businessPartner)],
            ]
          : []),
      ],
    },
    {
      title: 'Planeación',
      rows: [
        ['Tipo', project.type.name],
        ['Ámbito', PROJECT_SCOPES[project.scope]],
        ['Folio', project.folio],
        ['Área', project.area],
        ['Clasificación', project.classification],
        ['Prioridad', PROJECT_PRIORITIES[project.priority]],
      ],
    },
    {
      // Planeadas las captura la persona; reales las pone el sistema (ADR-0004 §2.1)
      title: 'Fechas',
      rows: [
        ['Inicio planeado', project.startDate && formatDate(project.startDate)],
        ['Inicio real', project.startedAt && formatInstant(project.startedAt)],
        ['Fin planeado', project.endDate && formatDate(project.endDate)],
        ['Fin real', project.finishedAt && formatInstant(project.finishedAt)],
        ['Desviación', deviationLabel(project.endDate, project.finishedAt)],
      ],
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
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
      {showWork && (
        <Card className="lg:col-span-3">
          <CardContent className="grid gap-2">
            {/* En un personal, con su nombre: "Sprint: N/A" (HU-49b) */}
            <h2 className="font-semibold">
              {personal
                ? `Sprint: ${project.sprint ?? NOT_APPLICABLE}`
                : (project.sprint ?? 'Sprint')}
            </h2>
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {personal
                ? `Actividades del sprint: ${project.sprintActivities ?? NOT_APPLICABLE}`
                : (project.sprintActivities ?? 'Sin actividades del sprint.')}
            </p>
          </CardContent>
        </Card>
      )}
      <Card className="lg:col-span-3">
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
  types,
  taskTypes,
  people,
  readOnly,
  open,
  onClose,
}: {
  workspaceId: string;
  project: Project;
  types: ProjectType[];
  taskTypes: TaskType[];
  people: Person[];
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
          types={types}
          taskTypes={taskTypes}
          workspaceId={workspaceId}
          people={people}
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
  people,
  types,
  phases,
  defaultPhaseId,
  open,
  onClose,
}: {
  workspaceId: string;
  projectId: string;
  people: Person[];
  types: TaskTypeRef[];
  phases: Phase[] | undefined;
  defaultPhaseId: string | undefined;
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
          workspaceId={workspaceId}
          people={people}
          types={types}
          phases={phases}
          defaultPhaseId={defaultPhaseId}
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
