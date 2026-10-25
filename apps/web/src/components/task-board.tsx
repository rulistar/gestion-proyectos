import { statusNeedsReason, type Member, type Task, type TaskStatus } from '@gestion/shared';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDate } from '@/lib/dates';
import { TASK_STATUSES, TASK_TYPES, useDeleteTask, useMoveTask, useUpdateTask } from '@/lib/tasks';

interface TaskBoardProps {
  workspaceId: string;
  projectId: string;
  tasks: Task[];
  members: Member[];
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
  members,
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
          members={members}
          onClose={() => setEditingId(undefined)}
        />
      )}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((status) => {
          const column = tasks.filter((task) => task.status === status);
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

  const details = [
    TASK_TYPES[task.type],
    task.assigneeName ?? 'Sin asignar',
    task.estimatedMinutes !== null && `${task.estimatedMinutes} min`,
    task.endDate && `Fin: ${formatDate(task.endDate)}`,
  ].filter(Boolean);

  return (
    <article className="grid gap-2 rounded-md border bg-background p-3">
      <p className={finished ? 'text-muted-foreground line-through' : 'font-medium'}>
        {task.title}
      </p>
      <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>
      {!task.assigneeIsMember && (
        // Decisión del PO (HU-25): la tarea conserva el nombre hasta que alguien la reasigne
        <p className="rounded bg-warning/25 px-2 py-1 text-xs text-warning-foreground">
          {task.assigneeName} ya no es miembro: reasigna esta tarea
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
            <>
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
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Editar
              </Button>
            </>
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
  members: Member[];
  onClose: () => void;
}

function EditTaskPanel({ task, workspaceId, projectId, members, onClose }: EditTaskPanelProps) {
  const update = useUpdateTask(workspaceId, projectId, task.id);

  return (
    <section aria-label="Editar tarea" className="rounded-md border bg-background p-4">
      <h3 className="mb-3 font-medium">Editar tarea</h3>
      <TaskForm
        task={task}
        members={members}
        submitLabel="Guardar"
        isPending={update.isPending}
        error={update.error?.message}
        onSubmit={(data) => update.mutate(data, { onSuccess: onClose })}
      >
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </TaskForm>
    </section>
  );
}
