import {
  createInvitationRequestSchema,
  INVITATION_TTL_HOURS,
  roleHasPermission,
  type Member,
  type MembershipRole,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { useSchemaForm } from '@/lib/use-schema-form';
import {
  membersQueryOptions,
  ROLE_LABELS,
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
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Miembros</h1>
        <p className="mt-1 text-muted-foreground">{workspace.name}</p>
      </div>

      <Card>
        <CardHeader>
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

      <InviteCard workspaceId={workspaceId} />
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
        onSuccess: () => toast.success(`${member.name} ahora es ${ROLE_LABELS[role]}`),
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
          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
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

function InviteCard({ workspaceId }: { workspaceId: string }) {
  const createInvitation = useCreateInvitation(workspaceId);
  const [link, setLink] = useState<{ email: string; url: string }>();
  const form = useSchemaForm(createInvitationRequestSchema, ['email', 'role'], (data, formEl) =>
    createInvitation.mutate(data, {
      onSuccess: ({ invitation, token }) => {
        setLink({ email: invitation.email, url: invitationLink(token) });
        formEl.reset();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar a alguien</CardTitle>
        <CardDescription>
          Se genera un enlace de un solo uso, válido {INVITATION_TTL_HOURS} horas. Envíalo tú por
          correo, WhatsApp o el medio que prefieras.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset
            disabled={createInvitation.isPending}
            className="grid gap-4 sm:grid-cols-[1fr_12rem]"
          >
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('email')}>Correo</Label>
              <Input {...form.field('email')} type="email" autoComplete="off" />
              <FieldError {...form.errorProps('email')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('role')}>Rol</Label>
              <NativeSelect
                {...form.field('role')}
                defaultValue={'MEMBER' satisfies MembershipRole}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <FieldError {...form.errorProps('role')} />
            </div>
            <FormActions
              submitLabel="Generar enlace"
              isPending={createInvitation.isPending}
              error={createInvitation.error?.message}
            />
          </fieldset>
        </form>

        {link && <InvitationLinkBox email={link.email} url={link.url} />}
      </CardContent>
    </Card>
  );
}

/** El enlace solo se puede ver ahora: la API no lo guarda (solo su hash) */
function InvitationLinkBox({ email, url }: { email: string; url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  return (
    <div role="status" className="grid gap-2 rounded-md border border-dashed bg-muted/50 p-4">
      <p className="text-sm">
        Enlace para <strong>{email}</strong>. <strong>Cópialo ahora</strong>: por seguridad no se
        vuelve a mostrar.
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Enlace de invitación"
          onFocus={(e) => e.target.select()}
        />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
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
                    {ROLE_LABELS[invitation.role]} · caduca el{' '}
                    {dateTimeFormat.format(new Date(invitation.expiresAt))}
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
