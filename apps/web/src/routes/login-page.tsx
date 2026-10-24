import { loginRequestSchema } from '@gestion/shared';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/lib/auth';

// getRouteApi evita importar router.tsx aquí (que a su vez importa esta página)
const route = getRouteApi('/login');

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export function LoginPage() {
  const { redirect } = route.useSearch();
  const router = useRouter();
  const login = useLogin();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // Mismo esquema que valida la API (packages/shared): un solo lugar para las reglas
    const parsed = loginRequestSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'password') && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => {
        router.history.push(redirect ?? '/');
      },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Gestor de Proyectos</CardTitle>
          <CardDescription>Inicia sesión con tu correo y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {login.error && (
              <p role="alert" className="text-sm text-destructive">
                {login.error.message}
              </p>
            )}

            <Button type="submit" disabled={login.isPending} className="w-full">
              {login.isPending ? 'Entrando…' : 'Iniciar sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
