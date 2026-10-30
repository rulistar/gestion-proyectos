import {
  loosePhaseTasks,
  MAX_PHASE_DEPTH,
  summarizePhase,
  type Phase,
  type Task,
} from '@gestion/shared';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/dates';
import { useCreatePhase, useDeletePhase, useMovePhase, useRenamePhase } from '@/lib/phases';
import { TASK_STATUSES } from '@/lib/tasks';
import { cn } from '@/lib/utils';

/** "Sin fase" en el filtro del tablero */
export const LOOSE_TASKS = 'none';

interface PhaseOutlineProps {
  workspaceId: string;
  projectId: string;
  phases: Phase[];
  /** Las tareas que veo del proyecto: con ellas se calcula el avance de cada fase */
  tasks: Task[];
  /** Si puedo modificar el contenedor, puedo manejar sus fases (decisión del PO) */
  canManage: boolean;
  /** Abre el tablero filtrado por esa fase (o por las tareas sin fase) */
  onOpenPhase: (phaseId: string) => void;
}

/**
 * Fases del proyecto como esquema con sangría (HU-07), como las tareas resumen de Project: cada
 * fase muestra su avance y sus fechas, calculados con todo lo que contiene, y se pliega
 */
export function PhaseOutline({
  workspaceId,
  projectId,
  phases,
  tasks,
  canManage,
  onOpenPhase,
}: PhaseOutlineProps) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const loose = loosePhaseTasks(phases, tasks);

  function toggle(phaseId: string) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  const shared = { workspaceId, projectId, phases, tasks, canManage, folded, toggle, onOpenPhase };

  return (
    <div className="grid gap-3">
      {canManage && <NewPhaseForm workspaceId={workspaceId} projectId={projectId} />}
      {phases.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay fases. Agrupa las tareas en fases y subfases (hasta {MAX_PHASE_DEPTH}{' '}
          niveles), por ejemplo "Módulo 101" → "Tema 1".
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {childPhases(phases, null).map((phase, index, siblings) => (
            <PhaseNode
              key={phase.id}
              phase={phase}
              depth={1}
              isFirst={index === 0}
              isLast={index === siblings.length - 1}
              {...shared}
            />
          ))}
        </ul>
      )}
      {loose.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenPhase(LOOSE_TASKS)}
          className="justify-self-start text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Sin fase: {loose.length} tarea{loose.length === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}

/** Hijas de una fase (o las de primer nivel), en su orden */
function childPhases(phases: Phase[], parentId: string | null) {
  return phases
    .filter((phase) => phase.parentId === parentId)
    .sort((a, b) => a.position - b.position);
}

interface PhaseNodeProps {
  workspaceId: string;
  projectId: string;
  phase: Phase;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  phases: Phase[];
  tasks: Task[];
  canManage: boolean;
  folded: ReadonlySet<string>;
  toggle: (phaseId: string) => void;
  onOpenPhase: (phaseId: string) => void;
}

