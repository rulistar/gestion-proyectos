# Product Backlog

> Lista priorizada de todo lo que el producto debe hacer. La ordena el **Product Owner**. Nada entra al desarrollo sin estar aquí (acta, riesgo "crecimiento desordenado del alcance").
> Última actualización: 2026-10-23 (planificación del Sprint 1).

## Cómo leer este documento

- **HU** = historia de usuario: _Como [rol], quiero [acción], para [beneficio]_.
- **TEC** = habilitador técnico: trabajo que el usuario no ve, pero que hace posibles las historias.
- **RNF** = requisito no funcional: regla que aplica a todo el sistema.
- **Puntos** = esfuerzo relativo (1, 2, 3, 5, 8), no horas.
- **Prioridad (MoSCoW):** 🔴 Imprescindible (_Must_) · 🟡 Importante (_Should_) · 🟢 Deseable (_Could_).

## Decisiones del Product Owner (2026-10-23)

| Tema | Decisión |
|---|---|
| Registro | **Solo por invitación.** El primer Admin se crea con un comando de instalación. |
| Roles | **Por workspace** (Admin, Miembro, Lector). Un usuario puede tener roles distintos en workspaces distintos. |
| Permisos | **Roles + ajustes por usuario:** cada rol trae permisos por defecto; el Admin puede quitar o añadir permisos puntuales a un usuario. |
| Visibilidad | Proyectos **públicos** (los ve todo el workspace) o **restringidos** (solo los usuarios elegidos). Los Admin ven todo. |
| Borrado | **Lógico** (papelera, restaurable) y **físico** (definitivo), este último **solo desde la papelera** y con confirmación. Solo Admin. |
| Trazabilidad | Todo registro guarda quién y cuándo lo creó, modificó y borró (RNF-01). |
| HTTPS | Obligatorio en **producción**. En desarrollo local se usa HTTP en `localhost`. |
| Exportación | **JSON y CSV compatible con Excel** (como el prototipo; sin dependencias nuevas). |
| Prototipo | El MVP generaliza el prototipo "Gestor de cursos": curso → proyecto, unidad → fase, actividad → tarea. Detalle en ADR-0002 §1.1. |
| Campos | "Plataforma" pasa a ser **Área** (texto libre). Tareas con **estados** Pendiente / En curso / Hecha y **tipos genéricos** (Tarea, Reunión, Entregable, Revisión, Investigación, Examen). |
| Integración | Con la futura app de estudio (gestor de cursos + Lexika), **en ambas direcciones** (API + webhooks). Diseño en ADR-0002 §7. |
| Capacidad | 5–10 h/semana → unos **21 puntos por sprint** de 2 semanas. |

## Requisitos no funcionales (aplican a todas las historias)

| ID | Requisito |
|---|---|
| **RNF-01** | **Trazabilidad:** toda entidad guarda `createdById`, `createdAt`, `updatedById`, `updatedAt`; si admite borrado lógico, también `deletedById` y `deletedAt`. |
| **RNF-02** | **Autorización en el backend:** cada endpoint verifica la membresía del usuario en el workspace, su rol, sus permisos y la visibilidad del recurso. Ocultar botones en la web no cuenta como seguridad. |
| **RNF-03** | **Validación:** toda entrada externa se valida con un esquema Zod de `packages/shared`. |
| **RNF-04** | **HTTPS en producción** con HSTS; cookies de sesión `HttpOnly` + `Secure` + `SameSite`. |
| **RNF-05** | **Los registros borrados lógicamente no aparecen** en listados, búsquedas, exportaciones ni gráficas, salvo en la papelera. |

> La **Definición de Terminado** del acta se amplía: una historia no está terminada si incumple algún RNF.

## Backlog priorizado

