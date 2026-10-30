import {
  createInvitationRequestSchema,
  INVITATION_TTL_HOURS,
  roleHasPermission,
  type Member,
  type MembershipRole,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { ShieldCheck, UserMinus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CopyLinkBox } from '@/components/copy-link-box';
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
import {
  invitationLink,
  invitationsQueryOptions,
  useCreateInvitation,
  useRevokeInvitation,
} from '@/lib/invitations';
import { useCurrentUser } from '@/lib/auth';
import { initials } from '@/lib/brand';
import { templateMatrix, type MatrixValue } from '@/lib/matrix';
import { useSchemaForm } from '@/lib/use-schema-form';
import { MatrixEditor, MatrixHint, PermissionsDialog } from '@/components/permissions-dialog';
import {
  membersQueryOptions,
  ROLE_LABELS,
  roleLabel,
  useChangeMemberRole,
  useRemoveMember,
  workspaceQueryOptions,
} from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/miembros');

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Miembros del workspace, invitar y gestionar invitaciones (HU-04). Solo para el Admin del espacio */
export function MembersPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));
  const canManage = roleHasPermission(workspace.role, 'member.manage');

  // Decisión del PO: solo el Admin ve la página de miembros (la API además oculta los correos)
  if (!canManage) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin</CardTitle>
          <CardDescription>
            La lista de miembros e invitaciones la gestiona el Admin de este espacio de trabajo.
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

  return (
    <div className="grid gap-3">
      <PageHeader title="Miembros" description={workspace.name} />

      <Card>
        <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle>Miembros</CardTitle>
          <CardDescription>{members.length} en este espacio de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {members.map((member) => (
              <MemberRow key={member.userId} workspaceId={workspaceId} member={member} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <InviteCard workspaceId={workspaceId} workspaceName={workspace.name} />
      <PendingInvitationsCard workspaceId={workspaceId} />
    </div>
  );
}

/** Un miembro: cambiar su rol o quitarlo del espacio (HU-25). La API impide dejar el espacio sin Admin */
function MemberRow({ workspaceId, member }: { workspaceId: string; member: Member }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const changeRole = useChangeMemberRole(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const isMe = member.userId === me.id;

  function handleRoleChange(role: MembershipRole) {
    changeRole.mutate(
      { userId: member.userId, role },
      {
        // Cambiar la plantilla descarta los ajustes de la matriz (ADR-0006 §2)
        onSuccess: () =>
          toast.success(`${member.name} ahora es ${ROLE_LABELS[role]}, con permisos de plantilla`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleRemove() {
    remove.mutate(member.userId, {
      onSuccess: () => {
        toast.success(`${member.name} ya no es miembro del espacio`);
        // Si me quité a mí mismo, ya no tengo acceso a este espacio
        if (isMe) void navigate({ to: '/' });
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
        >
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            {member.name}
            {isMe && <span className="ml-1.5 text-sm font-normal text-muted-foreground">(tú)</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {member.email}
            {member.matrix && member.role !== 'ADMIN' && (
              <span className="ml-1.5">· {roleLabel(member.role, member.matrix.permissions)}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Rol de ${member.name}`}
          value={member.role}
          disabled={changeRole.isPending}
          onChange={(event) => handleRoleChange(event.target.value as MembershipRole)}
          className="h-9 w-36"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        {member.matrix && (
          <PermissionsDialog
            workspaceId={workspaceId}
            member={{ ...member, matrix: member.matrix }}
          />
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" aria-label={`Quitar a ${member.name}`}>
              <UserMinus aria-hidden />
              Quitar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Quitar a {member.name} del espacio?</DialogTitle>
              <DialogDescription>
                Perderá el acceso de inmediato. Sus tareas conservan su nombre, marcadas como "ya no
                es miembro", hasta que las reasignes. Puedes volver a invitarlo cuando quieras.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Mantener</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={handleRemove}>
                  Quitar del espacio
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  );
}

/** Un espacio de la invitación con lo que recibirá en él (HU-17c) */
interface GrantDraft {
  workspaceId: string;
  name: string;
  value: MatrixValue;
}

/**
 * Invitar (HU-04) a este espacio y, si se quiere, a otros donde también soy Admin (HU-17c), cada
 * uno con su plantilla y sus permisos
 */
function InviteCard({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const me = useCurrentUser();
  const createInvitation = useCreateInvitation(workspaceId);
  const [link, setLink] = useState<{ email: string; url: string }>();
  const initialGrants = (): GrantDraft[] => [
    { workspaceId, name: workspaceName, value: templateMatrix('MEMBER') },
  ];
  const [grants, setGrants] = useState<GrantDraft[]>(initialGrants);
  // Otros espacios donde soy Admin y que aún no están en la invitación
  const addable = me.workspaces.filter(
    (w) => w.role === 'ADMIN' && !grants.some((grant) => grant.workspaceId === w.id),
  );
  const form = useSchemaForm(
    createInvitationRequestSchema.pick({ email: true }),
    ['email'],
    ({ email }, formEl) => {
      const [first, ...others] = grants.map((grant) => ({
        workspaceId: grant.workspaceId,
        role: grant.value.role,
        permissions: grant.value.permissions,
        selectedProjectIds: [...grant.value.selected],
      }));
      createInvitation.mutate(
        {
          email,
          role: first!.role,
          permissions: first!.permissions,
          selectedProjectIds: first!.selectedProjectIds,
          otherWorkspaces: others,
        },
        {
          onSuccess: ({ invitation, token }) => {
            setLink({ email: invitation.email, url: invitationLink(token) });
            formEl.reset();
            setGrants(initialGrants());
          },
        },
      );
    },
  );

  function updateGrant(index: number, value: MatrixValue) {
    setGrants((current) => current.map((grant, i) => (i === index ? { ...grant, value } : grant)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar a alguien</CardTitle>
        <CardDescription>
          Se genera un enlace de un solo uso, válido {INVITATION_TTL_HOURS} horas. Envíalo tú por
          correo, WhatsApp o el medio que prefieras. Puede entrar a varios espacios a la vez, con
          permisos distintos en cada uno.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={createInvitation.isPending} className="grid gap-4">
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor={form.idOf('email')}>Correo</Label>
              <Input {...form.field('email')} type="email" autoComplete="off" />
              <FieldError {...form.errorProps('email')} />
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Espacios y permisos</span>
              <ul className="divide-y rounded-md border">
                {grants.map((grant, index) => (
                  <li
                    key={grant.workspaceId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{grant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(grant.value.role, grant.value.permissions)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <NativeSelect
                        aria-label={`Plantilla en ${grant.name}`}
                        value={grant.value.role}
                        onChange={(event) =>
                          updateGrant(index, templateMatrix(event.target.value as MembershipRole))
                        }
                        className="h-8 w-32"
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </NativeSelect>
                      <GrantPermissionsDialog
                        grant={grant}
                        onSave={(value) => updateGrant(index, value)}
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Quitar ${grant.name} de la invitación`}
                          onClick={() =>
                            setGrants((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <X aria-hidden />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {addable.length > 0 && (
                <NativeSelect
                  aria-label="Agregar otro espacio"
                  value=""
                  onChange={(event) => {
                    const added = addable.find((w) => w.id === event.target.value);
                    if (added) {
                      setGrants((current) => [
                        ...current,
                        {
                          workspaceId: added.id,
                          name: added.name,
                          value: templateMatrix('MEMBER'),
                        },
                      ]);
                    }
                  }}
                  className="h-8 w-64"
                >
                  <option value="">+ Agregar otro espacio…</option>
                  {addable.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>

            <FormActions
              submitLabel="Generar enlace"
              isPending={createInvitation.isPending}
              error={createInvitation.error?.message}
            />
          </fieldset>
        </form>

        {link && (
          <CopyLinkBox url={link.url} label="Enlace de invitación">
            Enlace para <strong>{link.email}</strong>.
          </CopyLinkBox>
        )}
      </CardContent>
    </Card>
  );
}

/** Ajustar la matriz de un espacio de la invitación; se aplica al guardar (o se descarta) */
function GrantPermissionsDialog({
  grant,
  onSave,
}: {
  grant: GrantDraft;
  onSave: (value: MatrixValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(grant.value);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Al abrir, parte de lo que ya tiene la invitación
        if (next) setDraft(grant.value);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={`Permisos en ${grant.name}`}>
          <ShieldCheck aria-hidden />
          Permisos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Permisos en {grant.name}</DialogTitle>
          <MatrixHint />
        </DialogHeader>
        <MatrixEditor workspaceId={grant.workspaceId} value={draft} onChange={setDraft} />
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" onClick={() => onSave(draft)}>
              Aplicar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendingInvitationsCard({ workspaceId }: { workspaceId: string }) {
  const { data: invitations = [] } = useQuery(invitationsQueryOptions(workspaceId));
  const revoke = useRevokeInvitation(workspaceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones pendientes</CardTitle>
        <CardDescription>
          {invitations.length === 0
            ? 'No hay invitaciones pendientes'
            : 'Si un enlace se perdió o se envió por error, revócalo y genera otro'}
        </CardDescription>
      </CardHeader>
      {invitations.length > 0 && (
        <CardContent className="grid gap-2">
          <ul className="divide-y rounded-md border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.workspaces.length > 1
                      ? invitation.workspaces
                          .map((w) => `${w.name} (${ROLE_LABELS[w.role]})`)
                          .join(', ')
                      : ROLE_LABELS[invitation.role]}{' '}
                    · caduca el {dateTimeFormat.format(new Date(invitation.expiresAt))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(invitation.id)}
                >
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
          {revoke.error && (
            <p role="alert" className="text-sm text-destructive">
              {revoke.error.message}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
