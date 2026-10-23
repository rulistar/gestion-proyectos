# Guía didáctica: la estructura base del proyecto

> Documento de aprendizaje (Sprint 0, 2026-10-22). Explica **qué** se construyó, **para qué** sirve cada pieza y **por qué** se hizo así. Es tuyo: edítalo, agrega notas y dudas.

---

## 1. La idea en una frase

Construimos los **cimientos** de la aplicación: todavía no hay funcionalidades (ni usuarios, ni proyectos, ni tareas), pero ya existe el "edificio vacío" con su estructura, instalaciones eléctricas y sistema contra incendios, listo para empezar a levantar habitaciones (módulos).

**Analogía:** es como una obra en construcción.

| En la obra                        | En el proyecto                                     |
| --------------------------------- | -------------------------------------------------- |
| El terreno y los planos           | El monorepo y el ADR-0001                          |
| La fachada (lo que ve la gente)   | `apps/web` (React)                                 |
| La sala de máquinas               | `apps/api` (Fastify)                               |
| Las normas de construcción comunes | `packages/shared` (esquemas Zod)                  |
| La bodega donde se guardan cosas  | PostgreSQL (base de datos en Docker)               |
| El inspector de obra              | ESLint, Prettier, TypeScript, pruebas, CI          |
| La caja fuerte                    | El archivo `.env` (secretos fuera de Git)          |

---

## 2. El mapa del proyecto

```
Gestion-Proyectos/
├── apps/
│   ├── web/               ← La fachada: lo que el usuario ve en el navegador
│   └── api/               ← La sala de máquinas: reglas, seguridad y datos
├── packages/
│   └── shared/            ← Reglas comunes que usan web y api
├── docs/                  ← Acta, ADRs y esta guía
├── .github/               ← Automatizaciones de GitHub (CI, Dependabot)
├── .husky/                ← "Portero" que revisa antes de cada commit
├── docker-compose.yml     ← Receta para levantar PostgreSQL
├── .env.example           ← Plantilla de variables (sin secretos reales)
├── .env                   ← Tus secretos reales (NUNCA se sube a Git)
├── CLAUDE.md              ← Memoria del proyecto para Claude Code
└── README.md              ← Cómo levantar el proyecto
```

### ¿Qué es un "monorepo"?

Un **solo repositorio** que contiene varios proyectos relacionados. La alternativa sería tener tres repos separados (web, api, shared).

**¿Por qué así?** Porque si cambias, por ejemplo, cómo se define una "tarea", el cambio se ve **a la vez** en la web y en la API. Con repos separados tendrías que publicar el cambio en uno y actualizarlo en el otro, y es fácil que queden desincronizados.

**pnpm workspaces** es la herramienta que permite que esos proyectos convivan y se usen entre sí. El archivo `pnpm-workspace.yaml` le dice a pnpm: "los paquetes están en `apps/*` y `packages/*`".

---

## 3. Cada pieza explicada

### 3.1 `apps/api` — La sala de máquinas (Fastify)

Es el **servidor**: recibe peticiones, aplica reglas y responde. Hoy solo tiene un endpoint:

```
GET /api/v1/health  →  {"status":"ok","uptime":2.19,"timestamp":"2026-10-23T05:22:40Z"}
```

Es como preguntarle a la API "¿estás viva?". Los servicios de hosting y monitoreo lo usan para saber si deben reiniciarla.

**Archivos clave:**

