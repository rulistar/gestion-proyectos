import { loginRequestSchema } from '@gestion/shared';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AppLogo } from '@/components/app-logo';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Formulario a la izquierda (decisión del PO) */}
      <main className="flex flex-1 flex-col bg-card px-6 py-8 sm:px-14 sm:py-10">
        <AppLogo />
        <div className="flex flex-1 items-center py-10">
          <form onSubmit={handleSubmit} noValidate className="grid w-full max-w-sm gap-5">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight">Bienvenido de nuevo</h1>
              <p className="mt-2 text-muted-foreground">Inicia sesión para continuar.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="tu@empresa.com"
                autoFocus
                className="h-11"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              <FieldError id="email-error" message={fieldErrors.email} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-11 pr-11"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError id="password-error" message={fieldErrors.password} />
            </div>

            {login.error && (
              <p role="alert" className="text-sm text-destructive">
                {login.error.message}
              </p>
            )}

            <Button type="submit" size="lg" disabled={login.isPending} className="h-11 w-full">
              {login.isPending ? 'Entrando…' : 'Iniciar sesión'}
            </Button>
            {/* Sin servicio de correo: el Admin del sistema genera el enlace (HU-54) */}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary">
                ¿Olvidaste tu contraseña?
              </summary>
              <p className="mt-2 text-muted-foreground">
                Pídele al Admin del sistema un enlace para crear una nueva. Llega por el medio que
                acuerden (correo, chat) y sirve una vez, durante 48 horas.
              </p>
            </details>
            {/* Registro solo por invitación (decisión del PO): no hay botón de "crear cuenta" */}
            <p className="rounded-lg bg-accent p-3.5 text-sm text-accent-foreground">
              ¿No tienes cuenta? Pide al Admin de tu espacio de trabajo que te envíe una invitación.
            </p>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">Conexión cifrada · Tus datos son tuyos</p>
      </main>
      <BrandPanel />
    </div>
  );
}

const BENEFITS = [
  'Ve el avance real de cada proyecto, al día y sin hojas de cálculo.',
  'Atiende incidencias y fast tracks primero, con su motivo registrado.',
  'Tu equipo entra solo por invitación, con el rol que tú decides.',
];

/** Panel de marca a la derecha: turquesa con olas, "como el mar en zonas tropicales" */
function BrandPanel() {
  return (
    <aside className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-[#0e6577] p-14 text-white lg:flex">
      <svg
        aria-hidden
        viewBox="0 0 600 800"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        <path
          d="M0 520 C 120 470 220 560 340 520 S 520 460 600 500 L600 800 L0 800 Z"
          fill="#14808a"
          opacity="0.55"
        />
        <path
          d="M0 610 C 140 570 250 650 380 610 S 540 560 600 590 L600 800 L0 800 Z"
          fill="#2a9d9a"
          opacity="0.45"
        />
        <path
          d="M0 700 C 150 670 260 730 400 700 S 550 660 600 680 L600 800 L0 800 Z"
          fill="#5bbdb3"
          opacity="0.35"
        />
      </svg>
      <div className="relative grid max-w-md gap-7">
        <p className="text-4xl leading-tight font-bold tracking-tight">
          Proyectos, mantenimientos y tareas, sin perder el hilo.
        </p>
        <ul className="grid gap-4 text-[#d5ecee]">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <Check
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-warning"
                strokeWidth={2.6}
              />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
