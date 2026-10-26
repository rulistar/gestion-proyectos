# CLAUDE.md — Gestor de Proyectos

Contexto para sesiones de Claude Code. Leer antes de trabajar en el repo.

## Proyecto

Aplicación web para gestionar proyectos personales y de un equipo pequeño (workspaces → proyectos → fases/entregables → tareas, tablero Kanban, gráficas, import/export). Diseñada para crecer por módulos e integrarse con otras apps vía API versionada.

- Documentos de gobierno: [docs/00-acta-proyecto.md](docs/00-acta-proyecto.md) (alcance, objetivos, DoD) y [docs/adr/](docs/adr/) (decisiones de arquitectura).
- Metodología: PMI + Scrum (sprints de 2 semanas). **Nada entra sin historia de usuario.**
- El usuario está aprendiendo el stack: explicar el porqué de cada cambio, de forma breve.
- Presupuesto de infraestructura: $0 (capas gratuitas).
- Backlog priorizado: [docs/backlog.md](docs/backlog.md) · Sprint actual: [docs/sprints/](docs/sprints/).
- Flujo: el usuario es el Product Owner; se trabaja una rama + un PR por elemento del backlog. `main` está protegida (PR + 3 checks de CI en verde).

## Decisiones de producto (PO, 2026-10-23)

Afectan al modelo de datos y a cada endpoint. Detalle en [docs/backlog.md](docs/backlog.md).

- **Registro solo por invitación**; el primer Admin se crea con `setup:admin`.
- **Roles por workspace** (Admin, Miembro, Lector) vía `Membership`, más **ajustes de permisos por usuario**.
- **Visibilidad**: proyectos públicos (todo el workspace) o restringidos (lista de usuarios). Los Admin ven todo.
- **Borrado lógico** (papelera, restaurable) y **físico solo desde la papelera**, solo Admin. Lo borrado no aparece en listados, exportaciones ni gráficas.
- **RNF-01 trazabilidad**: toda entidad lleva `createdById/createdAt/updatedById/updatedAt` (+ `deletedById/deletedAt`).
- **HTTPS obligatorio en producción** (HSTS, cookies `Secure`); HTTP en localhost.
- **Exportar en JSON y CSV compatible con Excel** (como el prototipo; sin librería de Excel).
- **El MVP generaliza el prototipo "Gestor de cursos"**: curso → proyecto, unidad → fase, actividad → tarea. Campos, estados y reglas de cálculo en ADR-0002 §1.1.
- **Integración con la app de estudio** (gestor de cursos + Lexika) en ambas direcciones; cada sistema es dueño de sus datos (ADR-0002 §7).

## Stack (ADR-0001)