| Archivo                               | Qué hace                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app.ts`                          | **Arma** la API (registra módulos) pero **no** la enciende.                                   |
| `src/server.ts`                       | **Enciende** la API en un puerto y la apaga ordenadamente.                                    |
| `src/config/env.ts`                   | Revisa las variables de entorno con Zod. Si algo está mal, la API se niega a arrancar.       |
| `src/modules/health/health.routes.ts` | La ruta `/health`.                                                                            |
| `src/modules/health/health.test.ts`   | La prueba automática de esa ruta.                                                             |

💡 **¿Por qué separar `app.ts` de `server.ts`?** Para poder **probar** la API sin encenderla de verdad. Las pruebas usan `app.inject()`, que simula una petición en memoria: más rápido y sin depender de puertos libres.

💡 **¿Por qué `/api/v1/`?** El `v1` es la **versión**. Cuando otra app (como tu app de estudio) dependa de esta API y necesitemos cambiar algo de forma incompatible, crearemos `/api/v2/` sin romper a quien usa `v1`.

💡 **"Monolito modular":** una sola API, pero organizada en carpetas independientes dentro de `src/modules/` (`health` hoy; luego `auth`, `projects`, `tasks`...). Cada módulo es como una habitación con su propia puerta.

### 3.2 `apps/web` — La fachada (React + Vite + Tailwind)

Es lo que se ve en el navegador. Hoy muestra una sola pantalla: _"Estado de la API: conectada"_.

| Herramienta  | Rol                                                                                |
| ------------ | ---------------------------------------------------------------------------------- |
| **React**    | Construye la interfaz con componentes (piezas reutilizables).                      |
| **Vite**     | Servidor de desarrollo ultrarrápido y empaquetador para producción.                |
| **Tailwind** | Estilos con clases como `text-3xl font-bold` directamente en el HTML.              |

💡 **El proxy de Vite** (en `vite.config.ts`): cuando la web pide `/api/...`, Vite lo reenvía a la API en el puerto 3000. Así el navegador cree que todo viene del mismo sitio, y nos ahorramos problemas de CORS y de cookies (importante cuando hagamos el login).

### 3.3 `packages/shared` — Las reglas comunes (Zod)

Aquí viven los **esquemas**: descripciones de cómo deben verse los datos.

```ts
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

De **un solo esquema** salen dos cosas:

1. **Un validador** (se ejecuta mientras la app corre): `healthResponseSchema.parse(datos)` lanza un error si los datos no cumplen.
2. **Un tipo de TypeScript** (se revisa al escribir código): `HealthResponse`. Si escribes mal un campo, el editor te avisa antes de ejecutar nada.

La API usa el tipo para garantizar que responde bien; la web usa el validador para comprobar lo que recibe. **Una sola fuente de verdad** → menos errores y más seguridad.

### 3.4 PostgreSQL en Docker — La bodega

**Docker** ejecuta programas dentro de "contenedores": cajas aisladas con todo lo que necesitan. En vez de instalar PostgreSQL en Windows, Docker lo descarga y lo ejecuta en su caja.

`docker-compose.yml` es la **receta** de esa caja:

- Imagen: `postgres:17-alpine` (PostgreSQL 17, versión ligera).
- Credenciales: se leen de `.env` con `${POSTGRES_PASSWORD}`. **No hay contraseñas escritas en el archivo.** Si falta alguna, Docker se niega a arrancar con un mensaje claro.
- Puerto: `127.0.0.1:5432` → solo tu PC puede conectarse; otros equipos de tu red no.
- Volumen `postgres-data`: los datos se guardan fuera del contenedor, así sobreviven aunque lo detengas o lo borres.
- Healthcheck: Docker pregunta cada 5 s "¿estás listo?" (`pg_isready`) y marca el contenedor como _healthy_.

Hoy la API **todavía no usa** la base de datos: eso llegará con Prisma en una historia futura.

### 3.5 `.env` y `.env.example` — La caja fuerte y su plantilla

| Archivo        | ¿Se sube a Git? | Contenido                                       |
| -------------- | --------------- | ----------------------------------------------- |
| `.env.example` | ✅ Sí           | Nombres de variables con valores **ficticios**. |
| `.env`         | ❌ Nunca        | Tus valores **reales** (contraseñas, etc.).     |

El `.gitignore` impide que `.env` llegue al repositorio. Lo verificamos con `git check-ignore -v .env`.

⚠️ **Lección aprendida:** PostgreSQL fija la contraseña **la primera vez** que crea la base de datos. Si la cambias después en `.env`, no se actualiza sola: hay que borrar el volumen (`docker compose down -v`, que **elimina los datos**) y recrearlo.

---

## 4. Los "inspectores de calidad"

Estas herramientas no agregan funcionalidades: **atrapan errores antes de que lleguen a producción**.

| Herramienta                | Pregunta que responde                                  | Archivo de configuración          |
| -------------------------- | ------------------------------------------------------ | --------------------------------- |
| **TypeScript (estricto)**  | ¿Los tipos de datos encajan?                           | `tsconfig.base.json` + uno por paquete |
| **ESLint**                 | ¿Hay errores lógicos o malas prácticas?                | `eslint.config.js`                |
| **Prettier**               | ¿El código tiene un formato uniforme?                  | `.prettierrc.json`, `.prettierignore` |
| **Vitest**                 | ¿El código hace lo que debe?                           | `apps/api/vitest.config.ts`       |
| **EditorConfig**           | ¿El editor usa los mismos espacios y finales de línea? | `.editorconfig`                   |
| **.gitattributes**         | ¿Windows y Linux guardan los archivos igual?           | `.gitattributes`                  |

