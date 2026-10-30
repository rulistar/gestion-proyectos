import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useLogout } from '@/lib/auth';
import { initials } from '@/lib/brand';
import { MenuOpenContext, useMenuOpen } from '@/lib/use-menu-open';

/**
 * Marco de todas las páginas con sesión (HU-28): menú lateral + barra superior + contenido.
 * El menú se oculta y se muestra con el botón de la barra o con Ctrl+B (HU-40), para dar más
 * espacio a tablas y tableros.
 */
export function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const menu = useMenuOpen(pathname);
  const { toggle } = menu;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {menu.open && <AppSidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-3 border-b bg-card px-3 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-expanded={menu.open}
            aria-label={menu.open ? 'Ocultar menú' : 'Mostrar menú'}
            title={`${menu.open ? 'Ocultar' : 'Mostrar'} menú (Ctrl+B)`}
          >
            {menu.open ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
            <span className="hidden sm:inline">{menu.open ? 'Ocultar menú' : 'Menú'}</span>
          </Button>
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-screen-2xl flex-1 p-3 md:px-6 md:py-4">
          <MenuOpenContext value={menu.open}>
            <Outlet />
          </MenuOpenContext>
        </main>
      </div>
    </div>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => void navigate({ to: '/login', search: {} }),
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        >
          {initials(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">
            {user.isSystemAdmin ? 'Admin del sistema' : user.email}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: '/perfil' })}>
          <UserRound aria-hidden />
          Mi perfil
        </DropdownMenuItem>
        {/* HU-30: solo el Admin del sistema administra las cuentas */}
        {user.isSystemAdmin && (
          <DropdownMenuItem onSelect={() => void navigate({ to: '/usuarios' })}>
            <UsersRound aria-hidden />
            Usuarios del sistema
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={handleLogout} disabled={logout.isPending}>
          <LogOut aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
