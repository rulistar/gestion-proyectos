import {
  createInvitationRequestSchema,
  INVITATION_TTL_HOURS,
  roleHasPermission,
  type MembershipRole,
} from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  invitationLink,
  invitationsQueryOptions,
  useCreateInvitation,
  useRevokeInvitation,
} from '@/lib/invitations';
import { useSchemaForm } from '@/lib/use-schema-form';
import { membersQueryOptions, ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/miembros');

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Miembros del workspace; el Admin además invita y gestiona las invitaciones (HU-04) */
export function MembersPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));
  const canManage = roleHasPermission(workspace.role, 'member.manage');

  return (
    <div className="grid gap-4">
      <div>
        <Link
          to="/w/$workspaceId"
          params={{ workspaceId }}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {workspace.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Miembros</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>{members.length} en este espacio de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <span className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {canManage && (
        <>
          <InviteCard workspaceId={workspaceId} />
          <PendingInvitationsCard workspaceId={workspaceId} />
        </>
      )}
    </div>
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