💡 **"Estricto"** significa que TypeScript activa revisiones extra. Por ejemplo, `noUncheckedIndexedAccess` te obliga a considerar que `lista[5]` podría no existir. Molesta un poco al principio, pero evita muchos errores reales.

### La cadena de protección (de tu PC a producción)

```
 Tú escribes código
        │
        ▼
 git commit ──► Husky + lint-staged (en tu PC)
        │        • ESLint y Prettier sobre los archivos que cambiaste
        │        • Si hay errores, el commit NO se crea
        ▼
 git push + Pull Request ──► GitHub Actions (en la nube)
        │        • Formato, lint, tipos, pruebas y build
        │        • pnpm audit: ¿alguna dependencia tiene vulnerabilidades altas?
        │        • gitleaks: ¿se coló alguna contraseña o llave?
        ▼
 Merge a main (solo si todo está en verde)
```

- **Husky** instala "ganchos" (hooks) de Git: scripts que se ejecutan en ciertos momentos, como antes de cada commit (`.husky/pre-commit`).
- **lint-staged** hace que ese gancho revise solo los archivos que cambiaste, no todo el proyecto (más rápido).
- **GitHub Actions** (`.github/workflows/ci.yml`) repite todo en un servidor limpio. Así, si en tu PC "funciona por casualidad", aquí se descubre.
- **Dependabot** (`.github/dependabot.yml`) abre cada semana Pull Requests para actualizar dependencias.

---

## 5. Seguridad desde el día 1

| Riesgo                                     | Qué lo previene                                           |
| ------------------------------------------ | --------------------------------------------------------- |
| Subir una contraseña a GitHub              | `.gitignore` + gitleaks (en CI y probado localmente)      |
| Usar una librería con vulnerabilidades     | `pnpm audit` en CI + Dependabot                           |
| Configuración incorrecta en producción     | `env.ts` valida variables con Zod al arrancar             |
| Base de datos expuesta en la red local     | Puerto ligado a `127.0.0.1`                               |
| Paquetes maliciosos que ejecutan código al instalarse | pnpm bloquea scripts de instalación; solo se autorizó `esbuild` (`allowBuilds` en `pnpm-workspace.yaml`) |
| Permisos excesivos en CI                   | El workflow solo tiene permiso de **lectura** (`contents: read`) |

Las reglas completas están en `CLAUDE.md`, sección "Reglas de seguridad".

---

## 6. Problemas que aparecieron y cómo se resolvieron

Esta es quizá la parte más valiosa: así se ve el trabajo real.

### Problema 1: Windows bloqueó Vite 8

- **Síntoma:** las pruebas fallaban con _"Cannot find native binding"_.
- **Investigación:** al cargar el archivo a mano apareció el error real: _"An Application Control policy has blocked this file"_.
- **Causa:** tu Windows 11 tiene **Smart App Control** activo y bloquea el binario nativo de _rolldown_, el motor de Vite 8.
- **Diagnóstico:** se probaron uno por uno los binarios nativos del proyecto. Solo rolldown estaba bloqueado. El motor de Vite 7 (_rollup_) sí cargaba.
- **Solución:** usar **Vite 7** (sigue siendo "Vite", como dice el ADR). Sin dependencias nuevas y sin desactivar la seguridad de tu PC. Dependabot está configurado para no proponer Vite 8.
- **Lección:** cuando un error es confuso, hay que buscar el error **original** (la "causa raíz"); no te quedes con el primer mensaje.

### Problema 2: TypeScript 7 incompatible

- **Causa:** typescript-eslint (el puente entre ESLint y TypeScript) aún exige TypeScript menor a 6.1.
- **Solución:** fijar TypeScript en `~6.0.3`.
- **Lección:** la versión "más nueva" no siempre es la correcta; importa que **todo el conjunto** sea compatible.

### Problema 3: pnpm bloqueó un script de instalación

- **Causa:** por seguridad, pnpm no deja que los paquetes ejecuten código al instalarse.
- **Solución:** autorizar **solo** `esbuild` (lo necesita `tsx`) con `pnpm approve-builds esbuild`.

### Problema 4: Prettier quería reformatear el acta y el ADR

- **Solución:** excluir `docs/` del formateo automático, porque son documentos formales que solo cambian por decisión explícita.

### Problema 5: procesos "huérfanos" en Windows

- **Síntoma:** al detener `pnpm dev`, los puertos 3000 y 5173 seguían ocupados.
- **Causa:** en Windows, detener el proceso padre (`pnpm`) no siempre detiene a sus hijos (`tsx`, `vite`).
- **Solución:** identificarlos por puerto y cerrarlos (ver la sección 8).

