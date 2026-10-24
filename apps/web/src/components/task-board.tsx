import type { Member, Task, TaskStatus } from '@gestion/shared';
import { useState } from 'react';
import { TaskForm } from '@/components/task-form';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDate } from '@/lib/dates';
import { TASK_STATUSES, TASK_TYPES, useMoveTask, useUpdateTask } from '@/lib/tasks';

interface TaskBoardProps {
  workspaceId: string;
  projectId: string;
  tasks: Task[];
  members: Member[];
  /** Si el rol permite crear y editar tareas (la API lo vuelve a comprobar) */
  canEdit: boolean;
}

/** Tareas del proyecto en tres columnas: Pendiente, En curso y Hecha (HU-08) */
export function TaskBoard({ workspaceId, projectId, tasks, members, canEdit }: TaskBoardProps) {
  const [editingId, setEditingId] = useState<string>();
  const editing = tasks.find((task) => task.id === editingId);
  const memberNames = new Map(members.map((m) => [m.userId, m.name]));

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
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((status) => {
          const column = tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              aria-label={TASK_STATUSES[status]}
              className="grid content-start gap-2"
            >
              <h3 className="text-sm font-medium text-muted-foreground">
                {TASK_STATUSES[status]} · {column.length}
              </h3>
              {column.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  assigneeName={task.assigneeId ? memberNames.get(task.assigneeId) : undefined}
                  canEdit={canEdit}
                  onEdit={() => setEditingId(task.id)}
                />
              ))}
              {column.length === 0 && (
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
  assigneeName: string | undefined;
  canEdit: boolean;
  onEdit: () => void;
}

function TaskCard({ task, workspaceId, projectId, assigneeName, canEdit, onEdit }: TaskCardProps) {
  const move = useMoveTask(workspaceId, projectId, task.id);

  const details = [
    TASK_TYPES[task.type],
    assigneeName ?? 'Sin asignar',
    task.estimatedMinutes !== null && `${task.estimatedMinutes} min`,
    task.endDate && `Fin: ${formatDate(task.endDate)}`,
  ].filter(Boolean);

  return (
    <article className="grid gap-2 rounded-md border bg-background p-3">
      <p className={task.status === 'DONE' ? 'text-muted-foreground line-through' : 'font-medium'}>
        {task.title}
      </p>
      <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>
      {canEdit && (
        <div className="flex items-center gap-2">
          {/* Mover de columna: cambia solo el estado (PATCH .../status) */}
          <NativeSelect
            aria-label={`Estado de "${task.title}"`}
            value={task.status}
            disabled={move.isPending}
            onChange={(event) => move.mutate(event.target.value as TaskStatus)}
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
