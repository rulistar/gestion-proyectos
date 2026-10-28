import {
  createProjectTypeSchema,
  roleHasPermission,
  type ProjectBehavior,
  type ProjectType,
  type TaskType,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Check, Pencil, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { TaskOriginsCard } from '@/components/task-origin-catalog';
import { AllowedTaskTypesDialog, TaskTypesCard } from '@/components/task-type-catalog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  BEHAVIOR_LABELS,
  projectTypesQueryOptions,
  SECTIONS,
  useCreateProjectType,
  useUpdateProjectType,
} from '@/lib/project-types';
import { taskTypesQueryOptions } from '@/lib/task-types';
import { useSchemaForm } from '@/lib/use-schema-form';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/configuracion');

const BEHAVIORS = Object.keys(BEHAVIOR_LABELS) as ProjectBehavior[];

/** Configuración del espacio (HU-21): tipos de contenedor. Solo para el Admin (`catalog.manage`) */
export function CatalogPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(projectTypesQueryOptions(workspaceId));
  const { data: taskTypes } = useSuspenseQuery(taskTypesQueryOptions(workspaceId));

  if (!roleHasPermission(workspace.role, 'catalog.manage')) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin</CardTitle>
          <CardDescription>La configuración la gestiona el Admin de este espacio.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="text-sm font-medium">
            Volver a los proyectos
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Configuración"
        description={`Tipos de trabajo de ${workspace.name}. El nombre es libre; el comportamiento decide qué se mide y en qué sección del menú aparece.`}
      />

      {BEHAVIORS.map((behavior) => {
        const group = types.filter((type) => type.behavior === behavior);
        return (
          <Card key={behavior}>
            <CardHeader>
              <CardTitle>
                {SECTIONS[behavior].title} · {BEHAVIOR_LABELS[behavior].label}
              </CardTitle>
              <CardDescription>{BEHAVIOR_LABELS[behavior].hint}</CardDescription>
            </CardHeader>
            <CardContent>
              {group.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin tipos con este comportamiento.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {group.map((type) => (
                    <TypeRow
                      key={type.id}
                      workspaceId={workspaceId}
                      type={type}
                      taskTypes={taskTypes}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}

      <NewTypeCard workspaceId={workspaceId} />
      <TaskTypesCard workspaceId={workspaceId} taskTypes={taskTypes} />
      <TaskOriginsCard workspaceId={workspaceId} />
    </div>
  );
}

function TypeRow({
  workspaceId,
  type,
  taskTypes,
}: {
  workspaceId: string;
  type: ProjectType;
  taskTypes: TaskType[];
}) {
  const update = useUpdateProjectType(workspaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);

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
    if (name.trim() === '' || name.trim() === type.name) return setEditing(false);
    save({ typeId: type.id, name: name.trim() }, `Ahora se llama "${name.trim()}"`);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <Input
            aria-label={`Nuevo nombre de ${type.name}`}
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
              setName(type.name);
              setEditing(false);
            }}
          >
            <X aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="min-w-0">
          <p className={type.archived ? 'font-medium text-muted-foreground' : 'font-medium'}>
            {type.name}
            {type.archived && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                Archivado
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {type.projectCount === 1 ? '1 en uso' : `${type.projectCount} en uso`}
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Comportamiento de ${type.name}`}
          value={type.behavior}
          disabled={update.isPending}
          onChange={(event) =>
            save(
              { typeId: type.id, behavior: event.target.value as ProjectBehavior },
              `"${type.name}" ahora está en ${SECTIONS[event.target.value as ProjectBehavior].title}`,
            )
          }
          className="h-8 w-40"
        >
          {BEHAVIORS.map((behavior) => (
            <option key={behavior} value={behavior}>
              {BEHAVIOR_LABELS[behavior].label}
            </option>
          ))}
        </NativeSelect>
        <AllowedTaskTypesDialog workspaceId={workspaceId} type={type} taskTypes={taskTypes} />
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
              { typeId: type.id, archived: !type.archived },
              type.archived ? `"${type.name}" se reactivó` : `"${type.name}" se archivó`,
            )
          }
          title={
            type.archived
              ? 'Volver a ofrecerlo al crear'
              : 'Deja de ofrecerse al crear; lo existente lo conserva'
          }
        >
          {type.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {type.archived ? 'Reactivar' : 'Archivar'}
        </Button>
      </div>
    </li>
  );
}

function NewTypeCard({ workspaceId }: { workspaceId: string }) {
  const create = useCreateProjectType(workspaceId);
  const form = useSchemaForm(createProjectTypeSchema, ['name', 'behavior'], (data, formEl) =>
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
        <CardTitle>Nuevo tipo</CardTitle>
        <CardDescription>
          Por ejemplo "Mtto preventivo" (Continuo) o "Auditoría" (Con fin).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={create.isPending} className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input {...form.field('name')} maxLength={60} autoComplete="off" />
              <FieldError {...form.errorProps('name')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('behavior')}>Comportamiento</Label>
              <NativeSelect {...form.field('behavior')} defaultValue="ONGOING">
                {BEHAVIORS.map((behavior) => (
                  <option key={behavior} value={behavior}>
                    {BEHAVIOR_LABELS[behavior].label}
                  </option>
                ))}
              </NativeSelect>
              <FieldError {...form.errorProps('behavior')} />
            </div>
            <FormActions
              submitLabel="Agregar tipo"
              isPending={create.isPending}
              error={create.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
