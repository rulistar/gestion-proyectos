import { Outlet, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useCurrentUser, useLogout } from '@/lib/auth';

/** Marco de todas las páginas con sesión: barra superior + contenido de la ruta hija */
export function AppLayout() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => void navigate({ to: '/login', search: {} }),
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <span className="font-semibold">Gestor de Proyectos</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
