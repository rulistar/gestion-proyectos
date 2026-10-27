import { createPersonSchema, roleHasPermission, type Member, type Person } from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Check, Pencil, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { initials } from '@/lib/brand';
import { peopleQueryOptions, useCreatePerson, useUpdatePerson } from '@/lib/people';
import { useSchemaForm } from '@/lib/use-schema-form';
import { membersQueryOptions, workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/personas');

/** Catálogo de personas del espacio (HU-34, ADR-0005). Solo para el Admin (`member.manage`) */
export function PeoplePage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: people } = useSuspenseQuery(peopleQueryOptions(workspaceId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));

  if (!roleHasPermission(workspace.role, 'member.manage')) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin</CardTitle>
          <CardDescription>
            El catálogo de personas lo gestiona el Admin del espacio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="text-sm font-medium">
            Volver a los proyectos
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Un usuario se vincula a una sola persona: se ofrecen los que aún no tienen
  const linkedUsers = new Set(people.map((person) => person.userId).filter(Boolean));
  const active = people.filter((person) => !person.archived);
  const archived = people.filter((person) => person.archived);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personas</h1>
        <p className="mt-1 text-muted-foreground">
          Las personas de {workspace.name}, tengan o no cuenta. El nombre que pongas aquí es el que
          se ve en tareas y proyectos: si vinculas a "adminrul" con "Rodrigo", se verá "Rodrigo".
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>{active.length} activas</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {[...active, ...archived].map((person) => (
              <PersonRow
                key={person.id}
                workspaceId={workspaceId}
                person={person}
                members={members.filter(
                  (m) => m.userId === person.userId || !linkedUsers.has(m.userId),
                )}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <NewPersonCard workspaceId={workspaceId} />
    </div>
  );
}

function PersonRow({
  workspaceId,
  person,
  members,
}: {
  workspaceId: string;
  person: Person;
  /** Miembros que se le pueden vincular (sin persona, o el que ya tiene) */
  members: Member[];
}) {
  const update = useUpdatePerson(workspaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);

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
    if (trimmed === '' || trimmed === person.name) return setEditing(false);
    save({ personId: person.id, name: trimmed }, `Ahora se llama "${trimmed}"`);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
        >
          {initials(person.name)}
        </span>
        {editing ? (
          <form onSubmit={handleRename} className="flex items-center gap-2">
            <Input
              aria-label={`Nuevo nombre de ${person.name}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
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
                setName(person.name);
                setEditing(false);
              }}
            >
              <X aria-hidden />
            </Button>
          </form>
        ) : (
          <div className="min-w-0">
            <p className={person.archived ? 'font-medium text-muted-foreground' : 'font-medium'}>
              {person.name}
              {person.archived && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  Archivada
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {person.userId === null
                ? 'Sin cuenta'
                : person.hasAccess
                  ? `Cuenta: ${person.userName}`
                  : `Cuenta: ${person.userName} · sin acceso al espacio`}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Usuario vinculado a ${person.name}`}
          value={person.userId ?? ''}
          disabled={update.isPending}
          onChange={(event) => {
            const userId = event.target.value || null;
            save(
              { personId: person.id, userId },
              userId ? `"${person.name}" quedó vinculada` : `"${person.name}" ya no tiene cuenta`,
            );
          }}
          className="h-8 w-52"
        >
          <option value="">Sin cuenta</option>
          {/* La cuenta vinculada sin acceso ya no está entre los miembros: se muestra igual */}
          {person.userId && !members.some((m) => m.userId === person.userId) && (
            <option value={person.userId}>{person.userName} (sin acceso)</option>
          )}
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.email ?? member.name}
            </option>
          ))}
        </NativeSelect>
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
              { personId: person.id, archived: !person.archived },
              person.archived ? `"${person.name}" se reactivó` : `"${person.name}" se archivó`,
            )
          }
          title={
            person.archived
              ? 'Volver a ofrecerla al asignar'
              : 'Deja de ofrecerse al asignar; lo existente la conserva'
          }
        >
          {person.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {person.archived ? 'Reactivar' : 'Archivar'}
        </Button>
      </div>
    </li>
  );
}

function NewPersonCard({ workspaceId }: { workspaceId: string }) {
  const create = useCreatePerson(workspaceId);
  const form = useSchemaForm(createPersonSchema, ['name'], (data, formEl) =>
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
        <CardTitle>Nueva persona</CardTitle>
        <CardDescription>
          Por ejemplo, un solicitante o un Business partner que no usa el sistema. Si después recibe
          una cuenta, vincúlala aquí.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={create.isPending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input {...form.field('name')} maxLength={120} autoComplete="off" />
              <FieldError {...form.errorProps('name')} />
            </div>
            <FormActions
              submitLabel="Agregar persona"
              isPending={create.isPending}
              error={create.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
