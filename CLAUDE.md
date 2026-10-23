# CLAUDE.md — Gestor de Proyectos

Contexto para sesiones de Claude Code. Leer antes de trabajar en el repo.

## Proyecto

Aplicación web para gestionar proyectos personales y de un equipo pequeño (workspaces → proyectos → fases/entregables → tareas, tablero Kanban, gráficas, import/export). Diseñada para crecer por módulos e integrarse con otras apps vía API versionada.

- Documentos de gobierno: [docs/00-acta-proyecto.md](docs/00-acta-proyecto.md) (alcance, objetivos, DoD) y [docs/adr/](docs/adr/) (decisiones de arquitectura).
- Metodología: PMI + Scrum (sprints de 2 semanas). **Nada entra sin historia de usuario.**
- El usuario está aprendiendo el stack: explicar el porqué de cada cambio, de forma breve.
- Presupuesto de infraestructura: $0 (capas gratuitas).

## Stack (ADR-0001)

| Capa          | Tecnología                                                                                                  | Estado                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Monorepo      | pnpm workspaces (pnpm 12, Node 24)                                                                          | ✅ instalado                              |
| Frontend      | React 19 + Vite 7 + TypeScript + Tailwind CSS 4                                                             | ✅ instalado                              |
| Backend       | Fastify 5 + TypeScript                                                                                      | ✅ instalado                              |
| Validación    | Zod 4 (compartido en `packages/shared`)                                                                     | ✅ instalado                              |
| Base de datos | PostgreSQL 17 (Docker Compose)                                                                              | ✅ compose                                |
| Pruebas       | Vitest (unitarias)                                                                                          | ✅ instalado                              |
| Calidad       | ESLint 10 + typescript-eslint, Prettier, Husky + lint-staged                                                | ✅ instalado                              |
| CI            | GitHub Actions + gitleaks + pnpm audit + Dependabot                                                         | ✅ configurado                            |
| Pendientes    | Prisma, TanStack Query, shadcn/ui, helmet, CORS, rate-limit, Swagger/OpenAPI, Argon2 + sesiones, Playwright | ⏳ se instalan en la historia que los use |

**No agregar dependencias fuera del ADR sin preguntar al usuario.**

### Restricciones de versión (no cambiar sin revisar)

- **Vite 7, no 8**: Vite 8 usa rolldown, cuyo binario nativo (`.node`) es bloqueado por _Smart App Control_ de Windows en la PC del usuario ("An Application Control policy has blocked this file"). Vite 7 usa rollup/esbuild, que sí cargan. Por eso `@vitejs/plugin-react` está en v5. Dependabot ignora esos majors.
- **TypeScript ~6.0**: typescript-eslint 8 exige `typescript <6.1`. TypeScript 7 aún no es compatible.
- **pnpm bloquea scripts de instalación** por defecto; los permitidos están en `allowBuilds` de `pnpm-workspace.yaml` (solo `esbuild`). Aprobar uno nuevo: `pnpm approve-builds <paquete>`, y solo si es necesario.

## Estructura

```
apps/
  web/                React + Vite. Proxy de /api → http://127.0.0.1:3000 en desarrollo
  api/                Fastify — monolito modular
    src/app.ts          buildApp(): crea la instancia sin abrir puerto (testeable con app.inject)
    src/server.ts       arranque + cierre ordenado
    src/config/env.ts   variables de entorno validadas con Zod (falla al inicio si son inválidas)
    src/modules/<mod>/  un módulo por funcionalidad: <mod>.routes.ts, <mod>.test.ts, ...
packages/
  shared/             esquemas Zod + tipos (z.infer) usados por web y api
docs/                 acta, ADRs, backlog (no los reformatea Prettier)
.github/              CI (ci.yml) y Dependabot
docker-compose.yml    PostgreSQL local
```

### Convenciones

- Rutas de la API siempre bajo `/api/v1/...`. Cada módulo se registra en `app.ts` con `prefix: '/api/v1'`.
- Módulos previstos (ADR): `auth`, `workspaces`, `projects`, `tasks`, `reports`, `integrations`.
- Un esquema Zod en `packages/shared` es la fuente de verdad del contrato; el tipo TS se deriva con `z.infer`.
- `@gestion/shared` se resuelve al **código fuente** (`src/*.ts`) en desarrollo, tests, typecheck y build de la web mediante la condición de export `@gestion/source`. Solo `node dist/server.js` (producción) usa el `dist` compilado. Si se agrega otra herramienta, configurarle esa condición.
- Imports relativos en api y shared con extensión `.js` (módulos ESM `NodeNext`). En web no hace falta (`Bundler`).
- Imports de solo tipos: `import type` (regla de ESLint).
- Pruebas junto al código: `*.test.ts`. Probar endpoints con `buildApp().inject()`, sin red.

## Comandos (desde la raíz)

```bash
pnpm install           # instala todo (también activa los hooks de Husky)
pnpm db:up             # levanta PostgreSQL (requiere .env)
pnpm db:down           # detiene PostgreSQL (los datos persisten en el volumen)
pnpm dev               # api (:3000) + web (:5173) en paralelo
pnpm test              # Vitest en todos los paquetes
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
