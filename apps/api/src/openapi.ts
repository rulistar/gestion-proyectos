import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  createPhaseSchema,
  currentUserSchema,
  loginRequestSchema,
  myTaskListSchema,
  myTasksQuerySchema,
  phaseListSchema,
  phaseSchema,
  projectInputSchema,
  projectListSchema,
  projectMetricsQuerySchema,
  projectSchema,
  projectStatusUpdateSchema,
  taskInputSchema,
  taskListSchema,
  taskSchema,
  taskStatusUpdateSchema,
  workspaceDetailSchema,
  workspaceListSchema,
  workspaceTaskListSchema,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyInstance, FastifySchema } from 'fastify';
import { requireAuth } from './modules/auth/session.js';

/**
 * Documentación de la API (TEC-05, OpenAPI 3): /api/v1/docs (página) y /api/v1/docs/json.
 *
 * Solo documenta: las rutas no declaran `schema` de Fastify, así que la validación sigue siendo la
 * de Zod en cada ruta y las respuestas no cambian. Todas las rutas aparecen solas (agrupadas por
 * módulo, con sus parámetros); a las de abajo se les agrega descripción, cuerpo y respuesta desde
 * los mismos esquemas de `packages/shared`, que son el contrato.
 */

/** Esquema Zod → JSON Schema de OpenAPI 3.0 (lo que llega: `input`; lo que sale: `output`) */
function json(schema: z.ZodType, io: 'input' | 'output') {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  return rest;
}

interface RouteDoc {
  summary: string;
  description?: string;
  querystring?: z.ZodType;
  body?: z.ZodType;
  /** Respuesta exitosa (200, o 201 si `created`) */
  response?: z.ZodType;
  created?: boolean;
}

const WS = '/api/v1/workspaces/:workspaceId';
const PROJECT = `${WS}/projects/:projectId`;

/** Rutas documentadas a detalle: las que usará una integración (proyectos, fases, tareas) */
const DOCS: Record<string, RouteDoc> = {
  'POST /api/v1/auth/login': {
    summary: 'Iniciar sesión',
    description: 'Deja la sesión en la cookie HttpOnly "sid" (HU-02).',
    body: loginRequestSchema,
    response: currentUserSchema,
  },
  'GET /api/v1/auth/me': { summary: 'Usuario actual y sus espacios', response: currentUserSchema },
  'GET /api/v1/workspaces': { summary: 'Mis espacios de trabajo', response: workspaceListSchema },
  [`GET ${WS}`]: {
    summary: 'Un espacio, con mi rol y mi matriz de permisos (ADR-0006)',
    response: workspaceDetailSchema,
  },
  [`GET ${WS}/projects`]: {
    summary: 'Proyectos, mantenimientos y actividades que puedo ver',
    description: 'today y monthStart (fecha local) ajustan las métricas por comportamiento.',
    querystring: projectMetricsQuerySchema,
    response: projectListSchema,
  },
  [`POST ${WS}/projects`]: {
    summary: 'Crear un contenedor',
    body: projectInputSchema,
    response: projectSchema,
    created: true,
  },
  [`GET ${PROJECT}`]: { summary: 'Un contenedor', response: projectSchema },
  [`PUT ${PROJECT}`]: {
    summary: 'Editar un contenedor',
    body: projectInputSchema,
    response: projectSchema,
  },
  [`PATCH ${PROJECT}/status`]: {
    summary: 'Cambiar solo el estado (tablero, HU-10)',
    body: projectStatusUpdateSchema,
    response: projectSchema,
  },
  [`DELETE ${PROJECT}`]: { summary: 'Mandar un contenedor a la papelera' },
  [`GET ${PROJECT}/phases`]: { summary: 'Fases del proyecto (HU-07)', response: phaseListSchema },
  [`POST ${PROJECT}/phases`]: {
    summary: 'Crear una fase (hasta 4 niveles)',
    body: createPhaseSchema,
    response: phaseSchema,
    created: true,
  },
  [`GET ${PROJECT}/tasks`]: { summary: 'Tareas de un contenedor', response: taskListSchema },
  [`POST ${PROJECT}/tasks`]: {
    summary: 'Crear una tarea',
    body: taskInputSchema,
    response: taskSchema,
    created: true,
  },
  [`PUT ${PROJECT}/tasks/:taskId`]: {
    summary: 'Editar una tarea',
    body: taskInputSchema,
    response: taskSchema,
  },
  [`PATCH ${PROJECT}/tasks/:taskId/status`]: {
    summary: 'Cambiar el estado de una tarea (motivo si se pausa o cancela)',
    body: taskStatusUpdateSchema,
    response: taskSchema,
  },
  [`DELETE ${PROJECT}/tasks/:taskId`]: { summary: 'Mandar una tarea a la papelera' },
  [`GET ${WS}/tasks`]: {
    summary: 'Todas las tareas que puedo ver en el espacio (HU-39)',
    response: workspaceTaskListSchema,
  },
  [`GET ${WS}/my-tasks`]: {
    summary: 'Mis tareas: donde soy Responsable (HU-28b)',
    querystring: myTasksQuerySchema,
    response: myTaskListSchema,
  },
};

