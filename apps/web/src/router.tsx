import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ApiError } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { workspacesQueryOptions } from '@/lib/workspaces';
import { AppLayout } from '@/routes/app-layout';
import { HomePage } from '@/routes/home-page';
import { LoginPage } from '@/routes/login-page';

/*
 * Rutas definidas en código (ADR-0003):
 *
 *   /            protegida (layout "app": barra superior + página)
 *   /login       pública; si ya hay sesión, redirige a /
 */

/**
 * Si la API responde 401 con una sesión que creíamos activa (expiró por inactividad o se cerró
 * en otro lugar), se olvida al usuario y el router reevalúa la ruta: las protegidas llevan al login.
 */
function handleUnauthorized(error: Error) {
  if (error instanceof ApiError && error.status === 401 && queryClient.getQueryData(meQueryKey)) {
    queryClient.setQueryData(meQueryKey, null);
    void router.invalidate();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      // Un 4xx no se arregla reintentando (401, 403, 404...); un fallo de red o un 5xx, quizá sí
      retry: (failureCount, error) =>
        failureCount < 2 && !('status' in error && Number(error.status) < 500),
    },
  },
});

/** Solo rutas internas ("/algo"): un enlace "/login?redirect=https://otro-sitio" no saca al usuario */
function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = safeRedirect(search.redirect);
    return target ? { redirect: target } : {};
  },
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQueryOptions)) {
      redirect({ to: '/', throw: true });
    }
  },
  component: LoginPage,
});

/** Ruta sin URL propia ("id"): protege a todas sus hijas y les pone el layout */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    // Se pregunta a la API (GET /auth/me) y se guarda en caché; sin sesión → login
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      // throw: true → redirect() interrumpe la carga de la ruta y navega al login
      redirect({ to: '/login', search: { redirect: location.href }, throw: true });
    }
  },
  component: AppLayout,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  // Pide los datos antes de mostrar la página (y los deja en la caché de TanStack Query)
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQueryOptions),
  component: HomePage,
});

const routeTree = rootRoute.addChildren([loginRoute, appRoute.addChildren([homeRoute])]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent', // carga la página al pasar el ratón por un enlace
});

// Registra el tipo del router: así <Link to="..."> y navigate() se verifican al compilar
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
