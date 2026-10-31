import {
  createTaskTypeSchema,
  type DetailField,
  type ProjectType,
  type TaskType,
} from '@gestion/shared';
import { Archive, ArchiveRestore, Check, ListChecks, Pencil, X, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { DetailFieldsDialog } from '@/components/detail-fields-dialog';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateProjectType } from '@/lib/project-types';
import { taskTypeClass, useCreateTaskType, useUpdateTaskType } from '@/lib/task-types';
import { useSchemaForm } from '@/lib/use-schema-form';
import { cn } from '@/lib/utils';

/** Tipos de tarea que admite un tipo de contenedor (HU-22): ninguno marcado = todos */
export function AllowedTaskTypesDialog({
  workspaceId,
  type,
  taskTypes,
}: {
  workspaceId: string;
  type: ProjectType;
  taskTypes: TaskType[];
}) {
  const update = useUpdateProjectType(workspaceId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(type.allowedTaskTypeIds),
  );
  const choices = taskTypes.filter((t) => !t.archived || selected.has(t.id));
  const count = type.allowedTaskTypeIds.length;
  const summary = count === 0 ? 'Todas las tareas' : `${count} tipo${count === 1 ? '' : 's'}`;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    update.mutate(
      { typeId: type.id, allowedTaskTypeIds: [...selected] },
      {
        onSuccess: () => toast.success(`Se guardaron los tipos de tarea de "${type.name}"`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    // Al abrir, parte de lo guardado (descarta lo que se marcó y se canceló)
    <Dialog onOpenChange={(open) => open && setSelected(new Set(type.allowedTaskTypeIds))}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Tipos de tarea que admite">
          <ListChecks aria-hidden />
          {summary}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tareas que admite "{type.name}"</DialogTitle>
          <DialogDescription>
            Sin ninguno marcado, admite todos los tipos. Las tareas que ya existen no cambian.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          {choices.map((taskType) => (
            <label key={taskType.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(taskType.id)}
                onChange={() => toggle(taskType.id)}
                className="size-4 accent-primary"
              />
              {taskType.name}
              {taskType.expedited && (
                <Zap aria-label="Atención inmediata" className="size-3 text-warning-foreground" />
              )}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={save}>Guardar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Catálogo de tipos de tarea (HU-22): agregar, renombrar, atención inmediata, archivar */
export function TaskTypesCard({
  workspaceId,
  taskTypes,
  fields,
}: {
  workspaceId: string;
  taskTypes: TaskType[];
  /** Campos de detalle del espacio (HU-23) */
  fields: DetailField[];
}) {
  const create = useCreateTaskType(workspaceId);
  const [expedited, setExpedited] = useState(false);
  const form = useSchemaForm(createTaskTypeSchema, ['name'], (data, formEl) =>
    create.mutate(
      { ...data, expedited },
      {
        onSuccess: () => {
          toast.success(`Se agregó "${data.name}"`);
          formEl.reset();
          setExpedited(false);
        },
      },
    ),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de tarea</CardTitle>
        <CardDescription>
          Los de atención inmediata (como Fast track) se resaltan en dorado y van primero en su
          columna del tablero.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y rounded-md border">
          {taskTypes.map((taskType) => (
            <TaskTypeRow
              key={taskType.id}
              workspaceId={workspaceId}
              taskType={taskType}
              fields={fields}
            />
          ))}
        </ul>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={create.isPending} className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nuevo tipo de tarea</Label>
              <Input
                {...form.field('name')}
                maxLength={60}
                autoComplete="off"
                placeholder="Por ejemplo: Urgencia de seguridad"
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={expedited}
                onChange={(event) => setExpedited(event.target.checked)}
                className="size-4 accent-primary"
              />
              Atención inmediata
            </label>
            <FormActions
              submitLabel="Agregar tipo de tarea"
              isPending={create.isPending}
              error={create.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskTypeRow({
  workspaceId,
  taskType,
  fields,
}: {
  workspaceId: string;
  taskType: TaskType;
  fields: DetailField[];
}) {
  const update = useUpdateTaskType(workspaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(taskType.name);

  function save(changes: Parameters<typeof update.mutate>[0], message: string) {
    update.mutate(changes, {
      onSuccess: () => {
        toast.success(message);
        setEditing(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === taskType.name) return setEditing(false);
    save({ typeId: taskType.id, name: trimmed }, `Ahora se llama "${trimmed}"`);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <Input
            aria-label={`Nuevo nombre de ${taskType.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoFocus
            className="h-8 w-56"
          />
          <Button type="submit" size="sm" variant="ghost" aria-label="Guardar nombre">
            <Check aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Cancelar"
            onClick={() => {
              setName(taskType.name);
              setEditing(false);
            }}
          >
            <X aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold',
              taskTypeClass(taskType),
            )}
          >
            {taskType.expedited && <Zap aria-hidden className="size-3" />}
            {taskType.name}
          </span>
          {taskType.archived && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">Archivado</span>
          )}
          <span className="text-sm text-muted-foreground">
            {taskType.taskCount === 1 ? '1 tarea' : `${taskType.taskCount} tareas`}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={taskType.expedited}
            disabled={update.isPending}
            onChange={(event) =>
              save(
                { typeId: taskType.id, expedited: event.target.checked },
                event.target.checked
                  ? `"${taskType.name}" ahora es de atención inmediata`
                  : `"${taskType.name}" ya no es de atención inmediata`,
              )
            }
            className="size-4 accent-primary"
          />
          Atención inmediata
        </label>
        <DetailFieldsDialog
          workspaceId={workspaceId}
          owner={{ taskTypeId: taskType.id }}
          ownerName={taskType.name}
          fields={fields}
        />
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Renombrar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() =>
            save(
              { typeId: taskType.id, archived: !taskType.archived },
              taskType.archived
                ? `"${taskType.name}" se reactivó`
                : `"${taskType.name}" se archivó`,
            )
          }
        >
          {taskType.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {taskType.archived ? 'Reactivar' : 'Archivar'}
        </Button>
      </div>
    </li>
  );
}
