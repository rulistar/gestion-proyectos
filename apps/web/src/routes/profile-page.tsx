import {
  changeMyEmailSchema,
  changeMyPasswordSchema,
  PASSWORD_MIN_LENGTH,
  updateMyNameSchema,
} from '@gestion/shared';
import { toast } from 'sonner';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeMyEmail, useChangeMyPassword, useCurrentUser, useUpdateMyName } from '@/lib/auth';
import { useSchemaForm } from '@/lib/use-schema-form';

/** Mi perfil (HU-29): nombre, correo y contraseña, sin pedírselo al Admin */
export function ProfilePage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <PageHeader
        title="Mi perfil"
        description="Tus datos de acceso. Cambiar el correo o la contraseña cierra tu sesión en los demás dispositivos."
      />
      <NameCard />
      <EmailCard />
      <PasswordCard />
    </div>
  );
}

function NameCard() {
  const user = useCurrentUser();
  const update = useUpdateMyName();
  const form = useSchemaForm(updateMyNameSchema, ['name'], (data) =>
    update.mutate(data, { onSuccess: () => toast.success('Nombre actualizado') }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre</CardTitle>
        <CardDescription>
          En cada espacio también cambia el de tu persona, salvo que el Admin le haya puesto otro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={update.isPending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input
                {...form.field('name')}
                defaultValue={user.name}
                maxLength={100}
                autoComplete="name"
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <FormActions
              submitLabel="Guardar nombre"
              isPending={update.isPending}
              error={update.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function EmailCard() {
  const user = useCurrentUser();
  const change = useChangeMyEmail();
  const form = useSchemaForm(changeMyEmailSchema, ['email', 'currentPassword'], (data, formEl) =>
    change.mutate(data, {
      onSuccess: (updated) => {
        toast.success(`Ahora entras con ${updated.email}`);
        // Solo se limpia la contraseña; el correo nuevo queda escrito
        (formEl.elements.namedItem('currentPassword') as HTMLInputElement).value = '';
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correo</CardTitle>
        <CardDescription>
          Con él inicias sesión. Se guarda en minúsculas y no puede usarlo otra cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={change.isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('email')}>Correo nuevo</Label>
              <Input
                {...form.field('email')}
                type="email"
                defaultValue={user.email}
                autoComplete="email"
              />
              <FieldError {...form.errorProps('email')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('currentPassword')}>Contraseña actual</Label>
              <Input
                {...form.field('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
              <FieldError {...form.errorProps('currentPassword')} />
            </div>
            <FormActions
              submitLabel="Cambiar correo"
              isPending={change.isPending}
              error={change.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangeMyPassword();
  const form = useSchemaForm(
    changeMyPasswordSchema,
    ['currentPassword', 'newPassword', 'confirmPassword'],
    (data, formEl) =>
      change.mutate(data, {
        onSuccess: () => {
          toast.success('Contraseña cambiada');
          formEl.reset();
        },
      }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>
          Mínimo {PASSWORD_MIN_LENGTH} caracteres. Una frase fácil de recordar funciona bien.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={change.isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={form.idOf('currentPassword')}>Contraseña actual</Label>
              <Input
                {...form.field('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
              <FieldError {...form.errorProps('currentPassword')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('newPassword')}>Contraseña nueva</Label>
              <Input {...form.field('newPassword')} type="password" autoComplete="new-password" />
              <FieldError {...form.errorProps('newPassword')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('confirmPassword')}>Repite la contraseña nueva</Label>
              <Input
                {...form.field('confirmPassword')}
                type="password"
                autoComplete="new-password"
              />
              <FieldError {...form.errorProps('confirmPassword')} />
            </div>
            <FormActions
              submitLabel="Cambiar contraseña"
              isPending={change.isPending}
              error={change.error?.message}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
