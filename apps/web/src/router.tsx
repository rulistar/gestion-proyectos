import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ApiError } from '@/lib/api';
import { projectFiltersSchema, taskFiltersSchema } from '@gestion/shared';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { peopleQueryOptions } from '@/lib/people';
import { weekStartIso } from '@/lib/dates';
import { myTasksQueryOptions } from '@/lib/my-work';
import { projectTypesQueryOptions } from '@/lib/project-types';
import { projectQueryOptions, projectsQueryOptions } from '@/lib/projects';
import { taskTypesQueryOptions } from '@/lib/task-types';
import { tasksQueryOptions, workspaceTasksQueryOptions } from '@/lib/tasks';
import { membersQueryOptions, workspaceQueryOptions } from '@/lib/workspaces';
import { AppLayout } from '@/routes/app-layout';
import { ErrorPage } from '@/routes/error-page';
import { HomePage } from '@/routes/home-page';
import { InvitationPage } from '@/routes/invitation-page';
import { LoginPage } from '@/routes/login-page';
import { MembersPage } from '@/routes/members-page';
import { MyWorkPage } from '@/routes/my-work-page';
import { PeoplePage } from '@/routes/people-page';
import { ProfilePage } from '@/routes/profile-page';
import { ProjectPage } from '@/routes/project-page';
import { TasksPage } from '@/routes/tasks-page';
import { TrashPage } from '@/routes/trash-page';
import { UsersPage } from '@/routes/users-page';
import { CatalogPage } from '@/routes/catalog-page';
import { ActivitiesPage, MaintenancePage, WorkspacePage } from '@/routes/workspace-page';

/*
 * Rutas definidas en código (ADR-0003):
 *
 *   /                          protegidas (layout "app": barra superior + página):
 *   /w/$workspaceId              inicio, un workspace con sus proyectos
 *   /w/$workspaceId/p/$projectId un proyecto
 *   /w/$workspaceId/mantenimientos y /actividades: los contenedores de esos tipos (HU-21)
 *   /w/$workspaceId/mi-trabajo    mis tareas en ese workspace (HU-28b)
 *   /w/$workspaceId/tareas        todas las tareas del espacio, con filtros en la URL (HU-39)
 *   /w/$workspaceId/configuracion tipos de contenedor (HU-21, solo Admin)
 *   /w/$workspaceId/miembros      y sus miembros e invitaciones
 *   /w/$workspaceId/personas      catálogo de personas (HU-34, solo Admin)
 *   /w/$workspaceId/papelera      y su papelera (solo Admin)
 *   /login                     pública; si ya hay sesión, redirige a /
 *   /invitacion#<token>        pública: aceptar una invitación (HU-01)
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

/** Pública: con o sin sesión (quien ya tiene cuenta puede iniciar sesión ahí mismo) */
const invitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invitacion',
  component: InvitationPage,
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
  // Con espacios de trabajo, directo al primero; la página solo se ve si no hay ninguno
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    const first = user?.workspaces[0];
    if (first) {
      redirect({ to: '/w/$workspaceId', params: { workspaceId: first.id }, throw: true });
    }
  },
  component: HomePage,
});

/** Lo que necesita la lista de contenedores (proyectos, mantenimientos o actividades) */
function loadContainers(queryClient: QueryClient, workspaceId: string) {
  return Promise.all([
    queryClient.ensureQueryData(workspaceQueryOptions(workspaceId)),
    queryClient.ensureQueryData(projectsQueryOptions(workspaceId)),
    queryClient.ensureQueryData(projectTypesQueryOptions(workspaceId)),
    queryClient.ensureQueryData(taskTypesQueryOptions(workspaceId)),
    queryClient.ensureQueryData(peopleQueryOptions(workspaceId)),
  ]);
}

const workspaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId',
  validateSearch: projectFiltersSchema,
  loader: ({ context, params }) => loadContainers(context.queryClient, params.workspaceId),
  component: WorkspacePage,
});

const maintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/mantenimientos',
  validateSearch: projectFiltersSchema,
  loader: ({ context, params }) => loadContainers(context.queryClient, params.workspaceId),
  component: MaintenancePage,
});

const activitiesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/actividades',
  validateSearch: projectFiltersSchema,
  loader: ({ context, params }) => loadContainers(context.queryClient, params.workspaceId),
  component: ActivitiesPage,
});

const catalogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/configuracion',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(projectTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(taskTypesQueryOptions(params.workspaceId)),
    ]),
  component: CatalogPage,
});

const projectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/p/$projectId',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(
        projectQueryOptions(params.workspaceId, params.projectId),
      ),
      context.queryClient.ensureQueryData(tasksQueryOptions(params.workspaceId, params.projectId)),
      context.queryClient.ensureQueryData(peopleQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(projectTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(taskTypesQueryOptions(params.workspaceId)),
    ]),
  component: ProjectPage,
});

const myWorkRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/mi-trabajo',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(myTasksQueryOptions(params.workspaceId, weekStartIso())),
      context.queryClient.ensureQueryData(projectsQueryOptions(params.workspaceId)),
    ]),
  component: MyWorkPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/tareas',
  validateSearch: taskFiltersSchema,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(workspaceTasksQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(projectsQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(projectTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(taskTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(peopleQueryOptions(params.workspaceId)),
    ]),
  component: TasksPage,
});

const peopleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/personas',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(peopleQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(membersQueryOptions(params.workspaceId)),
    ]),
  component: PeoplePage,
});

const membersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/miembros',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(membersQueryOptions(params.workspaceId)),
    ]),
  component: MembersPage,
});

const trashRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/papelera',
  // Solo se precarga el workspace: la papelera la pide la página, que antes revisa el rol
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
  component: TrashPage,
});

/** Mi perfil (HU-29): fuera de los espacios; el usuario ya está en caché por la ruta "app" */
const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/perfil',
  component: ProfilePage,
});

/** Usuarios del sistema (HU-30): la página revisa que sea el Admin del sistema antes de pedirlos */
const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios',
  component: UsersPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  invitationRoute,
  appRoute.addChildren([
    homeRoute,
    profileRoute,
    usersRoute,
    workspaceRoute,
    maintenanceRoute,
    activitiesRoute,
    catalogRoute,
    projectRoute,
    myWorkRoute,
    tasksRoute,
    membersRoute,
    peopleRoute,
    trashRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent', // carga la página al pasar el ratón por un enlace
  defaultErrorComponent: ErrorPage, // p. ej. un workspace que no existe o del que no soy miembro
});

// Registra el tipo del router: así <Link to="..."> y navigate() se verifican al compilar
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
