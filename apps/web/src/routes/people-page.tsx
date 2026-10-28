import {
  canDeletePerson,
  createPersonSchema,
  roleHasPermission,
  type Member,
  type Person,
  type ProjectPersonRole,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
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
import { NativeSelect } from '@/components/ui/native-select';
import { initials } from '@/lib/brand';
import {
  peopleQueryOptions,
  personUsageQueryOptions,
  useCreatePerson,
  useDeletePerson,
  useUpdatePerson,
} from '@/lib/people';
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
  // Las archivadas se ocultan por defecto para que no estorben (HU-44)
  const [showArchived, setShowArchived] = useState(false);

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
    <div className="grid gap-3">
      <PageHeader
        title="Personas"
        description={`Las personas de ${workspace.name}, tengan o no cuenta. El nombre que pongas aquí es el que se ve en tareas y proyectos: si vinculas a "adminrul" con "Rodrigo", se verá "Rodrigo".`}
      />

      <Card>
        <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle>Catálogo</CardTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CardDescription>{active.length} activas</CardDescription>
            {archived.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Mostrar archivadas ({archived.length})
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {[...active, ...(showArchived ? archived : [])].map((person) => (
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
          // La cuenta vinculada no se repite aquí: ya la muestra el combo de la derecha
          <div className="min-w-0">
            <p className={person.archived ? 'font-medium text-muted-foreground' : 'font-medium'}>
              {person.name}
              {person.archived && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  Archivada
                </span>
              )}
            </p>
            {/* En las archivadas, a la vista: por qué no se puede borrar (o que sí se puede) */}
            {person.archived &&
              (person.taskCount > 0 || person.projectCount > 0 ? (
                // Clic: dónde aparece, para ir a reasignarla (HU-45)
                <PersonUsageDialog workspaceId={workspaceId} person={person} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {whyNotDeletable(person) ?? 'Sin uso: se puede borrar'}
                </p>
              ))}
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
        {person.archived && <DeletePersonButton workspaceId={workspaceId} person={person} />}
      </div>
    </li>
  );
}

/** Por qué no se puede borrar (HU-44); null si sí se puede */
function whyNotDeletable(person: Person): string | null {
  if (canDeletePerson(person)) return null;
  if (person.hasAccess) return 'Su cuenta sigue siendo miembro del espacio: quítala en Miembros';
  const uses = [
    person.taskCount > 0 && `${person.taskCount} tarea(s)`,
    person.projectCount > 0 && `${person.projectCount} proyecto(s)`,
  ].filter(Boolean);
  return `Aparece en ${uses.join(' y ')} (papelera incluida): reasígnalas primero`;
}

/** Borrar definitivamente una persona archivada que nadie usa (HU-44) */
function DeletePersonButton({ workspaceId, person }: { workspaceId: string; person: Person }) {
  const remove = useDeletePerson(workspaceId);
  const reason = whyNotDeletable(person);

  if (reason) {
    return (
      // El span recibe el title: un botón deshabilitado no muestra el aviso
      <span title={reason}>
        <Button
          size="sm"
          variant="ghost"
          disabled
          aria-label={`Borrar a ${person.name}: ${reason}`}
        >
          <Trash2 aria-hidden />
          Borrar
        </Button>
      </span>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Borrar definitivamente a ${person.name}`}>
          <Trash2 aria-hidden />
          Borrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Borrar definitivamente a {person.name}?</DialogTitle>
          <DialogDescription>
            No aparece en ninguna tarea ni proyecto. Se quita del catálogo y no se puede deshacer;
            si la necesitas después, tendrás que darla de alta otra vez.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Conservar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={() =>
                remove.mutate(person.id, {
                  onSuccess: () => toast.success(`"${person.name}" se borró`),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Borrar definitivamente
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
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

const PROJECT_ROLE_LABELS: Record<ProjectPersonRole, string> = {
  requester: 'Solicitante',
  assignedTo: 'Asignado a',
  projectManager: 'Project manager',
  consultingManager: 'Gte. Consultoría',
  businessPartner: 'Business partner',
};

/** Dónde aparece una persona (HU-45): sus tareas y proyectos, con enlace para reasignarla */
function PersonUsageDialog({ workspaceId, person }: { workspaceId: string; person: Person }) {
  const [open, setOpen] = useState(false);
  const { data: usage, isPending } = useQuery({
    ...personUsageQueryOptions(workspaceId, person.id),
    enabled: open,
  });

  const inTrash = (
    <Link
      to="/w/$workspaceId/papelera"
      params={{ workspaceId }}
      className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold hover:underline"
    >
      En la papelera
    </Link>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left text-xs text-primary underline-offset-2 hover:underline"
        >
          {whyNotDeletable(person)} · Ver dónde
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Dónde aparece {person.name}</DialogTitle>
          <DialogDescription>
            Abre cada proyecto para reasignar sus tareas o roles. Lo que está en la papelera también
            cuenta: restáuralo y reasígnalo, o bórralo definitivamente.
          </DialogDescription>
        </DialogHeader>
        {isPending || !usage ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid gap-4">
            {usage.tasks.length > 0 && (
              <section className="grid gap-1.5">
                <h3 className="text-sm font-semibold">
                  Responsable de {usage.tasks.length} tarea(s)
                </h3>
                <ul className="divide-y rounded-md border text-sm">
                  {usage.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>
                      </div>
                      {task.deleted ? (
                        inTrash
                      ) : (
                        <Link
                          to="/w/$workspaceId/p/$projectId"
                          params={{ workspaceId, projectId: task.projectId }}
                          className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline"
                        >
                          Abrir
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {usage.projects.length > 0 && (
              <section className="grid gap-1.5">
                <h3 className="text-sm font-semibold">
                  Con un rol en {usage.projects.length} proyecto(s)
                </h3>
                <ul className="divide-y rounded-md border text-sm">
                  {usage.projects.map((project) => (
                    <li key={project.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {project.folio && (
                            <span className="text-muted-foreground">{project.folio} · </span>
                          )}
                          {project.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.roles.map((role) => PROJECT_ROLE_LABELS[role]).join(', ')}
                        </p>
                      </div>
                      {project.deleted ? (
                        inTrash
                      ) : (
                        <Link
                          to="/w/$workspaceId/p/$projectId"
                          params={{ workspaceId, projectId: project.id }}
                          className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline"
                        >
                          Abrir
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
