import { createTaskOriginSchema, type TaskOrigin } from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Check, Pencil, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  taskOriginsQueryOptions,
  useCreateTaskOrigin,
  useUpdateTaskOrigin,
} from '@/lib/task-origins';
import { useSchemaForm } from '@/lib/use-schema-form';

/** Catálogo de orígenes de tarea (HU-47): agregar, renombrar, archivar */
export function TaskOriginsCard({ workspaceId }: { workspaceId: string }) {
  const { data: origins = [], isPending } = useQuery(taskOriginsQueryOptions(workspaceId));
  const create = useCreateTaskOrigin(workspaceId);
  const form = useSchemaForm(createTaskOriginSchema, ['name'], (data, formEl) =>
    create.mutate(data, {
      onSuccess: () => {
        toast.success(`Se agregó "${data.name}"`);
        formEl.reset();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orígenes de tarea</CardTitle>
        <CardDescription>
          De dónde llega cada tarea (correo, junta, ticket…). En la tarea se elige uno y se anota su
          detalle, como el número de ticket.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : origins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay orígenes.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {origins.map((origin) => (
              <OriginRow key={origin.id} workspaceId={workspaceId} origin={origin} />
            ))}
          </ul>
        )}
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={create.isPending} className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nuevo origen</Label>
              <Input
                {...form.field('name')}
                maxLength={60}
                autoComplete="off"
                placeholder="Por ejemplo: WhatsApp"
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <FormActions
              submitLabel="Agregar origen"
              isPending={create.isPending}
              error={create.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function OriginRow({ workspaceId, origin }: { workspaceId: string; origin: TaskOrigin }) {
  const update = useUpdateTaskOrigin(workspaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(origin.name);

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
    if (trimmed === '' || trimmed === origin.name) return setEditing(false);
    save({ originId: origin.id, name: trimmed }, `Ahora se llama "${trimmed}"`);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <Input
            aria-label={`Nuevo nombre de ${origin.name}`}
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
              setName(origin.name);
              setEditing(false);
            }}
          >
            <X aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">{origin.name}</span>
          {origin.archived && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">Archivado</span>
          )}
          <span className="text-sm text-muted-foreground">
            {origin.taskCount === 1 ? '1 tarea' : `${origin.taskCount} tareas`}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
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
              { originId: origin.id, archived: !origin.archived },
              origin.archived ? `"${origin.name}" se reactivó` : `"${origin.name}" se archivó`,
            )
          }
          title={
            origin.archived
              ? 'Volver a ofrecerlo en las tareas'
              : 'Deja de ofrecerse; las tareas que lo tienen lo conservan'
          }
        >
          {origin.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {origin.archived ? 'Reactivar' : 'Archivar'}
        </Button>
      </div>
    </li>
  );
}
