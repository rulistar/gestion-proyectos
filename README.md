# Gestor de Proyectos

Aplicación web para gestionar proyectos personales y de un equipo pequeño. Monorepo con frontend React, API Fastify y esquemas compartidos con Zod.

- Alcance y objetivos: [docs/00-acta-proyecto.md](docs/00-acta-proyecto.md)
- Decisiones de arquitectura: [docs/adr/](docs/adr/)

## Requisitos

| Herramienta    | Versión  | Verificar          |
| -------------- | -------- | ------------------ |
| Node.js        | 24+      | `node -v`          |
| pnpm           | 12+      | `pnpm -v`          |
| Docker Desktop | reciente | `docker --version` |
| Git            | reciente | `git --version`    |

## Levantar el proyecto en local

```bash
# 1. Instalar dependencias (también activa los hooks de Git)
pnpm install

# 2. Crear tu archivo de variables de entorno y cambiar la contraseña
cp .env.example .env

# 3. Levantar PostgreSQL en Docker
pnpm db:up

# 4. Crear las tablas (aplica las migraciones)
pnpm db:migrate

# 5. Crear el primer administrador (solo una vez; pide nombre, correo y contraseña)
pnpm setup:admin

# 6. Arrancar API y web en modo desarrollo
pnpm dev
```

- Web: http://localhost:5173 (debe mostrar "Estado de la API: conectada")
- API: http://localhost:3000/api/v1/health

Para detener: `Ctrl+C` en la terminal de `pnpm dev`, y `pnpm db:down` para la base de datos (los datos se conservan).

## Scripts

| Comando             | Qué hace                                            |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | API y web en paralelo con recarga automática        |
| `pnpm test`         | Ejecuta las pruebas (Vitest); requiere `pnpm db:up` |
| `pnpm lint`         | Revisa el código con ESLint                         |
| `pnpm format`       | Formatea con Prettier                               |
| `pnpm typecheck`    | Verifica tipos de TypeScript                        |
| `pnpm build`        | Compila todos los paquetes                          |
| `pnpm db:up / down` | Inicia / detiene PostgreSQL                         |
| `pnpm db:migrate`   | Crea o aplica migraciones de la base de datos       |
| `pnpm db:studio`    | Abre un explorador visual de la base de datos       |
| `pnpm db:reset`     | ⚠️ Borra y recrea la base de datos de desarrollo    |
| `pnpm setup:admin`  | Crea el primer Admin (solo en una BD sin usuarios)  |

## Estructura

```
apps/web         Frontend React + Vite + Tailwind
apps/api         API Fastify (monolito modular, rutas en /api/v1)
packages/shared  Esquemas Zod y tipos compartidos
docs/            Acta del proyecto y ADRs
```

## Flujo de trabajo

1. Crear una rama desde `main`: `git switch -c feature/nombre-historia`
2. Hacer commits. El hook pre-commit ejecuta ESLint y Prettier sobre los archivos modificados.
3. Abrir un Pull Request. GitHub Actions ejecuta lint, tipos, pruebas, `pnpm audit` y gitleaks.
4. Fusionar a `main` solo con CI en verde.

## Problemas conocidos

- **Windows con Smart App Control**: bloquea el binario nativo de Vite 8 (rolldown). Por eso el proyecto usa Vite 7. Ver [CLAUDE.md](CLAUDE.md).