| Capa          | Tecnología                                                                      | Estado                                    |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| Monorepo      | pnpm workspaces (pnpm 12, Node 24)                                              | ✅ instalado                              |
| Frontend      | React 19 + Vite 7 + TypeScript + Tailwind CSS 4                                 | ✅ instalado                              |
| Backend       | Fastify 5 + TypeScript                                                          | ✅ instalado                              |
| Validación    | Zod 4 (compartido en `packages/shared`)                                         | ✅ instalado                              |
| Base de datos | PostgreSQL 17 (Docker Compose) + Prisma 7.10 (`@prisma/adapter-pg` + `pg`)      | ✅ instalado                              |
| Pruebas       | Vitest (unitarias + integración contra PostgreSQL real)                         | ✅ instalado                              |
| Calidad       | ESLint 10 + typescript-eslint, Prettier, Husky + lint-staged                    | ✅ instalado                              |
| CI            | GitHub Actions + gitleaks + pnpm audit + Dependabot                             | ✅ configurado                            |
| Seguridad     | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` (TEC-02)              | ✅ instalado                              |
| Contraseñas   | `argon2` 0.45 (Argon2id, binario nativo; TEC-07)                                | ✅ instalado                              |
| Sesiones      | `@fastify/cookie` (cookie HttpOnly + sesión en BD; HU-02)                       | ✅ instalado                              |
| Web (TEC-03)  | TanStack Router (ADR-0003), TanStack Query, shadcn/ui (copiado a mano)          | ✅ instalado                              |
| Interfaz      | `lucide-react` (iconos), Radix Dialog y Dropdown Menu, `sonner` (avisos); HU-28 | ✅ instalado                              |
| Pendientes    | Swagger/OpenAPI, Playwright                                                     | ⏳ se instalan en la historia que los use |

**No agregar dependencias fuera del ADR sin preguntar al usuario.**

### Restricciones de versión (no cambiar sin revisar)

- **Vite 7, no 8**: Vite 8 usa rolldown, cuyo binario nativo (`.node`) es bloqueado por _Smart App Control_ de Windows en la PC del usuario ("An Application Control policy has blocked this file"). Vite 7 usa rollup/esbuild, que sí cargan. Por eso `@vitejs/plugin-react` está en v5. Dependabot ignora esos majors.
- **TypeScript ~6.0**: typescript-eslint 8 exige `typescript <6.1`. TypeScript 7 aún no es compatible.
- **`@types/node` en 24.x**: debe coincidir con la versión de Node (`.nvmrc` = 24). Si se sube Node, subir ambos juntos. Dependabot ignora sus majors.
- **pnpm bloquea scripts de instalación** por defecto; los permitidos están en `allowBuilds` de `pnpm-workspace.yaml` (`esbuild`, `prisma`, `@prisma/engines`, `argon2`). Aprobar uno nuevo: `pnpm approve-builds <paquete>`, y solo si es necesario.

## Estructura

```
apps/
  web/                React + Vite. Proxy de /api → http://127.0.0.1:3000 en desarrollo
    src/router.tsx      rutas en código (TanStack Router): /login pública; ruta "app" protege a sus hijas
                        (/, /w/$workspaceId, /w/$workspaceId/p/$projectId, .../mantenimientos, .../actividades, .../mi-trabajo,
                        .../miembros, .../papelera, .../configuracion). getRouteApi usa el id: "/app/w/..."
    src/lib/api.ts      apiFetch(): llamadas a /api/v1 validadas con esquemas de shared; errores → ApiError
    src/lib/auth.ts     meQueryOptions (GET /auth/me), useCurrentUser, useLogin, useLogout
    src/lib/<mod>.ts    queryOptions + mutaciones de cada módulo (p. ej. workspaces.ts); la ruta precarga con loader
    src/lib/use-schema-form.ts  formularios validados con el esquema de shared (FormData + errores por campo)
    src/components/ui/  componentes de shadcn/ui (copiados, sin el CLI; se pueden modificar)
    src/components/app-sidebar.tsx  menú lateral con el combo "Espacio de trabajo"; app-layout.tsx = menú + barra superior
    src/lib/brand.ts    APP_NAME (nombre del producto, provisional) e initials() para avatares
    src/index.css       tema: variables de color (turquesa #0f6e7a, dorado para lo urgente) y Plus Jakarta Sans
    src/routes/         una página por archivo; leen la ruta con getRouteApi() para no importar router.tsx
                        invitation-page.tsx: /invitacion#<token> (el token va tras "#": no llega al servidor)
  api/                Fastify — monolito modular
    src/app.ts          buildApp(): crea la instancia sin abrir puerto (testeable con app.inject)
    src/server.ts       arranque + cierre ordenado
    src/config/env.ts   variables de entorno validadas con Zod (falla al inicio si son inválidas)
    src/security.ts     helmet, CORS (CORS_ORIGINS), rate limit y HTTPS/HSTS en producción (TEC-02).
                        Rutas sensibles (login): `config: { rateLimit: authRateLimit }`
    src/modules/<mod>/  un módulo por funcionalidad: <mod>.routes.ts, <mod>.test.ts, ...
      auth/password.ts    hashPassword/verifyPassword (Argon2id)
      auth/tokens.ts      generateToken/hashToken: token aleatorio para el usuario, hash SHA-256 para la BD
      auth/session.ts     sesiones en BD (hash SHA-256 del token, cookie "sid") + requireAuth + startSession
      auth/current-user.ts getCurrentUser: el usuario con sus workspaces (/auth/me, login, HU-01)
      auth/auth.routes.ts POST /auth/login, POST /auth/logout, GET /auth/me (HU-02)
      workspaces/         GET/POST/PATCH /workspaces[/:id], /:id/members (PATCH rol, DELETE quitar; HU-25)
      workspaces/access.ts requireMembership / requirePermission(permiso): membresía + rol (RNF-02)
      project-types/      catálogo de tipos de contenedor (HU-21, ADR-0004): GET (project.read), POST/PATCH (catalog.manage);
                          seedCatalog carga tipos de contenedor, de tarea y permitidos al crear un espacio
      task-types/         catálogo de tipos de tarea (HU-22): GET (project.read), POST/PATCH (catalog.manage);
                          resolveTaskType valida el tipo contra los permitidos del contenedor
      projects/           CRUD de proyectos bajo /workspaces/:workspaceId/projects (HU-05); DELETE = a la papelera.
                          GET acepta ?today=&monthStart= (fecha local) para las métricas por comportamiento
      tasks/              tareas de un proyecto: GET/POST, PUT /:taskId, PATCH /:taskId/status, DELETE (HU-08);
                          GET /workspaces/:id/my-tasks = mis tareas (HU-28b)
      trash/              papelera, solo Admin (HU-15): GET /trash, POST /trash/:kind/:id/restore, DELETE /trash/:kind/:id
      invitations/        GET/POST/DELETE /workspaces/:id/invitations, solo Admin (HU-04); el token se devuelve una vez
      invitations/accept.* públicas: POST /invitations/preview|register|accept (HU-01); token en el cuerpo
    src/db/dates.ts     columnas date ↔ "AAAA-MM-DD" (siempre en UTC)
      setup/              createFirstAdmin: primer Admin + workspace "workpers" (TEC-07)
    src/cli/            comandos de terminal (setup-admin.ts → pnpm setup:admin)
    src/db/client.ts    createDb(): PrismaClient con el adaptador pg; se inyecta en buildApp({ db }) → app.db
    src/db/audit.ts     auditCreate/auditUpdate/auditSoftDelete/auditRestore + filtro notDeleted (RNF-01, RNF-05)
    src/generated/      cliente de Prisma generado (ignorado por Git; se regenera en pnpm install)
    src/test/           BD de pruebas: global-setup (crea + migra), test-db (createTestDb, resetDb)
    prisma/             schema.prisma + migrations/ (versionadas en Git)
    prisma.config.ts    configuración de Prisma 7 (carga el .env de la raíz)
packages/
  shared/             esquemas Zod + tipos (z.infer) usados por web y api
    src/schemas/permissions.ts  catálogo de permisos por rol (roleHasPermission)
    src/schemas/progress.ts     reglas de avance (summarizeTasks, daysRemainingLabel; HU-06), con pruebas
    src/schemas/my-work.ts      groupMyWork: agrupa mis tareas por fecha de fin (HU-28b), con pruebas
    tsconfig.build.json         build sin los *.test.ts
docs/                 acta, ADRs, backlog (no los reformatea Prettier)
.github/              CI (ci.yml) y Dependabot
docker-compose.yml    PostgreSQL local
```

### Convenciones

- Rutas de la API siempre bajo `/api/v1/...`. Cada módulo se registra en `app.ts` con `prefix: '/api/v1'`.
- Módulos previstos (ADR): `auth`, `workspaces`, `projects`, `tasks`, `reports`, `integrations`.
- Un esquema Zod en `packages/shared` es la fuente de verdad del contrato; el tipo TS se deriva con `z.infer`.
- `@gestion/shared` se resuelve al **código fuente** (`src/*.ts`) en desarrollo, tests, typecheck y build de la web mediante la condición de export `@gestion/source`. Solo `node dist/server.js` (producción) usa el `dist` compilado. Si se agrega otra herramienta, configurarle esa condición.
- Imports relativos en api y shared con extensión `.js` (módulos ESM `NodeNext`). En web no hace falta (`Bundler`) y se usa el alias `@/` → `src/`.
- Imports de solo tipos: `import type` (regla de ESLint).
- Pruebas junto al código: `*.test.ts`. Probar endpoints con `buildApp({ db }).inject()`, sin red. Las reglas de negocio puras (cálculos) van en `packages/shared` con sus pruebas (Vitest, sin BD).
- **Rutas que exigen sesión**: `{ preHandler: requireAuth }` (de `modules/auth/session.ts`); el usuario queda en `request.auth.userId`. Sin sesión válida → 401.
- **Rutas de un workspace** (`/workspaces/:workspaceId/...`): después de `requireAuth`, `{ preHandler: requirePermission('project.create') }` (de `modules/workspaces/access.ts`). No miembro o ID inválido → 404 (no revela que existe); rol sin permiso → 403. El catálogo de permisos por rol está en `packages/shared` (`roleHasPermission`); la web lo usa solo para ocultar botones. Toda consulta filtra también por `workspaceId` (un ID de otro workspace da 404).
- **Las pruebas de la API necesitan PostgreSQL** (`pnpm db:up`). Usan una BD aparte, `<DATABASE_URL>_test` (o `TEST_DATABASE_URL`), que `global-setup.ts` crea y migra sola; se niegan a correr contra una BD que no termine en `_test`. Se ejecutan en serie (`fileParallelism: false`) y cada archivo limpia con `resetDb()`.
- **Prisma**: toda tabla nueva sigue el ADR-0002 (UUID v7 `@default(uuid(7)) @db.Uuid`, `@@map`/`@map` en snake_case, `@db.Timestamptz(3)`, campos de trazabilidad con relaciones a `User`). Toda consulta normal incluye `notDeleted`. Índices únicos que deben ignorar la papelera: `@@unique([...], where: { deletedAt: null })` (preview feature `partialIndexes`).
- Cambiar el esquema → `pnpm db:migrate` (crea la migración con un nombre descriptivo) → incluir la carpeta de la migración en el commit. Nunca editar una migración ya fusionada en `main`.

## Comandos (desde la raíz)

```bash
pnpm install           # instala todo (también activa los hooks de Husky)
pnpm db:up             # levanta PostgreSQL (requiere .env)
pnpm db:down           # detiene PostgreSQL (los datos persisten en el volumen)
pnpm db:migrate        # crea/aplica migraciones; después postdb:migrate regenera el cliente (Prisma 7 ya no lo hace solo)
pnpm db:studio         # explorador visual de la BD (Prisma Studio)
pnpm db:reset          # ⚠️ borra y recrea la BD de desarrollo aplicando todas las migraciones
pnpm setup:admin       # crea el primer Admin (interactivo; solo si no hay usuarios)
pnpm dev               # api (:3000) + web (:5173) en paralelo
pnpm test              # Vitest en todos los paquetes (requiere pnpm db:up)
pnpm lint              # ESLint   | pnpm lint:fix
pnpm format            # Prettier | pnpm format:check
pnpm typecheck         # tsc --noEmit en todos los paquetes
pnpm build             # compila shared → api → web
pnpm --filter @gestion/api <script>   # ejecutar un script en un solo paquete
pnpm --filter @gestion/web add <pkg>  # agregar dependencia a un paquete
```

Antes de dar una tarea por terminada: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

## Reglas de seguridad (obligatorias)

1. **Secretos solo en `.env`** (ignorado por Git). Nunca escribir contraseñas, tokens ni llaves en código, tests, docs ni commits. Toda variable nueva va también a `.env.example` con un valor ficticio y a `apps/api/src/config/env.ts` validada con Zod.
2. **Validar toda entrada externa con Zod** (body, query, params, headers, archivos importados) antes de usarla.
3. **Acceso a datos solo con Prisma** (consultas parametrizadas). Nada de SQL concatenado con strings.
4. **Autorización por rol en el backend, en cada endpoint** (Admin, Miembro, Lector). Ocultar botones en la web no es seguridad.
5. **Autenticación**: sesiones en cookie `HttpOnly` + `Secure` + `SameSite`; contraseñas con Argon2. Nunca tokens en `localStorage`.
6. Al exponer la API: helmet, CORS restringido a orígenes conocidos, rate limiting.
7. No registrar en logs contraseñas, tokens, cookies ni datos personales.
8. `main` está protegida: todo cambio entra por Pull Request con CI en verde (lint, tipos, pruebas, `pnpm audit` sin altas/críticas, gitleaks sin hallazgos).
9. No desactivar hooks (`--no-verify`) ni reglas de lint/TS para "hacer pasar" algo; corregir la causa.
10. Revisar qué hace una dependencia nueva antes de proponerla; preferir paquetes mantenidos y populares.

## Definición de Terminado (del acta)

En `main` vía PR · pruebas y linter en verde · escaneo de seguridad sin problemas altos · documentado · funciona en el entorno desplegado.
