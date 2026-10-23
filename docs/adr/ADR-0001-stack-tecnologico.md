# ADR-0001: Stack tecnológico y arquitectura base

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Contexto:** Uso personal + equipo pequeño, web primero, TypeScript, hosting gratuito, crecimiento por módulos e integración con otras apps.

> Un ADR (Architecture Decision Record) registra *qué* decidimos y *por qué*. Si en el futuro cambiamos algo, se crea un ADR nuevo que reemplaza a este; nunca se borra la historia.

## Decisión

| Capa | Tecnología | Por qué |
|---|---|---|
| Organización del código | **Monorepo con pnpm workspaces** | Frontend, backend y tipos compartidos en un solo repo; un cambio en un modelo se refleja en ambos lados |
| Frontend | **React + Vite + TypeScript** | Estándar de la industria, arranque rápido, enorme ecosistema |
| UI | Tailwind CSS + componentes accesibles (shadcn/ui) | Diseño consistente sin pelear con CSS |
| Estado del servidor | TanStack Query | Caché y sincronización con la API sin código repetido |
| Backend (API) | **Node.js + Fastify + TypeScript** | Rápido, ligero, buen soporte de validación y OpenAPI |
| Validación | **Zod** (compartido front/back) | Un solo esquema valida formularios y peticiones: seguridad + menos errores |
| Base de datos | **PostgreSQL** | Relacional, robusta, gratis en local (Docker) y en la nube (capas gratuitas) |
| ORM | Prisma | Modelo de datos legible y migraciones versionadas |
| Autenticación | Sesiones con cookie segura (HttpOnly, SameSite) + hash Argon2 | Más seguro que guardar tokens en el navegador |
| Pruebas | Vitest (unitarias), Playwright (extremo a extremo) | Rápidas, en TypeScript |
| Calidad | ESLint + Prettier + Husky (hooks de Git) | Estilo y errores atrapados antes del commit |
| CI/CD | GitHub Actions | Gratis para repos personales; prueba y escanea en cada PR |
| Contenedores | Docker / Docker Compose | Mismo entorno en tu PC y en producción |

## Arquitectura

```
monorepo/
├── apps/
│   ├── web/        → React (lo que ve el usuario)
│   └── api/        → Fastify (reglas de negocio, seguridad, datos)
│       └── src/modules/   → un módulo por funcionalidad:
│           auth/  workspaces/  projects/  tasks/  reports/  integrations/
├── packages/
│   └── shared/     → esquemas Zod y tipos usados por web y api
├── docs/           → acta, ADRs, backlog
└── docker-compose.yml → PostgreSQL local
```

**Monolito modular:** una sola API, pero dividida en módulos independientes. Es lo recomendado para equipos pequeños: más simple que microservicios y, si un módulo crece mucho, se puede separar después.

**Integración con otras apps (preparada desde el inicio):**
- API versionada `/api/v1/...` documentada con OpenAPI (Swagger).
- Tokens de API por aplicación externa, con permisos limitados.
- Webhooks/eventos (`project.created`, `task.completed`) para avisar a otras apps sin acoplarlas.

## Seguridad desde el día 1 (OWASP Top 10)
- Secretos solo en `.env` (excluido de Git) y en variables del hosting; escaneo con gitleaks.
- Validación de toda entrada con Zod; consultas parametrizadas (Prisma) contra inyección SQL.
- Control de acceso por rol en cada endpoint (no solo ocultar botones en el frontend).
- Cabeceras de seguridad (helmet), CORS restringido, límite de peticiones (rate limiting).
- Dependabot + `pnpm audit` en CI; rama `main` protegida (solo vía Pull Request).

## Alternativas consideradas
- **Next.js (full-stack):** más rápido al inicio, pero mezcla frontend y API; menos claro para exponer la API a otras apps.
- **NestJS:** excelente estructura, pero más pesado y con más conceptos para aprender al inicio.
- **SQLite:** más simple, pero limitado para varios usuarios concurrentes y en la nube.

## Consecuencias
- (+) Un lenguaje, tipos compartidos, portable, listo para integraciones.
- (−) Más piezas que un prototipo de un solo archivo; requiere instalar Node, pnpm, Docker y Git.
- El hosting gratuito se elegirá en el Sprint 3 (sus condiciones cambian seguido; se verificará en ese momento).
