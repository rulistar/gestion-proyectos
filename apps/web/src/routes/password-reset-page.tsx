import { completePasswordResetSchema, PASSWORD_MIN_LENGTH } from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchemaForm } from '@/lib/use-schema-form';
import { passwordResetPreviewQueryOptions, useCompletePasswordReset } from '@/lib/users';

/**
 * Restablecer una contraseña olvidada (HU-54) con el enlace que generó el Admin del sistema.
 * Como en las invitaciones, el token viene después de "#" y se lee una vez al abrir la página.
 */
export function PasswordResetPage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const preview = useQuery({ ...passwordResetPreviewQueryOptions(token), enabled: token !== '' });

  if (token === '' || preview.isError) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-sm text-muted-foreground">
          {preview.error?.message ??
            'El enlace está incompleto. Ábrelo de nuevo desde el mensaje que te enviaron.'}
        </p>
        <Link to="/login" className="mt-3 inline-block text-sm font-medium">
          Ir a iniciar sesión
        </Link>
      </Shell>
    );
  }
  if (!preview.data) return <Shell title="Cargando…" />;

  return (
    <Shell
      title="Crea una contraseña nueva"
      description={
        <>
          Para <strong>{preview.data.name}</strong> ({preview.data.email}). Al guardarla se cierran
          tus sesiones abiertas en otros equipos.
        </>
      }
    >
      <ResetForm token={token} email={preview.data.email} />
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

/** Contraseña nueva dos veces, para evitar errores de tecleo */
function ResetForm({ token, email }: { token: string; email: string }) {
  const complete = useCompletePasswordReset();
  const navigate = useNavigate();
  const [confirmError, setConfirmError] = useState<string>();
  const form = useSchemaForm(completePasswordResetSchema, ['token', 'password'], (data, formEl) => {
    if (new FormData(formEl).get('confirm') !== data.password) {
      setConfirmError('Las contraseñas no coinciden');
      return;
    }
    setConfirmError(undefined);
    // Al inicio, reemplazando la URL: el enlace no queda en el historial
    complete.mutate(data, { onSuccess: () => void navigate({ to: '/', replace: true }) });
  });

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={complete.isPending} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        {/* Para que el navegador ofrezca guardar la contraseña con este correo */}
        <input type="hidden" name="username" value={email} autoComplete="username" />
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('password')}>Contraseña nueva</Label>
          <Input
            {...form.field('password')}
            type="password"
            autoComplete="new-password"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Mínimo {PASSWORD_MIN_LENGTH} caracteres. Una frase fácil de recordar funciona bien.
          </p>
          <FieldError {...form.errorProps('password')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reset-confirm">Repite la contraseña</Label>
          <Input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(confirmError)}
            aria-describedby={confirmError ? 'reset-confirm-error' : undefined}
          />
          <FieldError id="reset-confirm-error" message={confirmError} />
        </div>
        <FieldError {...form.errorProps('token')} />
        <FormActions
          submitLabel="Guardar y entrar"
          isPending={complete.isPending}
          error={complete.error?.message}
        />
      </fieldset>
    </form>
  );
}
