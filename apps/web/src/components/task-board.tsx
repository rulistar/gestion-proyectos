import {
  statusNeedsReason,
  type Person,
  type Task,
  type TaskStatus,
  type TaskTypeRef,
} from '@gestion/shared';
import { Pencil, Trash2, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { MoveTaskDialog } from '@/components/move-dialogs';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { initials } from '@/lib/brand';
import { formatMinutes, todayIso } from '@/lib/dates';
import { dueInfo } from '@/lib/due';
import { taskTypeClass } from '@/lib/task-types';
import { TASK_STATUSES, useDeleteTask, useMoveTask, useUpdateTask } from '@/lib/tasks';
import { cn } from '@/lib/utils';

interface TaskBoardProps {
  workspaceId: string;
  projectId: string;
  tasks: Task[];
  people: Person[];
  /** Tipos de tarea que se pueden elegir al editar (HU-22), con el actual de la tarea */
  taskTypeOptions: (currentId: string) => TaskTypeRef[];
  /** Si el rol permite crear y editar tareas (la API lo vuelve a comprobar) */
  canEdit: boolean;
  /** Si el rol permite dar de baja tareas (HU-15) */
  canDelete: boolean;
}

/** Columnas que se pueden plegar: lo terminado ocupa espacio sin pedir atención */
const FOLDABLE: readonly TaskStatus[] = ['DONE', 'CANCELLED'];

/** Tareas del proyecto en una columna por estado (HU-08, HU-24) */
export function TaskBoard({
  workspaceId,
  projectId,
  tasks,
  people,
  taskTypeOptions,
  canEdit,
  canDelete,
}: TaskBoardProps) {
  const [editingId, setEditingId] = useState<string>();
  // Cancelada empieza plegada; Hecha, abierta
  const [folded, setFolded] = useState<ReadonlySet<TaskStatus>>(() => new Set(['CANCELLED']));
  const editing = tasks.find((task) => task.id === editingId);

  function toggleFold(status: TaskStatus) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      {editing && (
        <EditTaskPanel
          key={editing.id}
          task={editing}
          workspaceId={workspaceId}
          projectId={projectId}
          people={people}
          types={taskTypeOptions(editing.type.id)}
          onClose={() => setEditingId(undefined)}
        />
      )}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((status) => {
          // Las de atención inmediata (Fast track) van primero en su columna (ADR-0004 §5)
          const column = tasks
            .filter((task) => task.status === status)
            .sort((a, b) => Number(b.type.expedited) - Number(a.type.expedited));
          const isFolded = folded.has(status);
          return (
            <section
              key={status}
              aria-label={TASK_STATUSES[status]}
              className="grid content-start gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {TASK_STATUSES[status]} · {column.length}
                </h3>
                {FOLDABLE.includes(status) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    aria-expanded={!isFolded}
                    onClick={() => toggleFold(status)}
                  >
                    {isFolded ? 'Mostrar' : 'Plegar'}
                  </Button>
                )}
              </div>
              {!isFolded &&
                column.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => setEditingId(task.id)}
                  />
                ))}
              {!isFolded && column.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                  Sin tareas
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  workspaceId: string;
  projectId: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
}

function TaskCard({ task, workspaceId, projectId, canEdit, canDelete, onEdit }: TaskCardProps) {
  const move = useMoveTask(workspaceId, projectId, task.id);
  const remove = useDeleteTask(workspaceId, projectId, task.id);
  /** Estado elegido que pide motivo (Pausada o Cancelada): se pregunta antes de moverla */
  const [askingReasonFor, setAskingReasonFor] = useState<TaskStatus>();
  const finished = task.status === 'DONE' || task.status === 'CANCELLED';

  function changeStatus(status: TaskStatus) {
    if (statusNeedsReason(status)) setAskingReasonFor(status);
    else move.mutate({ status, statusReason: null });
  }

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => toast.success(`"${task.title}" se envió a la papelera`),
      onError: (error) => toast.error(error.message),
    });
  }

  const due = dueInfo(task.endDate, todayIso());
  // Actividad vinculada a una cuenta que ya no es miembro del espacio
  const lostAccess = Boolean(task.responsible?.userId && !task.responsible.hasAccess);

  return (
    <article
      className={cn(
        'grid gap-2.5 rounded-lg border bg-background p-3 shadow-xs',
        // Atención inmediata en dorado; lo vencido y abierto, en rojo: se ven de un vistazo
        !finished && task.type.expedited && 'border-l-4 border-l-warning',
        !finished && due.overdue && 'border-l-4 border-l-destructive',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold',
            taskTypeClass(task.type),
          )}
          title={task.type.expedited ? 'Atención inmediata' : undefined}
        >
          {task.type.expedited && <Zap aria-hidden className="size-3" />}
          {task.type.name}
        </span>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mt-1 -mr-1 h-7 px-1.5 text-muted-foreground"
            onClick={onEdit}
            aria-label={`Editar "${task.title}"`}
            title="Editar"
          >
            <Pencil aria-hidden />
          </Button>
        )}
      </div>
      <p className={finished ? 'text-muted-foreground line-through' : 'font-medium'}>
        {task.title}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            task.responsible ? 'bg-primary text-primary-foreground' : 'border border-dashed',
          )}
        >
          {task.responsible ? initials(task.responsible.name) : '?'}
        </span>
        <span className="min-w-0 truncate">{task.responsible?.name ?? 'Sin asignar'}</span>
        {task.estimatedMinutes !== null && (
          <span className="shrink-0">· {formatMinutes(task.estimatedMinutes)}</span>
        )}
        {!finished && (
          <span
            className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 font-semibold', due.className)}
          >
            {due.text}
          </span>
        )}
      </div>
      {lostAccess && (
        // HU-25 con personas: la tarea conserva a la persona hasta que alguien la reasigne
        <p className="rounded bg-warning/25 px-2 py-1 text-xs text-warning-foreground">
          {task.responsible!.name} ya no tiene acceso al espacio: reasigna esta tarea
        </p>
      )}
      {task.statusReason && (
        <p className="rounded bg-muted px-2 py-1 text-xs">
          <span className="font-medium">Motivo:</span> {task.statusReason}
        </p>
      )}
      {askingReasonFor && (
        <ReasonPrompt
          status={askingReasonFor}
          isPending={move.isPending}
          onConfirm={(statusReason) =>
            move.mutate(
              { status: askingReasonFor, statusReason },
              { onSuccess: () => setAskingReasonFor(undefined) },
            )
          }
          onDiscard={() => setAskingReasonFor(undefined)}
        />
      )}
      {(canEdit || canDelete) && !askingReasonFor && (
        <div className="flex items-center gap-2">
          {/* Mover de columna: cambia solo el estado (PATCH .../status) */}
          {canEdit && (
            <NativeSelect
              aria-label={`Estado de "${task.title}"`}
              value={task.status}
              disabled={move.isPending}
              onChange={(event) => changeStatus(event.target.value as TaskStatus)}
              className="h-8"
            >
              {Object.entries(TASK_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
          {canDelete && (
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto px-2"
                  disabled={remove.isPending}
                  aria-label={`Dar de baja "${task.title}"`}
                  title="Dar de baja"
                >
                  <Trash2 aria-hidden />
                </Button>
              }
              title={`¿Dar de baja "${task.title}"?`}
              description="La tarea se va a la papelera y deja de contar en el avance. El Admin puede restaurarla."
              confirmLabel="Dar de baja"
              onConfirm={handleDelete}
            />
          )}
        </div>
      )}
      {move.error && (
        <p role="alert" className="text-xs text-destructive">
          {move.error.message}
        </p>
      )}
    </article>
  );
}

/** Pide el motivo al pausar o cancelar desde la tarjeta (HU-24) */
function ReasonPrompt({
  status,
  isPending,
  onConfirm,
  onDiscard,
}: {
  status: TaskStatus;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onDiscard: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const label = TASK_STATUSES[status].toLowerCase();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim() === '') {
      setError(`Escribe por qué queda ${label}`);
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-2">
      <Input
        aria-label={`Motivo para dejarla ${label}`}
        placeholder={`¿Por qué queda ${label}?`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        autoFocus
        aria-invalid={Boolean(error)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Guardando…' : `Dejar ${label}`}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Descartar
        </Button>
      </div>
    </form>
  );
}

interface EditTaskPanelProps {
  task: Task;
  workspaceId: string;
  projectId: string;
  people: Person[];
  types: TaskTypeRef[];
  onClose: () => void;
}

/**
 * Editar en una ventana: aparece al centro sin importar dónde esté la tarjeta. Antes era un panel
 * arriba del tablero y, con muchas tareas, se abría fuera de la vista y parecía no responder.
 * También la usa la vista "Tareas" (HU-39).
 */
export function EditTaskPanel({
  task,
  workspaceId,
  projectId,
  people,
  types,
  onClose,
}: EditTaskPanelProps) {
  const update = useUpdateTask(workspaceId, projectId, task.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          workspaceId={workspaceId}
          people={people}
          types={types}
          submitLabel="Guardar"
          isPending={update.isPending}
          error={update.error?.message}
          onSubmit={(data) =>
            update.mutate(data, {
              onSuccess: () => {
                toast.success('Cambios guardados');
                onClose();
              },
            })
          }
        >
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <MoveTaskDialog
            workspaceId={workspaceId}
            projectId={projectId}
            task={task}
            onMoved={onClose}
          />
        </TaskForm>
      </DialogContent>
    </Dialog>
  );
}