function PhaseNode(props: PhaseNodeProps) {
  const { workspaceId, projectId, phase, depth, isFirst, isLast, phases, tasks, canManage } = props;
  const [editing, setEditing] = useState<'rename' | 'child'>();
  const move = useMovePhase(workspaceId, projectId);
  const remove = useDeletePhase(workspaceId, projectId);
  const summary = summarizePhase(phases, tasks, phase.id);
  const subphases = childPhases(phases, phase.id);
  const own = tasks.filter((task) => task.phaseId === phase.id);
  const isFolded = props.folded.has(phase.id);
  const hasContent = subphases.length > 0 || own.length > 0;
  const indent = { paddingLeft: `${(depth - 1) * 1.5 + 0.5}rem` };

  function handleMove(direction: 'up' | 'down') {
    move.mutate(
      { phaseId: phase.id, direction },
      { onError: (error) => toast.error(error.message) },
    );
  }

  function handleDelete() {
    remove.mutate(phase.id, {
      onSuccess: () => toast.success(`"${phase.name}" se envió a la papelera`),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-2" style={indent}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={!hasContent}
          aria-expanded={hasContent ? !isFolded : undefined}
          aria-label={isFolded ? `Desplegar "${phase.name}"` : `Plegar "${phase.name}"`}
          onClick={() => props.toggle(phase.id)}
        >
          {isFolded ? <ChevronRight aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
        {editing === 'rename' ? (
          <PhaseNameForm
            label={`Nuevo nombre de ${phase.name}`}
            initial={phase.name}
            onDone={() => setEditing(undefined)}
            workspaceId={workspaceId}
            projectId={projectId}
            phaseId={phase.id}
          />
        ) : (
          <button
            type="button"
            onClick={() => props.onOpenPhase(phase.id)}
            className={cn('min-w-0 text-left hover:underline', depth === 1 && 'font-semibold')}
            title="Ver sus tareas en el tablero"
          >
            {phase.name}
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <ProgressBar
              percent={summary.percent}
              label={`Avance de ${phase.name}`}
              className="w-20"
            />
            <span className="w-24">
              {summary.percent}% · {summary.doneTasks} de {summary.totalTasks}
            </span>
          </span>
          <span className="w-44">
            {summary.startDate || summary.endDate
              ? `${formatDate(summary.startDate)} → ${formatDate(summary.endDate)}`
              : 'Sin fechas'}
          </span>
          {canManage && (
            <span className="flex items-center">
              {depth < MAX_PHASE_DEPTH && (
                <IconButton
                  label={`Nueva subfase en "${phase.name}"`}
                  onClick={() => setEditing('child')}
                >
                  <Plus aria-hidden />
                </IconButton>
              )}
              <IconButton label={`Renombrar "${phase.name}"`} onClick={() => setEditing('rename')}>
                <Pencil aria-hidden />
              </IconButton>
              <IconButton
                label={`Subir "${phase.name}"`}
                disabled={isFirst || move.isPending}
                onClick={() => handleMove('up')}
              >
                <ArrowUp aria-hidden />
              </IconButton>
              <IconButton
                label={`Bajar "${phase.name}"`}
                disabled={isLast || move.isPending}
                onClick={() => handleMove('down')}
              >
                <ArrowDown aria-hidden />
              </IconButton>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    disabled={remove.isPending}
                    aria-label={`Dar de baja "${phase.name}"`}
                    title="Dar de baja"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                title={`¿Dar de baja "${phase.name}"?`}
                description="La fase se va a la papelera con sus subfases y sus tareas: dejan de verse y de contar en el avance. Al restaurarla vuelven."
                confirmLabel="Dar de baja"
                onConfirm={handleDelete}
              />
            </span>
          )}
        </div>
      </div>
      {editing === 'child' && (
        <div className="pb-2" style={{ paddingLeft: `${depth * 1.5 + 2.25}rem` }}>
          <NewPhaseForm
            workspaceId={workspaceId}
            projectId={projectId}
            parentId={phase.id}
            onDone={() => setEditing(undefined)}
          />
        </div>
      )}
      {!isFolded && hasContent && (
        <ul>
          {subphases.map((child, index) => (
            <PhaseNode
              {...props}
              key={child.id}
              phase={child}
              depth={depth + 1}
              isFirst={index === 0}
              isLast={index === subphases.length - 1}
            />
          ))}
          {own.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 py-1 pr-2 text-sm"
              style={{ paddingLeft: `${depth * 1.5 + 2.25}rem` }}
            >
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <span
                className={cn(
                  'min-w-0 truncate',
                  (task.status === 'DONE' || task.status === 'CANCELLED') &&
                    'text-muted-foreground line-through',
                )}
              >
                {task.title}
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {TASK_STATUSES[task.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-7 p-0"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Nueva fase de primer nivel (sin parentId) o subfase */
function NewPhaseForm({
  workspaceId,
  projectId,
  parentId,
  onDone,
}: {
  workspaceId: string;
  projectId: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const create = useCreatePhase(workspaceId, projectId);
  const [name, setName] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === '') return;
    create.mutate(
      { name: name.trim(), parentId: parentId ?? null },
      {
        onSuccess: (phase) => {
          toast.success(`Se agregó "${phase.name}"`);
          setName('');
          onDone?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={parentId ? 'Nombre de la subfase' : 'Nombre de la fase'}
        placeholder={
          parentId ? 'Nueva subfase, p. ej. "Tema 1"' : 'Nueva fase, p. ej. "Módulo 101"'
        }
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        autoFocus={Boolean(parentId)}
        className="h-8 w-72"
      />
      <Button type="submit" size="sm" disabled={create.isPending || name.trim() === ''}>
        <Plus aria-hidden />
        {parentId ? 'Agregar subfase' : 'Nueva fase'}
      </Button>
      {onDone && (
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      )}
    </form>
  );
}

function PhaseNameForm({
  workspaceId,
  projectId,
  phaseId,
  label,
  initial,
  onDone,
}: {
  workspaceId: string;
  projectId: string;
  phaseId: string;
  label: string;
  initial: string;
  onDone: () => void;
}) {
  const rename = useRenamePhase(workspaceId, projectId);
  const [name, setName] = useState(initial);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === '' || name.trim() === initial) return onDone();
    rename.mutate(
      { phaseId, name: name.trim() },
      {
        onSuccess: () => {
          toast.success(`Ahora se llama "${name.trim()}"`);
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <Input
        aria-label={label}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        autoFocus
        className="h-8 w-56"
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        aria-label="Guardar nombre"
        disabled={rename.isPending}
      >
        <Check aria-hidden />
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Cancelar" onClick={onDone}>
        <X aria-hidden />
      </Button>
    </form>
  );
}