---

## 7. ¿Cómo viaja una petición? (de punta a punta)

Cuando abres http://localhost:5173:

```
1. Navegador ──► Vite (:5173) entrega la página de React
2. React ejecuta fetch('/api/v1/health')
3. Vite ve "/api" y reenvía la petición (proxy) ──► API Fastify (:3000)
4. Fastify encuentra la ruta /api/v1/health (módulo health)
5. Responde {"status":"ok", ...} (con el tipo HealthResponse de shared)
6. React valida la respuesta con healthResponseSchema (de shared)
7. Si es válida, muestra "conectada" en verde
```

Fíjate en que `shared` participa **dos veces**: en el paso 5 (API) y en el 6 (web). Eso es el monorepo funcionando.

---

## 8. Comandos del día a día

Todos se ejecutan desde la carpeta raíz del proyecto.

### Arrancar a trabajar

```bash
pnpm db:up             # 1. Enciende PostgreSQL
docker compose ps      #    Espera a que diga "healthy"
pnpm dev               # 2. Enciende API (:3000) y web (:5173)
```

### Terminar de trabajar

```bash
# En la terminal donde corre pnpm dev:
Ctrl + C               # 1. Detiene API y web
pnpm db:down           # 2. Detiene PostgreSQL (los datos se conservan)
```

Si al volver a arrancar dice que el puerto 3000 o el 5173 está ocupado (procesos huérfanos), en PowerShell:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,5173 | Select-Object LocalPort, OwningProcess
Stop-Process -Id <número_de_OwningProcess>
```

### Verificar que todo está bien (antes de un commit o PR)

```bash
pnpm format:check      # ¿Formato correcto?
pnpm lint              # ¿Sin errores de ESLint?
pnpm typecheck         # ¿Tipos correctos?
pnpm test              # ¿Pasan las pruebas?
pnpm build             # ¿Compila todo?
```

### Otros útiles

```bash
pnpm format                              # Formatea todo automáticamente
pnpm lint:fix                            # Corrige lo que ESLint pueda corregir solo
pnpm --filter @gestion/api test:watch    # Pruebas que se repiten al guardar
pnpm --filter @gestion/web add <pkg>     # Agregar una librería a la web
git status                               # ¿Qué cambió?
git log --oneline                        # Historial de commits
```

---

## 9. Mini glosario

| Término            | Significado sencillo                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| **Endpoint**       | Una "dirección" de la API que responde algo (ej. `/api/v1/health`).           |
| **Dependencia**    | Librería de terceros que usa el proyecto (está en `package.json`).            |
| **Lockfile**       | `pnpm-lock.yaml`: congela las versiones exactas para que todos instalen lo mismo. |
| **Esquema (Zod)**  | Descripción de cómo deben verse unos datos; sirve para validarlos.           |
| **Tipo (TS)**      | Etiqueta que dice qué forma tiene un dato; se revisa al escribir código.     |
| **Contenedor**     | Programa aislado en una "caja" con todo lo que necesita (Docker).            |
| **Volumen**        | Carpeta de Docker donde los datos persisten aunque el contenedor se borre.   |
| **Hook de Git**    | Script que se ejecuta automáticamente en un momento de Git (ej. antes del commit). |
| **CI**             | Integración Continua: revisión automática en la nube en cada cambio.         |
| **Pull Request**   | Propuesta de cambio que se revisa antes de unirla a `main`.                  |
| **Proxy**          | Intermediario que reenvía peticiones de un lugar a otro.                     |
| **Variable de entorno** | Configuración que se pasa a un programa desde fuera del código (`.env`). |
| **ADR**            | Registro de una decisión de arquitectura y su porqué.                        |

---

## 10. Estado actual y siguientes pasos

**Hecho ✅**

- Monorepo con web, api y shared conectados y probados.
- PostgreSQL funcionando en Docker con tus credenciales.
- Calidad automatizada (hook local + CI).
- Primer commit en la rama `main`.

**Pendiente ⏳**

1. Crear el repositorio en GitHub y subir el código (`git remote add origin <url>` y `git push -u origin main`).
2. Proteger la rama `main` en GitHub (Settings → Branches): exigir Pull Request y CI en verde.
3. Sprint 1: primeras historias de usuario. Ahí entrarán Prisma (base de datos), autenticación, helmet/CORS/rate-limit, etc.

---

## Mis notas

_Escribe aquí tus dudas, descubrimientos o cosas que quieras repasar._

-
