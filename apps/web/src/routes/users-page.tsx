import { changeUserEmailSchema, type SystemUser } from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Mail, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldError } from '@/components/field-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/lib/auth';
import { useSchemaForm } from '@/lib/use-schema-form';
import { useChangeUserEmail, usersQueryOptions, useSetUserStatus } from '@/lib/users';
import { ROLE_LABELS } from '@/lib/workspaces';

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Usuarios del sistema (HU-30): solo el Admin del sistema. Corrige correos y desactiva cuentas;
 * el Admin de un espacio no cambia correos (quita al miembro e invita el correo correcto).
 */
export function UsersPage() {
  const me = useCurrentUser();
  // Solo se pide si es el Admin del sistema (la API también lo exige)
  const { data: users = [], isPending } = useQuery({
    ...usersQueryOptions,
    enabled: me.isSystemAdmin,
  });

  if (!me.isSystemAdmin) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin del sistema</CardTitle>
          <CardDescription>
            Si un correo está mal, el Admin de tu espacio puede quitar al miembro e invitar el
            correo correcto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="text-sm font-medium">
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Usuarios del sistema"
        description="Todas las cuentas. Cambiar el correo o desactivar una cuenta cierra sus sesiones; una cuenta desactivada no puede entrar, pero sus tareas y su persona se conservan."
      />
      <Card>
        <CardContent className="pt-6">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {users.map((user) => (
                <UserRow key={user.id} user={user} isMe={user.id === me.id} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user, isMe }: { user: SystemUser; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const setStatus = useSetUserStatus();
  const disabled = user.status === 'DISABLED';

  function changeStatus(status: SystemUser['status']) {
    setStatus.mutate(
      { userId: user.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === 'DISABLED' ? `${user.name} ya no puede entrar` : `${user.name} puede entrar`,
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={disabled ? 'font-medium text-muted-foreground' : 'font-medium'}>
            {user.name}
            {user.isSystemAdmin && (
              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                Admin del sistema
              </span>
            )}
            {disabled && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                Desactivada
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {user.workspaces.length === 0
              ? 'Sin espacios'
              : user.workspaces.map((w) => `${w.name} (${ROLE_LABELS[w.role]})`).join(' · ')}
            {' · '}
            {user.lastLoginAt
              ? `Último acceso: ${dateTimeFormat.format(new Date(user.lastLoginAt))}`
              : 'Nunca ha entrado'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Mail aria-hidden />
              Cambiar correo
            </Button>
          )}
          {disabled ? (
            <Button
              size="sm"
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => changeStatus('ACTIVE')}
            >
              <UserCheck aria-hidden />
              Reactivar
            </Button>
          ) : (
            !isMe && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" disabled={setStatus.isPending}>
                    <UserX aria-hidden />
                    Desactivar
                  </Button>
                }
                title={`¿Desactivar la cuenta de ${user.name}?`}
                description="Se cierran sus sesiones y ya no podrá entrar. Sus tareas y su persona en cada espacio se conservan; puedes reactivarla cuando quieras."
                confirmLabel="Desactivar"
                onConfirm={() => changeStatus('DISABLED')}
              />
            )
          )}
        </div>
      </div>
      {editing && <EmailForm user={user} onDone={() => setEditing(false)} />}
    </li>
  );
}

function EmailForm({ user, onDone }: { user: SystemUser; onDone: () => void }) {
  const change = useChangeUserEmail();
  const form = useSchemaForm(changeUserEmailSchema, ['email'], (data) =>
    change.mutate(
      { userId: user.id, ...data },
      {
        onSuccess: () => {
          toast.success(`${user.name} ahora entra con ${data.email}`);
          onDone();
        },
      },
    ),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          {...form.field('email')}
          aria-label={`Correo nuevo de ${user.name}`}
          type="email"
          defaultValue={user.email}
          autoFocus
          className="h-8 w-72"
        />
        <Button type="submit" size="sm" disabled={change.isPending}>
          {change.isPending ? 'Guardando…' : 'Guardar correo'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      <FieldError {...form.errorProps('email')} />
      {change.error && (
        <p role="alert" className="text-sm text-destructive">
          {change.error.message}
        </p>
      )}
    </form>
  );
}