| Orden | ID | Historia | Épica | Pts | Prioridad | Sprint |
|---|---|---|---|---|---|---|
| 1 | TEC-01 | Modelo de datos con Prisma y migraciones (ADR-0002), incluido RNF-01, borrado lógico, membresías y permisos | Plataforma | 8 | 🔴 | 1 |
| 2 | TEC-02 | Seguridad HTTP: helmet, CORS restringido, límite de peticiones, HTTPS/HSTS en producción | Plataforma | 3 | 🔴 | 1 |
| 3 | TEC-07 | Comando de instalación para crear el primer Admin | Usuarios | 2 | 🔴 | 1 |
| 4 | HU-02 | Iniciar y cerrar sesión de forma segura | Usuarios | 5 | 🔴 | 1 |
| 5 | TEC-03 | Base del frontend: rutas, layout, TanStack Query, shadcn/ui | Plataforma | 3 | 🔴 | 1 |
| 6 | HU-03 | Crear un espacio de trabajo | Workspaces | 3 | 🔴 | 1 |
| 7 | HU-04 | Invitar miembros con un rol (permisos por defecto del rol) | Workspaces | 5 | 🔴 | 2 |
| 8 | HU-01 | Aceptar una invitación y crear mi contraseña | Usuarios | 3 | 🔴 | 2 |
| 9 | HU-05 | Crear y editar proyectos (fechas, estado, prioridad, clasificación) | Proyectos | 5 | 🔴 | 2 |
| 10 | HU-08 | Crear y asignar tareas, y moverlas entre Pendiente, En curso y Hecha | Tareas | 5 | 🔴 | 2 |
| 11 | HU-06 | Ver % de avance, minutos pendientes y días restantes | Proyectos | 3 | 🔴 | 2 |
| 12 | HU-09 | Tabla de proyectos con filtros (área, clasificación, estado, prioridad, fecha fin) | Vistas | 5 | 🔴 | 3 |
| 13 | HU-10 | Tablero Kanban de proyectos por estado | Vistas | 5 | 🔴 | 3 |
| 14 | HU-16 | Restringir qué proyectos ve cada usuario | Permisos | 5 | 🔴 | 3 |
| 15 | HU-07 | Dividir un proyecto en fases o entregables | Proyectos | 3 | 🟡 | 3 |
| 16 | TEC-04 | Despliegue gratuito en la nube con HTTPS | Plataforma | 5 | 🔴 | 3 |
| 17 | HU-17 | Activar o desactivar acciones concretas por usuario | Permisos | 8 | 🟡 | 4 |
| 18 | HU-15 | Papelera: borrado lógico, restaurar y borrado definitivo | Datos | 5 | 🟡 | 4 |
| 19 | HU-13 | Exportar datos en JSON y CSV compatible con Excel | Respaldo | 3 | 🟡 | 4 |
| 20 | HU-11 | Vista de detalle del proyecto | Vistas | 3 | 🟡 | 4 |
| 21 | TEC-05 | Documentación OpenAPI (Swagger) | Plataforma | 3 | 🟡 | 5 |
| 22 | TEC-06 | Pruebas extremo a extremo con Playwright | Plataforma | 3 | 🟡 | 5 |
| 23 | HU-12 | Gráficas por mes de término y por estado | Reportes | 5 | 🟢 | 5 |
| 24 | HU-14 | Importar desde JSON o CSV (actualizar o reemplazar), incluidos los respaldos del prototipo | Respaldo | 8 | 🟢 | 6 |
| 25 | TEC-08 | Apps externas: `ApiClient`, usuario de servicio y tokens de API | Integraciones | 5 | 🟡 | 7 |
| 26 | HU-18 | Vincular un proyecto, fase o tarea con un recurso de otra app (curso, unidad, actividad) | Integraciones | 3 | 🟡 | 7 |
| 27 | TEC-09 | Avisos salientes: Outbox + webhooks firmados con reintentos | Integraciones | 8 | 🟡 | 7 |
| 28 | TEC-10 | Avisos entrantes: webhook firmado e idempotente | Integraciones | 5 | 🟡 | 8 |
| 29 | HU-19 | Que el avance en la app de estudio complete automáticamente las tareas vinculadas | Integraciones | 3 | 🟡 | 8 |
| 30 | HU-20 | Crear fases y tareas de un proyecto a partir de las unidades y actividades de un curso | Integraciones | 5 | 🟢 | 8 |

**MVP (objetivo 1 del acta, cierre del Sprint 3):** usuarios con invitación, workspaces, proyectos, tareas, tabla, Kanban, visibilidad y despliegue.

**Backlog futuro (acta):** Gantt, registro de riesgos, interesados, bitácora de auditoría, notificaciones. (Tokens de API, webhooks e integración con la app de estudio ya están en la épica Integraciones, del 25 al 30.)

---

## Detalle de historias

### Sprint 1

#### TEC-01 · Modelo de datos con Prisma (8 pts)

Primero se documenta y se aprueba el diseño en **ADR-0002**, y después se implementa.

Criterios de aceptación:

- [x] ADR-0002 aprobado por el PO: entidades, relaciones, permisos y borrado lógico.
- [x] Prisma instalado en `apps/api`; `DATABASE_URL` validada en `config/env.ts`.
- [x] Entidades iniciales: `User`, `Workspace`, `Membership` (usuario + workspace + rol), `Session`.
- [x] El diseño contempla, aunque se implementen después: ajustes de permisos por usuario (HU-17), proyectos restringidos (HU-16) e invitaciones (HU-04).
- [x] RNF-01 en todas las entidades; `deletedAt` y `deletedById` donde aplique el borrado lógico.
- [x] Migración versionada aplicada con `pnpm --filter @gestion/api db:migrate`.
- [x] El CI levanta PostgreSQL como servicio y ejecuta las pruebas de integración contra él.