/** Grupo de cada ruta: el recurso más específico de su URL */
const TAGS: Record<string, string> = {
  auth: 'Sesión y perfil',
  workspaces: 'Espacios y miembros',
  members: 'Espacios y miembros',
  invitations: 'Invitaciones',
  people: 'Personas',
  'project-types': 'Catálogos',
  'task-types': 'Catálogos',
  'task-origins': 'Catálogos',
  'detail-fields': 'Catálogos',
  projects: 'Proyectos',
  phases: 'Fases',
  tasks: 'Tareas',
  'my-tasks': 'Tareas',
  trash: 'Papelera',
  'export.csv': 'Exportar y cargar',
  'export.json': 'Exportar y cargar',
  import: 'Exportar y cargar',
  users: 'Usuarios del sistema',
  'password-resets': 'Sesión y perfil',
  health: 'Salud',
};

function tagOf(url: string): string {
  const segments = url
    .replace(/^\/api\/v1\//, '')
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'));
  const known = [...segments].reverse().find((segment) => segment in TAGS);
  return TAGS[known ?? segments[0] ?? ''] ?? 'Otros';
}

/** Los `:parámetros` de la URL, como los pide OpenAPI */
function paramsOf(url: string) {
  const names = [...url.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]!);
  if (names.length === 0) return undefined;
  return {
    type: 'object',
    properties: Object.fromEntries(
      names.map((name) => [name, { type: 'string', format: name === 'kind' ? undefined : 'uuid' }]),
    ),
    required: names,
  };
}

export function registerOpenApi(app: FastifyInstance, { production }: { production: boolean }) {
  void app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Gestor de Proyectos — API',
        version: 'v1',
        description:
          'API versionada bajo /api/v1. La sesión viaja en la cookie HttpOnly "sid" (POST /auth/login). ' +
          'Toda entrada se valida con Zod; un ID de otro espacio o algo que no puedes ver responde 404.',
      },
      components: {
        securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sid' } },
      },
      security: [{ session: [] }],
    },
    transform: ({ schema, url, route }) => {
      // La web (en producción, la misma app la sirve) no es parte de la API
      if (!url.startsWith('/api/v1/')) return { schema: { ...schema, hide: true }, url };
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      const doc = DOCS[`${methods[0]} ${url}`];
      const documented: FastifySchema & Record<string, unknown> = {
        ...schema,
        tags: [tagOf(url)],
        ...(paramsOf(url) && { params: paramsOf(url) }),
      };
      if (doc) {
        documented.summary = doc.summary;
        if (doc.description) documented.description = doc.description;
        if (doc.querystring) documented.querystring = json(doc.querystring, 'input');
        if (doc.body) documented.body = json(doc.body, 'input');
        if (doc.response) {
          documented.response = { [doc.created ? 201 : 200]: json(doc.response, 'output') };
        }
      }
      return { schema: documented, url };
    },
  });

  void app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    // Decisión del PO (TEC-05): en producción solo con sesión iniciada; en local, abierta
    ...(production && {
      uiHooks: {
        // Estos ganchos son de estilo callback: si requireAuth ya respondió 401, no se continúa
        preHandler: (request, reply, done) => {
          requireAuth(request, reply).then(() => {
            if (!reply.sent) done();
          }, done);
        },
      },
    }),
  });
}
