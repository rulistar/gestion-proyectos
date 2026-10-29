import {
  loginRequestSchema,
  PASSWORD_MIN_LENGTH,
  registerFromInvitationRequestSchema,
  type InvitationPreview,
} from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { meQueryOptions, useLogin, useLogout } from '@/lib/auth';
import {
  invitationPreviewQueryOptions,
  useAcceptInvitation,
  useRegisterFromInvitation,
} from '@/lib/invitations';
import { useSchemaForm } from '@/lib/use-schema-form';
import { ROLE_LABELS } from '@/lib/workspaces';

/**
 * Aceptar una invitación (HU-01). El token viene después de "#" en el enlace: esa parte de la URL
 * no llega al servidor web. Se lee una vez al abrir la página.
 */
export function InvitationPage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const preview = useQuery({ ...invitationPreviewQueryOptions(token), enabled: token !== '' });
  const me = useQuery(meQueryOptions);
  const navigate = useNavigate();

  /** Ya es miembro: al workspace, reemplazando la URL (el enlace no queda en el historial) */
  function goToWorkspace({ workspaceId }: { workspaceId: string }) {
    void navigate({ to: '/w/$workspaceId', params: { workspaceId }, replace: true });
  }

  if (token === '' || preview.isError) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-sm text-muted-foreground">
          {preview.error?.message ??
            'El enlace está incompleto. Ábrelo de nuevo desde el mensaje que te enviaron.'}
        </p>
      </Shell>
    );
  }
  if (!preview.data || me.isPending) {
    return <Shell title="Cargando invitación…" />;
  }

  const invitation = preview.data;
  // Una invitación puede incluir varios espacios, cada uno con su rol (HU-17c)
  const intro =
    invitation.workspaces.length > 1 ? (
      <>
        Te invitan a {invitation.workspaces.length} espacios:{' '}
        {invitation.workspaces.map((workspace, index) => (
          <span key={workspace.name}>
            {index > 0 && ', '}
            <strong>{workspace.name}</strong> como {ROLE_LABELS[workspace.role]}
          </span>
        ))}
        .
      </>
    ) : (
      <>
        Te invitan a <strong>{invitation.workspaceName}</strong> como{' '}
        <strong>{ROLE_LABELS[invitation.role]}</strong>.
      </>
    );

  if (!invitation.hasAccount) {
    return (
      <Shell title="Crea tu cuenta" description={intro}>
        <RegisterForm token={token} invitation={invitation} onAccepted={goToWorkspace} />
      </Shell>
    );
  }
  if (me.data && me.data.email !== invitation.email) {
    return (
      <Shell title="Invitación para otra cuenta" description={intro}>
        <WrongAccount currentEmail={me.data.email} invitedEmail={invitation.email} />
      </Shell>
    );
  }
  return (
    <Shell title="Aceptar invitación" description={intro}>
      {me.data ? (
        <AcceptButton token={token} onAccepted={goToWorkspace} />
      ) : (
        <LoginAndAccept token={token} email={invitation.email} onAccepted={goToWorkspace} />
      )}
    </Shell>
  );
}

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </main>
  );
}

interface AcceptProps {
  token: string;
  onAccepted: (result: { workspaceId: string }) => void;
}

/** No tiene cuenta: nombre y contraseña (dos veces, para evitar errores de tecleo) */
function RegisterForm({
  token,
  invitation,
  onAccepted,
}: AcceptProps & { invitation: InvitationPreview }) {
  const register = useRegisterFromInvitation();
  const [confirmError, setConfirmError] = useState<string>();
  const form = useSchemaForm(
    registerFromInvitationRequestSchema,
    ['token', 'name', 'password'],
    (data, formEl) => {
      if (new FormData(formEl).get('confirm') !== data.password) {
        setConfirmError('Las contraseñas no coinciden');
        return;
      }
      setConfirmError(undefined);
      register.mutate(data, { onSuccess: onAccepted });
    },
  );

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={register.isPending} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <div className="grid gap-2">
          <Label htmlFor="invited-email">Correo</Label>
          <Input id="invited-email" value={invitation.email} readOnly autoComplete="username" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('name')}>Tu nombre</Label>
          <Input {...form.field('name')} autoComplete="name" autoFocus />
          <FieldError {...form.errorProps('name')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('password')}>Contraseña</Label>
          <Input {...form.field('password')} type="password" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">
            Mínimo {PASSWORD_MIN_LENGTH} caracteres. Una frase fácil de recordar funciona bien.
          </p>
          <FieldError {...form.errorProps('password')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invited-confirm">Repite la contraseña</Label>
          <Input
            id="invited-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(confirmError)}
            aria-describedby={confirmError ? 'invited-confirm-error' : undefined}
          />
          <FieldError id="invited-confirm-error" message={confirmError} />
        </div>
        <FieldError {...form.errorProps('token')} />
        <FormActions
          submitLabel="Crear cuenta y entrar"
          isPending={register.isPending}
          error={register.error?.message}
        />
      </fieldset>
    </form>
  );
}

/** Ya tiene cuenta y la sesión es suya: un clic */
function AcceptButton({ token, onAccepted }: AcceptProps) {
  const accept = useAcceptInvitation();
  return (
    <div className="grid gap-3">
      <Button
        onClick={() => accept.mutate(token, { onSuccess: onAccepted })}
        disabled={accept.isPending}
      >
        {accept.isPending ? 'Aceptando…' : 'Aceptar invitación'}
      </Button>
      {accept.error && (
        <p role="alert" className="text-sm text-destructive">
          {accept.error.message}
        </p>
      )}
    </div>
  );
}

/** Ya tiene cuenta pero no ha iniciado sesión: inicia sesión aquí mismo y acepta */
function LoginAndAccept({ token, email, onAccepted }: AcceptProps & { email: string }) {
  const login = useLogin();
  const accept = useAcceptInvitation();
  const form = useSchemaForm(loginRequestSchema, ['email', 'password'], (data) =>
    login.mutate(data, { onSuccess: () => accept.mutate(token, { onSuccess: onAccepted }) }),
  );
  const isPending = login.isPending || accept.isPending;

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={isPending} className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Ya tienes una cuenta: inicia sesión para aceptar.
        </p>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('email')}>Correo</Label>
          <Input {...form.field('email')} value={email} readOnly autoComplete="username" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('password')}>Contraseña</Label>
          <Input
            {...form.field('password')}
            type="password"
            autoComplete="current-password"
            autoFocus
          />
          <FieldError {...form.errorProps('password')} />
        </div>
        <FormActions
          submitLabel="Iniciar sesión y aceptar"
          isPending={isPending}
          error={login.error?.message ?? accept.error?.message}
        />
      </fieldset>
    </form>
  );
}

/** La sesión abierta es de otra persona */
function WrongAccount({
  currentEmail,
  invitedEmail,
}: {
  currentEmail: string;
  invitedEmail: string;
}) {
  const logout = useLogout();
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Iniciaste sesión como <strong>{currentEmail}</strong>, pero la invitación es para{' '}
        <strong>{invitedEmail}</strong>. Cierra sesión para continuar.
      </p>
      <Button
        variant="outline" // Al recargar se vuelve a leer el enlace (sigue en la URL) ya sin sesión
        onClick={() => logout.mutate(undefined, { onSuccess: () => window.location.reload() })}
        disabled={logout.isPending}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