#### TEC-02 · Seguridad HTTP (3 pts)

- [x] Cabeceras de seguridad (helmet), con HSTS activo solo en producción.
- [x] En producción, toda petición HTTP se redirige a HTTPS (respetando el proxy del hosting).
- [x] CORS limitado a los orígenes de una variable de entorno (`CORS_ORIGINS`).
- [x] Límite de peticiones global, y uno más estricto en el login (`authRateLimit`, se aplica a la ruta en HU-02).
- [x] Pruebas que verifican las cabeceras y el límite.

#### TEC-07 · Crear el primer Admin (2 pts)

- [x] Comando `pnpm --filter @gestion/api setup:admin` que pide nombre, correo y contraseña de forma **interactiva** (la contraseña no queda en el historial de la terminal ni se muestra en pantalla).
- [x] Solo funciona si todavía no existe ningún usuario; si no, se niega y lo explica.
- [x] La contraseña cumple la política mínima (12+ caracteres) y se guarda con hash Argon2id.
- [x] Crea también el workspace inicial **"workpers"** con el Admin como miembro (decisión del PO).

#### HU-02 · Iniciar y cerrar sesión (5 pts)

_Como usuario, quiero iniciar y cerrar sesión de forma segura, para proteger mi información._

- [ ] Inicio de sesión con correo y contraseña; contraseña verificada con Argon2id.
- [ ] Sesión guardada en la base de datos; el navegador solo recibe una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- [ ] Se genera un ID de sesión nuevo en cada inicio de sesión.
- [ ] Mensaje de error **genérico** ("correo o contraseña incorrectos"), para no revelar si un correo existe.
- [ ] Límite de intentos fallidos por IP y correo.
- [ ] Cerrar sesión invalida la sesión **en el servidor**, no solo en el navegador.
- [ ] La sesión expira por inactividad; el tiempo se configura por variable de entorno.
- [ ] `GET /api/v1/auth/me` devuelve el usuario actual, o `401` sin sesión.
- [ ] Pantalla de inicio de sesión en la web.

#### TEC-03 · Base del frontend (3 pts)

- [ ] Enrutador con rutas públicas (login) y protegidas (redirigen al login sin sesión).
- [ ] Layout base: barra superior con usuario y cierre de sesión, y área de contenido.
- [ ] TanStack Query configurado para las llamadas a la API.
- [ ] shadcn/ui inicializado con los primeros componentes (botón, input, formulario).

#### HU-03 · Crear un espacio de trabajo (3 pts)

_Como usuario, quiero crear un espacio de trabajo, para organizar mis proyectos._

- [ ] Formulario con nombre, validado con un esquema compartido.
- [ ] Quien lo crea queda como **Admin** de ese workspace.
- [ ] Listado de "mis workspaces", donde solo aparecen aquellos de los que soy miembro.
- [ ] Cumple RNF-01 (queda registrado quién lo creó y cuándo).

### Sprints siguientes (criterios por detallar en su planificación)

- **HU-04 · Invitar miembros:** el Admin genera una invitación con correo y rol; enlace de un solo uso con caducidad; aplica los permisos por defecto del rol.
- **HU-01 · Aceptar invitación:** la persona invitada abre el enlace, define su contraseña y queda como miembro con el rol asignado.
- **HU-15 · Papelera:** borrar lleva a la papelera (lógico); el Admin restaura o borra definitivamente desde ella, confirmando con el nombre del registro; el borrado definitivo de un proyecto incluye sus fases y tareas.
- **HU-16 · Visibilidad:** un proyecto puede marcarse como restringido, con una lista de usuarios autorizados; los demás no lo ven en ninguna vista, búsqueda ni exportación.
- **HU-17 · Permisos por usuario:** catálogo de permisos (crear, editar, borrar, exportar, importar...); cada rol trae valores por defecto y el Admin los ajusta por usuario.
- **HU-13 · Exportar:** JSON (respaldo completo) y CSV con BOM UTF-8 (una fila por tarea, compatible con el formato del prototipo); respeta la visibilidad y excluye lo borrado. Sin dependencias nuevas.
- **HU-14 · Importar:** JSON o CSV, incluidos los respaldos del prototipo; "Actualizar" busca coincidencias por ID o, si no hay, por nombre sin distinguir mayúsculas; "Reemplazar" pide doble confirmación y manda lo anterior a la papelera; fechas normalizadas a AAAA-MM-DD (ambiguas = día/mes/año).
- **Integraciones (TEC-08 a HU-20):** diseño en ADR-0002 §7.
