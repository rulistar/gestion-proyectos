import {
  canUpdateContainer,
  daysRemainingLabel,
  projectStatusSchema,
  type Project,
  type ProjectBehavior,
  type ProjectStatus,
} from '@gestion/shared';
import { Link } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { containerFacts, useAccess } from '@/lib/access';
import { formatDate, todayIso } from '@/lib/dates';
import { PROJECT_PRIORITIES, PROJECT_STATUSES, useUpdateProjectStatus } from '@/lib/projects';

/** Pedido del PO (2026-10-31): lo cerrado no se ve hasta pedirlo, para dar espacio a lo abierto */
const CLOSED: readonly ProjectStatus[] = ['DONE', 'CANCELLED'];

/**
 * Tablero de contenedores por estado (HU-10): una columna por estado, con los mismos filtros de la
 * lista. El combo de la tarjeta lo pasa de columna (si la matriz deja modificarlo). Ejemplo:
 * "Certificación Linux" de No iniciado a En curso registra su inicio real.
 */
export function ProjectsBoard({
  workspaceId,
  projects,
  behavior,
}: {
  workspaceId: string;
  /** Ya filtrados y ordenados */
  projects: Project[];
  behavior: ProjectBehavior;
}) {
  const [shown, setShown] = useState<ReadonlySet<ProjectStatus>>(new Set());
  const columnOf = (status: ProjectStatus) =>
    projects.filter((project) => project.status === status);

  function toggle(status: ProjectStatus) {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const statuses = projectStatusSchema.options.filter(
    (status) => !CLOSED.includes(status) || shown.has(status),
  );

  return (
    <div className="grid gap-2">
      {/* Botones con el total de cada estado cerrado: muestran u ocultan su columna */}
      <div className="flex flex-wrap gap-2">
        {CLOSED.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={shown.has(status) ? 'default' : 'outline'}
            aria-pressed={shown.has(status)}
            onClick={() => toggle(status)}
          >
            {shown.has(status) ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {status === 'DONE' ? 'Terminados' : 'Cancelados'} ({columnOf(status).length})
          </Button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {statuses.map((status) => {
          const column = columnOf(status);
          return (
            <section
              key={status}
              aria-label={PROJECT_STATUSES[status].label}
              className="grid min-w-56 flex-1 content-start gap-2 rounded-lg bg-muted/50 p-2"
            >
              <h3 className="flex items-center gap-1.5 px-1 text-sm font-semibold">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: PROJECT_STATUSES[status].color }}
                />
                {PROJECT_STATUSES[status].label} · {column.length}
              </h3>
              {column.map((project) => (
                <ProjectCard
                  key={project.id}
                  workspaceId={workspaceId}
                  project={project}
                  behavior={behavior}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProjectCard({
  workspaceId,
  project,
  behavior,
}: {
  workspaceId: string;
  project: Project;
  behavior: ProjectBehavior;
}) {
  const access = useAccess(workspaceId);
  const canEdit = canUpdateContainer(access, containerFacts(project));
  const setStatus = useUpdateProjectStatus(workspaceId);
  const today = todayIso();

  function changeStatus(status: ProjectStatus) {
    setStatus.mutate(
      { projectId: project.id, status },
      {
        onSuccess: () =>
          toast.success(`"${project.name}" pasó a ${PROJECT_STATUSES[status].label}`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <article className="grid gap-2 rounded-md border bg-card p-3 text-sm shadow-xs">
      {project.folio && <p className="text-xs text-muted-foreground">{project.folio}</p>}
      <Link
        to="/w/$workspaceId/p/$projectId"
        params={{ workspaceId, projectId: project.id }}
        className="font-medium hover:underline"
      >
        {project.name}
      </Link>
      <p className="text-xs text-muted-foreground">
        Prioridad {PROJECT_PRIORITIES[project.priority].toLowerCase()}
        {project.sprint && ` · ${project.sprint}`}
      </p>
      {behavior === 'WITH_END' ? (
        <div className="flex items-center gap-2">
          <ProgressBar percent={project.progress.percent} label={`Avance de ${project.name}`} />
          <span className="w-9 text-right text-xs tabular-nums">{project.progress.percent}%</span>
        </div>
      ) : (
        <p className="text-xs">
          {project.progress.openTasks} abiertas
          {project.progress.overdueTasks > 0 && (
            <span className="font-semibold text-destructive">
              {' '}
              · {project.progress.overdueTasks} vencidas
            </span>
          )}
        </p>
      )}
      {project.endDate && (
        <p className="text-xs text-muted-foreground">
          Fin {formatDate(project.endDate)} · {daysRemainingLabel(project.endDate, today)}
        </p>
      )}
      {canEdit && (
        <NativeSelect
          aria-label={`Estado de ${project.name}`}
          className="h-8"
          value={project.status}
          disabled={setStatus.isPending}
          onChange={(event) => changeStatus(projectStatusSchema.parse(event.target.value))}
        >
          {projectStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUSES[status].label}
            </option>
          ))}
        </NativeSelect>
      )}
    </article>
  );
}
