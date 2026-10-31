# Product Backlog

> Lista priorizada de todo lo que el producto debe hacer. La ordena el **Product Owner**. Nada entra al desarrollo sin estar aquí (acta, riesgo "crecimiento desordenado del alcance").
> Última actualización: 2026-10-26 (revisión del Sprint 3 y planificación del Sprint 4).

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
| Invitaciones (2026-10-24) | La app muestra un **enlace para copiar** (sin correo automático), de **un solo uso** y válido **48 horas**. |
| Tipos de trabajo (2026-10-24) | Además de proyectos: **mantenimientos** y **actividades sueltas**, con **tipos configurables** por espacio (los define el Admin), tipos de tarea permitidos por tipo y **campos de detalle por tipo**. Todo contenedor y toda tarea guarda **fechas planeadas** (opcionales) y **fechas reales** (automáticas) para estadística. Diseño en [ADR-0004](adr/ADR-0004-tipos-de-trabajo.md); historias HU-21 a HU-23 para el Sprint 3. |
| Revisión del Sprint 2 (2026-10-25) | Tareas con estados **Pausada** (cuenta como pendiente) y **Cancelada** (se descuenta), con **motivo obligatorio**. **Papelera** adelantada al Sprint 3. Al quitar a un miembro, **sus tareas conservan su nombre** (marcado "ya no es miembro") hasta reasignarlas. **Gantt** del proyecto y del espacio. Prioridad: ajustes de la revisión → tipos de trabajo → Gantt y permisos. |
| Rediseño (2026-10-25) | Antes de seguir, **rediseñar la interfaz** según la [maqueta](https://claude.ai/artifact/QkTijPe4GF7EtTePxQHYFR): menú lateral (Proyectos, Mantenimientos, Mi trabajo, Actividades, Gantt), combo **Espacio de trabajo**, color **turquesa matizado** y login con el formulario a la izquierda. El **Admin del sistema ve y entra a todos los espacios**. Nombre provisional: "Gestor de Proyectos". Después, los tipos de trabajo (HU-21, HU-22). |
| Fases (2026-10-25) | Las tareas de un proyecto se agrupan en **fases**, como las tareas resumen de Project: una fase puede contener tareas y otras fases, hasta **4 niveles**. Su avance y sus fechas **se calculan** a partir de lo que contiene. HU-07 se adelanta al Sprint 4, antes de la vista Lista (HU-26) y el Gantt (HU-27), que dependen de ella. |
| Cambiar correos (2026-10-25) | Una persona puede estar en varios espacios, así que el **Admin de un espacio no cambia correos**. Cada usuario cambia su nombre, correo y contraseña en **Mi perfil**, confirmando con su contraseña (HU-29); el **Admin del sistema** puede cambiar el correo de cualquiera y desactivar cuentas (HU-30). Sprint 5. |
| Corrección de HU-35 (2026-10-27) | **Actividad, Gestión y Seguimiento son tipos de tarea** (no responsabilidades). La tarea tiene **un solo Responsable**, elegido del catálogo de personas. |
| Revisión del Sprint 3 (2026-10-26) | Se hizo lo pedido. Nuevos: **Sprint** y **Actividades del sprint** en proyectos y mantenimientos; en cada tarea **Actividad, Gestión y Seguimiento** (una persona cada una; Actividad reemplaza a Responsable); **catálogo de personas por espacio**, con o sin cuenta, vinculables a un usuario para mostrarlo con otro nombre; personas del proyecto desde el catálogo; **tipos de tarea limitados por contenedor**. Diseño en [ADR-0005](adr/ADR-0005-personas-y-responsabilidades.md). Sprint 4: estas historias + HU-32 + HU-09 (28 pts); HU-23 pasa al Sprint 5. |
| Datos del proyecto (2026-10-25) | Los proyectos llevan **Folio** (viene de otro sistema: opcional, editable, puede repetirse), **Descripción**, **Observaciones** (antes "Notas") y personas como **texto libre** (solo el nombre): Solicitante, Asignado a, Project manager, Gte. Consultoría y Business partner. Se hace ya (HU-31). **Mover** proyectos, mantenimientos y tareas **entre espacios**, solo Admin (HU-32, Sprint 4). |
| Revisión del Sprint 4 (2026-10-27) | Se hizo lo pedido (36 pts). "Fin hasta" de la lista de proyectos es la fecha de fin del contenedor; las tareas se consultan en la vista **Tareas** (HU-39). Sprint 5: despliegue, fases, pestaña Lista (reducida a 2 pts), Gantt, Mi perfil, usuarios del sistema y visibilidad (34 pts); HU-23 y HU-17 pasan al Sprint 6. |
| Crear espacios (2026-10-28) | **Solo el Admin del sistema crea espacios de trabajo**; los demás usuarios entran por invitación. La web oculta lo que el perfil no permite (HU-42); los ajustes por persona llegan con HU-17. |
| Permisos por persona (2026-10-28) | Al invitar se configura a cada persona **por espacio**: qué ve (solo lo suyo, todo o una lista), qué crea, qué modifica y qué da de baja y restaura, por proyectos, mantenimientos, actividades y tareas. El rol queda como plantilla. "Mis tareas" = las que creé o donde soy Responsable. Una invitación puede incluir **varios espacios**. Va **antes del despliegue**; Gantt y pestaña Lista pasan al Sprint 6. Diseño en [ADR-0006](adr/ADR-0006-permisos-por-persona.md). |
| Revisión del Sprint 5 (2026-10-30) | Se hizo lo replaneado más lo pedido a mitad del sprint (56 pts); la aplicación está en producción. **HU-50 confirmada** tal como está escrita (ejemplo: Luis, de workpers, compartido con Monex) y pasa al Sprint 7. Sprint 6: **cerrar el MVP**: Gantt, pestaña Lista, campos de detalle por tipo, Kanban de proyectos, exportar y detalle del proyecto (29 pts). Swagger y Playwright pasan al Sprint 7. Se agrega **restablecer contraseñas** (HU-54, 3 pts). |

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
| 12 | HU-24 | Pausar y cancelar tareas con motivo (Pausada cuenta como pendiente; Cancelada se descuenta) | Tareas | 3 | 🔴 | 3 |
| 13 | HU-28 | Rediseño de la interfaz: menú lateral, combo de espacios, Mi trabajo, ventanas y tema turquesa (en 3 entregas: a, b, c) | Plataforma | 15 | 🔴 | 3 |
| 14 | HU-21 | Tipos de contenedor con comportamiento (ADR-0004) | Tipos | 5 | 🔴 | 3 |
| 15 | HU-22 | Tipos de tarea configurables (ADR-0004) | Tipos | 3 | 🔴 | 3 |
| 16 | HU-31 | Datos del proyecto: folio, descripción, observaciones y personas (solicitante, asignado a, PM, Gte. Consultoría, Business partner) | Proyectos | 3 | 🔴 | 3 |
| 17 | HU-15 | Papelera: dar de baja proyectos y tareas, restaurar y borrar definitivamente | Datos | 5 | 🔴 | 3 |
| 18 | HU-25 | Gestionar miembros: cambiar el rol y quitar del espacio | Workspaces | 3 | 🔴 | 3 |
| 19 | HU-33 | Sprint en proyectos y mantenimientos: "Sprint" y "Actividades del sprint" (texto) | Proyectos | 2 | 🔴 | 4 |
| 20 | HU-34 | Catálogo de personas por espacio, con o sin cuenta, vinculables a un usuario (alias) | Personas | 5 | 🔴 | 4 |
| 21 | HU-35 | Responsable (persona del catálogo) y tipos de tarea Actividad, Gestión y Seguimiento | Tareas | 5 | 🔴 | 4 |
| 22 | HU-36 | Personas del proyecto desde el catálogo | Personas | 3 | 🔴 | 4 |
| 23 | HU-37 | Tipos de tarea por contenedor (subconjunto de los de su tipo) | Tipos | 3 | 🔴 | 4 |
| 24 | HU-38 | Folios automáticos: PY, MT y ACT + AAMM + "-" + contador mensual por espacio | Proyectos | 3 | 🔴 | 4 |
| 25 | HU-32 | Mover un proyecto, mantenimiento o tarea a otro espacio de trabajo (solo Admin) | Workspaces | 5 | 🔴 | 4 |
| 26 | HU-09 | Tabla de proyectos con filtros y orden por columna | Vistas | 5 | 🔴 | 4 |
| 27 | HU-39 | Vista "Tareas": todas las tareas del espacio con filtros y orden | Vistas | 5 | 🔴 | 4 |
| 28 | HU-40 | Menú lateral plegable para dar más espacio al contenido | Interfaz | 1 | 🔴 | 5 |
| 29 | HU-41 | Pantallas compactas: más información visible sin desplazarse | Interfaz | 2 | 🔴 | 5 |
| 30 | HU-42 | Ocultar las opciones que el perfil no permite; solo el Admin del sistema crea espacios | Permisos | 1 | 🔴 | 5 |
| 31 | HU-43 | "Sin folio" es el único folio que puede repetirse | Proyectos | 1 | 🔴 | 5 |
| 32 | HU-44 | Personas: borrar definitivamente a quien no se usa y ocultar las archivadas | Personas | 2 | 🔴 | 5 |
| 33 | HU-45 | Personas: ver dónde aparece una persona (tareas y proyectos) para reasignarla | Personas | 1 | 🔴 | 5 |
| 34 | HU-46 | Actividades: columna Fin; Abiertas solo con el menú oculto | Vistas | 1 | 🔴 | 5 |
| 35 | HU-47 | Origen de la tarea: catálogo en Configuración, detalle y filtro | Tareas | 3 | 🔴 | 5 |
| 36 | HU-48 | Mi trabajo: ocultar el panel de proyectos y mantenimientos | Vistas | 1 | 🔴 | 5 |
| 37 | HU-49 | Contenedores de trabajo o personales (ocultar campos del trabajo, N/A al dar de alta) | Proyectos | 2 | 🔴 | 5 |
| 38 | HU-49b | Personales: campos de trabajo ocultos por omisión; menú oculto en contenedores | Proyectos | 1 | 🔴 | 5 |
| 39 | HU-52 | Ver el trabajo de otras personas (filtro en Mi trabajo y permiso por persona) | Permisos | 3 | 🔴 | 5 |
| 40 | HU-53 | Lector solo de trabajo; Miembro ve las tareas de lo que ve | Permisos | 2 | 🔴 | 5 |
| 41 | HU-51 | Fusionar personas duplicadas | Personas | 3 | 🔴 | 5 |
| 42 | HU-17 | Permisos por persona y por espacio: qué ve, crea, modifica y da de baja (incluye HU-16; invitación a varios espacios) | Permisos | 13 | 🔴 | 5 |
| 43 | TEC-04 | Despliegue gratuito en la nube con HTTPS | Plataforma | 5 | 🔴 | 5 |
| 44 | HU-07 | Fases: agrupar las tareas de un proyecto en fases anidadas (hasta 4 niveles), con avance y fechas calculadas | Proyectos | 8 | 🔴 | 5 |
| 45 | HU-29 | Mi perfil: cambiar mi nombre, correo y contraseña | Usuarios | 3 | 🔴 | 5 |
| 46 | HU-30 | Usuarios del sistema: el Admin del sistema cambia correos y desactiva cuentas | Usuarios | 3 | 🔴 | 5 |
| 47 | HU-54 | Restablecer una contraseña olvidada (enlace del Admin del sistema y comando de terminal) | Usuarios | 3 | 🔴 | 6 |
| 48 | HU-27 | Diagrama de Gantt del proyecto y del espacio (planeado contra real) | Vistas | 8 | 🔴 | 6 |
| 49 | HU-26 | Pestaña Lista del proyecto: la tabla de la vista Tareas, agrupada por fase | Vistas | 2 | 🔴 | 6 |
| 50 | HU-23 | Campos de detalle por tipo (ADR-0004) | Tipos | 8 | 🔴 | 6 |
| 51 | HU-10 | Tablero Kanban de proyectos por estado | Vistas | 5 | 🔴 | 6 |
| 52 | HU-13 | Exportar datos en JSON y CSV compatible con Excel | Respaldo | 3 | 🟡 | 6 |
| 53 | HU-11 | Vista de detalle del proyecto | Vistas | 3 | 🟡 | 6 |
| 54 | HU-55 | Filtro por año (abiertos, cerrados o ambos) en las listas de contenedores | Vistas | 3 | 🔴 | 6 |
| 55 | TEC-05 | Documentación OpenAPI (Swagger) | Plataforma | 3 | 🟡 | 7 |
| 56 | TEC-06 | Pruebas extremo a extremo con Playwright | Plataforma | 3 | 🟡 | 7 |
| 57 | HU-50 | Catálogo de personas compartido entre espacios | Personas | 5 | 🟡 | 7 |
| 58 | HU-12 | Gráficas por mes de término y por estado, e indicadores de tiempos (ADR-0004 §2.1) | Reportes | 5 | 🟢 | 7 |
| 59 | HU-14 | Importar desde JSON o CSV (actualizar o reemplazar), incluidos los respaldos del prototipo | Respaldo | 8 | 🟢 | 7 |
| 60 | TEC-08 | Apps externas: `ApiClient`, usuario de servicio y tokens de API | Integraciones | 5 | 🟡 | 7 |
| 61 | HU-18 | Vincular un proyecto, fase o tarea con un recurso de otra app (curso, unidad, actividad) | Integraciones | 3 | 🟡 | 8 |
| 62 | TEC-09 | Avisos salientes: Outbox + webhooks firmados con reintentos | Integraciones | 8 | 🟡 | 8 |
| 63 | TEC-10 | Avisos entrantes: webhook firmado e idempotente | Integraciones | 5 | 🟡 | 8 |
| 64 | HU-19 | Que el avance en la app de estudio complete automáticamente las tareas vinculadas | Integraciones | 3 | 🟡 | 9 |
| 65 | HU-20 | Crear fases y tareas de un proyecto a partir de las unidades y actividades de un curso | Integraciones | 5 | 🟢 | 9 |

**MVP (objetivo 1 del acta):** usuarios con invitación, workspaces, proyectos, tareas, tabla, Kanban, visibilidad y despliegue. Se recorre al **cierre del Sprint 6** por las decisiones del PO en la revisión del Sprint 2 (2026-10-25): estados de tarea, papelera y gestión de miembros primero; luego tipos de trabajo (ADR-0004), Gantt y permisos por usuario.

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

> API (`/api/v1/auth/login`, `/logout`, `/me`) y pantalla de login (en TEC-03).

- [x] Inicio de sesión con correo y contraseña; contraseña verificada con Argon2id.
- [x] Sesión guardada en la base de datos; el navegador solo recibe una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- [x] Se genera un ID de sesión nuevo en cada inicio de sesión.
- [x] Mensaje de error **genérico** ("correo o contraseña incorrectos"), para no revelar si un correo existe.
- [x] Límite de intentos fallidos por IP y correo.
- [x] Cerrar sesión invalida la sesión **en el servidor**, no solo en el navegador.
- [x] La sesión expira por inactividad; el tiempo se configura por variable de entorno.
- [x] `GET /api/v1/auth/me` devuelve el usuario actual, o `401` sin sesión.
- [x] Pantalla de inicio de sesión en la web.

#### TEC-03 · Base del frontend (3 pts)

- [x] Enrutador con rutas públicas (login) y protegidas (redirigen al login sin sesión). TanStack Router, ver ADR-0003.
- [x] Layout base: barra superior con usuario y cierre de sesión, y área de contenido.
- [x] TanStack Query configurado para las llamadas a la API.
- [x] shadcn/ui inicializado con los primeros componentes (botón, input, etiqueta, tarjeta; el formulario usa el esquema Zod compartido, sin react-hook-form).

#### HU-03 · Crear un espacio de trabajo (3 pts)

_Como usuario, quiero crear un espacio de trabajo, para organizar mis proyectos._

- [x] Formulario con nombre, validado con un esquema compartido.
- [x] Quien lo crea queda como **Admin** de ese workspace.
- [x] Listado de "mis workspaces", donde solo aparecen aquellos de los que soy miembro.
- [x] Cumple RNF-01 (queda registrado quién lo creó y cuándo).

### Sprint 2

Orden de trabajo elegido por el PO: HU-05 → HU-08 → HU-06 → HU-04 → HU-01.

#### HU-05 · Crear y editar proyectos (5 pts)

_Como miembro de un workspace, quiero crear y editar proyectos, para organizar mi trabajo con fechas, estado y prioridad._

- [x] Desde el inicio entro a un workspace y veo sus proyectos (no se muestran los borrados).
- [x] Tabla `Project` con su migración: nombre, área, clasificación, estado, prioridad, fechas de inicio y fin, y notas (ADR-0002 §1.1). La visibilidad queda en `WORKSPACE`; los proyectos restringidos llegan con HU-16.
- [x] Catálogo de permisos en `packages/shared` (ADR-0002 §5) y `requirePermission()` en la API: comprueba que el usuario es miembro del workspace y que su rol tiene el permiso.
- [x] Crear y editar: Admin y Miembro. Un Lector solo ve (`403` si lo intenta). Quien no es miembro recibe `404`.
- [x] Formulario validado con un esquema compartido: nombre obligatorio y fecha de fin igual o posterior a la de inicio.
- [x] Estados y prioridades con sus etiquetas en español y los colores del prototipo.
- [x] Cumple RNF-01 y tiene pruebas de autorización por rol.

#### HU-08 · Crear, asignar y mover tareas (5 pts)

_Como miembro, quiero crear tareas, asignarlas y moverlas entre Pendiente, En curso y Hecha, para saber qué falta y quién lo hace._

- [x] Tabla `Task` con su migración: título, tipo, estado, minutos estimados, fechas, responsable, `completedAt` y `workspaceId` (ADR-0002).
- [x] Vista de un proyecto con sus tareas agrupadas por estado.
- [x] Crear y editar tareas: Admin y Miembro. El Lector solo ve.
- [x] Tipos genéricos: Tarea, Reunión, Entregable, Revisión, Investigación, Examen.
- [x] El responsable debe ser un miembro activo del workspace (si no, `400`).
- [x] Cambiar el estado con un selector. Al pasar a Hecha se rellena `completedAt`; al salir de Hecha se vacía.
- [x] No se pueden ver ni modificar tareas de otro workspace (`404`).
- [x] Cumple RNF-01 y tiene pruebas.

#### HU-06 · Ver el avance de un proyecto (3 pts)

_Como miembro, quiero ver el % de avance, los minutos pendientes y los días restantes de cada proyecto, para saber cómo va sin contar tareas a mano._

- [x] % de avance = tareas Hechas ÷ total (0 % si no hay tareas).
- [x] Minutos pendientes = suma de los minutos estimados de las tareas que no están Hechas.
- [x] Días restantes respecto a la fecha de fin: "Faltan N día(s)", "Termina hoy", "Vencido hace N día(s)" o "Sin fecha". "Hoy" se calcula en la zona horaria del usuario.
- [x] Las tareas borradas no cuentan (RNF-05).
- [x] Se muestra en la lista de proyectos y en la vista del proyecto.
- [x] Reglas de cálculo como funciones puras con pruebas de los casos límite.

#### HU-04 · Invitar miembros con un rol (5 pts)

_Como Admin, quiero invitar a personas a mi workspace con un rol, para trabajar en equipo._

- [x] Tabla `Invitation` con su migración (ADR-0002); solo se guarda el **hash** del token.
- [x] Solo el Admin (`member.manage`) invita, indicando el correo y el rol (Admin, Miembro o Lector).
- [x] La app muestra **una sola vez** el enlace para copiarlo (decisión del PO: sin correo automático).
- [x] El enlace es de un solo uso y caduca a las **48 horas**.
- [x] Error claro si el correo ya es miembro o ya tiene una invitación pendiente.
- [x] Lista de miembros y de invitaciones pendientes; el Admin puede revocar una invitación.
- [x] Cumple RNF-01 y tiene pruebas (incluida la de que un Miembro o Lector no puede invitar).

#### HU-01 · Aceptar una invitación (3 pts)

_Como persona invitada, quiero abrir el enlace y crear mi contraseña, para entrar al workspace con el rol asignado._

- [x] Página pública que lee el token del enlace y muestra a qué workspace y con qué rol me invitan.
- [x] Si el correo no tiene cuenta: defino mi nombre y mi contraseña (12+ caracteres, Argon2id) y quedo con la sesión iniciada.
- [x] Si el correo ya tiene cuenta: inicio sesión con él y la invitación se suma como un workspace más.
- [x] Al aceptar se crea la membresía con el rol de la invitación y se marca `acceptedAt`, todo en una transacción.
- [x] Un enlace caducado, usado o revocado muestra un mensaje claro sin revelar datos.
- [x] Límite de intentos en el endpoint de aceptar; tiene pruebas.

### Sprint 3

Orden del PO (2026-10-25): HU-24 → HU-28 (a, b, c) → HU-21 → HU-22. HU-09 y HU-26 pasan al Sprint 4 (sus criterios siguen abajo); HU-25 y HU-15 se adelantaron a este sprint a pedido del PO.

#### HU-28 · Rediseño de la interfaz (15 pts, en 3 entregas)

_Como usuario nuevo, quiero una interfaz clara y atractiva, para encontrar rápido qué hacer y dónde._ Referencia: [maqueta](https://claude.ai/artifact/QkTijPe4GF7EtTePxQHYFR).

**HU-28a · Nueva estructura (5 pts)**

- [x] Tema turquesa matizado (`#0f6e7a`), dorado para lo urgente, tipografía Plus Jakarta Sans e iconos.
- [x] Menú lateral en el orden del PO: Proyectos, Mantenimientos, Mi trabajo, Actividades, Gantt; Administración: Miembros, Papelera, Configuración. Lo que llega después se ve como "Pronto".
- [x] Combo **Espacio de trabajo** para cambiar de espacio, y "Nuevo espacio" en una ventana.
- [x] El **Admin del sistema** ve todos los espacios y entra a cualquiera como Admin; los demás, solo aquellos en que participan (con pruebas).
- [x] Barra superior con el menú del usuario (nombre, correo, cerrar sesión).
- [x] **Solo el Admin** del espacio ve la sección Administración y la página Miembros; la API solo le envía a él los correos de los miembros (los demás ven nombres, para asignar tareas).
- [x] El Admin **renombra el espacio**: el nombre es solo una etiqueta; todo (permisos, enlaces, apps externas) se relaciona por el ID, que no cambia.
- [x] Inicio de sesión con el formulario a la izquierda, mostrar contraseña y panel de marca a la derecha.
- [x] Quien no tiene espacios ve una bienvenida para crear el primero; quien tiene, entra directo al primero.

**HU-28b · Mi trabajo (5 pts)**

- [x] Indicadores: vencen hoy, vencidas, en curso y hechas esta semana (mis tareas en el espacio).
- [x] Mis tareas de todos los proyectos, agrupadas en Vencidas, Hoy y Esta semana, con su proyecto y tipo (más "Más adelante o sin fecha", para que ninguna se pierda); se marcan como Hechas desde ahí.
- [x] Resumen de proyectos activos (avance). El de mantenimientos queda reservado y se completa con HU-21.

**HU-28c · Proyecto y ventanas (5 pts)**

- [x] Página del proyecto con indicadores (avance, trabajo pendiente, fecha de fin, requiere atención) y pestañas (Tablero, Datos del proyecto; Lista y Gantt como "Pronto").
- [x] Tarjetas de tarea con avatar del responsable y fecha coloreada según urgencia (vencida, hoy/mañana, después).
- [x] Crear y editar proyectos y tareas en ventanas; avisos breves al guardar. Al crear un proyecto se abre.

#### HU-21 · Tipos de contenedor (5 pts)

_Como Admin, quiero clasificar el trabajo en proyectos, mantenimientos y actividades, para medir cada uno como corresponde._ Diseño: [ADR-0004](adr/ADR-0004-tipos-de-trabajo.md).

- [x] Catálogo de **tipos de contenedor** por espacio, con comportamiento **Con fin**, **Continuo** o **Por demanda**; cada espacio nuevo trae Proyecto, Mtto correctivo, Mtto evolutivo y Actividades.
- [x] Migración: los espacios existentes reciben los tipos iniciales y sus proyectos quedan como "Proyecto".
- [x] Página **Configuración** (solo Admin, `catalog.manage`): agregar, renombrar, cambiar comportamiento y archivar/reactivar tipos. Nombres únicos en el espacio; siempre queda al menos un tipo activo; un tipo archivado ya no se ofrece, pero lo existente lo conserva.
- [x] Menú: **Proyectos** (Con fin), **Mantenimientos** (Continuo) y **Actividades** (Por demanda), cada uno con sus columnas: % y fin en proyectos; abiertas, vencidas y hechas del mes en mantenimientos; abiertas y vencidas en actividades. "Vencidas" y "este mes" usan la fecha local del usuario.
- [x] El tipo se elige al crear y se puede cambiar al editar; el proyecto muestra su tipo y sus indicadores según el comportamiento.
- [x] **Fechas reales** del contenedor (inicio la primera vez que pasa a En curso o a Terminado; fin al Terminar o Cancelar, se vacía si se reabre), visibles en "Datos del proyecto" con la desviación contra el fin planeado. Lo anterior a HU-21 queda sin fecha real.
- [x] "Mi trabajo" muestra los mantenimientos activos con sus abiertas y vencidas.
- [x] Pruebas: catálogo, permisos, tipo de otro espacio, archivados, métricas y fechas reales.
- Los **tipos de tarea permitidos** por tipo de contenedor pasan a HU-22: necesitan el catálogo de tipos de tarea.

#### HU-22 · Tipos de tarea (3 pts)

_Como Admin, quiero definir los tipos de tarea de mi espacio y cuáles admite cada tipo de trabajo, para clasificar incidencias, fast track y demás sin pedir cambios al sistema._ Diseño: [ADR-0004](adr/ADR-0004-tipos-de-trabajo.md).

- [x] Catálogo de **tipos de tarea** por espacio (antes era una lista fija): Tarea, Incidencia, **Fast track**, Reunión, Entregable, Revisión, Investigación y Examen. Migración: las tareas existentes conservan su tipo.
- [x] **Atención inmediata**: propiedad de cada tipo (Fast track la trae). Sus tareas se resaltan en dorado con ⚡ y van **primero** en su columna del tablero.
- [x] **Tipos permitidos** por tipo de contenedor (sin elegir = todos). Mtto correctivo: Incidencia, Fast track y Tarea; Mtto evolutivo: Tarea, Fast track, Entregable y Revisión. La API rechaza un tipo no admitido (400) y no deja cambiar el tipo de un contenedor si tiene tareas de tipos que el nuevo no admite (409).
- [x] En **Configuración** (solo Admin): agregar, renombrar, marcar atención inmediata y archivar tipos de tarea; elegir los tipos que admite cada tipo de contenedor.
- [x] **Inicio real** de la tarea (la primera vez que pasa a En curso o a Hecha; no se borra al reabrir). Las tareas anteriores quedan sin él.
- [x] Pruebas: catálogo, permisos, tipos permitidos, cambio de tipo con conflicto e inicio real.

#### HU-31 · Datos del proyecto (3 pts)

_Como responsable, quiero registrar el folio, la descripción y las personas de cada proyecto, para tener la misma información que en el sistema de origen._

- [x] Campos **Folio** (opcional, editable, hasta 40 caracteres, puede repetirse), **Descripción** y **Observaciones** (antes "Notas").
- [x] Personas como texto libre: **Solicitante**, **Asignado a**, **Project manager**, **Gte. Consultoría** y **Business partner**.
- [x] El formulario se ordena en secciones (datos, personas, planeación); la tabla de proyectos muestra Folio (Solicitante y Project manager se ven en el detalle; el PO quitó la columna Solicitante de Proyectos y Mantenimientos el 2026-10-26); el proyecto muestra su folio, descripción y personas.
- [x] Migración sin pérdida de datos (columnas opcionales) y pruebas. Buscar por folio llega con los filtros (HU-09).

#### HU-24 · Pausar y cancelar tareas (3 pts)

_Como miembro, quiero pausar o cancelar una tarea indicando por qué, para saber qué está detenido y darle seguimiento._

- [x] Estados de tarea: Pendiente, En curso, **Pausada**, Hecha y **Cancelada**.
- [x] Pausar o cancelar exige un **motivo**; la tarjeta lo muestra. Al salir de Pausada o Cancelada, el motivo se limpia.
- [x] Una tarea Pausada se puede reactivar (Pendiente o En curso) o cancelar; una Cancelada se puede reabrir.
- [x] Avance (HU-06): Pausada **cuenta** como trabajo pendiente; Cancelada **no cuenta** en el % ni en los minutos.
- [x] El tablero muestra las columnas nuevas; Hecha y Cancelada se pueden plegar.
- [x] Pruebas de la regla de avance y de las transiciones.

#### HU-15 · Papelera (5 pts)

_Como Admin, quiero dar de baja proyectos y tareas sin perderlos de inmediato, para poder recuperarlos si me equivoco._

- [x] Botón **Dar de baja** en el proyecto (solo Admin, `project.delete`) y en cada tarea (`task.delete`), con confirmación.
- [x] Lo dado de baja desaparece de listas, tablero y avance (RNF-05); las tareas de un proyecto en la papelera desaparecen con él.
- [x] Página **Papelera** del espacio (solo Admin, `trash.manage`): qué se dio de baja, quién y cuándo.
- [x] **Restaurar**: el proyecto vuelve con sus tareas.
- [x] **Borrar definitivamente** solo desde la papelera, escribiendo el nombre para confirmar; un proyecto se lleva sus tareas.
- [x] Cumple RNF-01 (`deletedById`/`deletedAt`) y tiene pruebas de permisos.

#### HU-25 · Gestionar miembros (3 pts)

_Como Admin, quiero cambiar el rol de un miembro o quitarlo del espacio, para controlar quién tiene acceso._

- [x] El Admin cambia el rol de un miembro desde la página Miembros.
- [x] El Admin quita a un miembro del espacio (borrado lógico de la membresía): pierde el acceso **al instante**.
- [x] Sus tareas asignadas **conservan su nombre**, marcado "ya no es miembro", hasta que se reasignen; no se le pueden asignar tareas nuevas.
- [x] Nunca se puede quitar ni degradar al **último Admin**.
- [x] Cumple RNF-01 y tiene pruebas.

### Sprint 4

Orden del PO (2026-10-26): HU-33 → HU-34 → HU-35 → HU-37 (adelantada por el PO) → HU-36 → HU-32 → HU-09. Diseño de personas y responsabilidades: [ADR-0005](adr/ADR-0005-personas-y-responsabilidades.md).

#### HU-33 · Sprint en proyectos y mantenimientos (2 pts)

_Como responsable, quiero anotar en qué sprint va cada proyecto y mantenimiento y qué se hace en él, para que el equipo lo vea sin buscar en otro lado._

- [x] Campos de texto **Sprint** (corto, p. ej. "Sprint 4") y **Actividades del sprint** (largo), opcionales y editables, en **proyectos y mantenimientos** (pedido del PO, 2026-10-26). Como todos los contenedores comparten formulario, también aparecen en Actividades.
- [x] Se ven en "Datos del proyecto" y, si tienen valor, bajo la descripción.
- [x] La lista de proyectos y la de mantenimientos muestran la columna **Sprint**.
- [x] Migración sin pérdida de datos y pruebas.

#### HU-34 · Catálogo de personas (5 pts)

_Como Admin, quiero dar de alta a las personas con las que trabajo, tengan o no cuenta, y mostrar a los usuarios con el nombre que usamos, para asignarles responsabilidades._

- [x] Página **Personas** (Administración): nombre, usuario vinculado (opcional) y uso. Se puede agregar, renombrar, vincular o desvincular un usuario del espacio, y archivar.
- [x] Nombre único en el espacio; un usuario se vincula a lo más a una persona por espacio.
- [x] El nombre que se muestra en tareas y proyectos es el de la persona: "adminrul" puede verse como "Rodrigo".
- [x] Cada miembro tiene su persona vinculada: se crea al crear el espacio o al aceptar una invitación, y la migración la crea para los miembros actuales.
- [x] Una persona en uso no se borra, se archiva; quitar a un miembro no borra su persona (queda "sin acceso").
- [x] Permisos: ver con `project.read`; administrar con `member.manage`. Pruebas.

#### HU-35 · Responsable y tipos Actividad, Gestión y Seguimiento (5 pts)

_Como responsable, quiero clasificar las tareas como Actividad, Gestión o Seguimiento y asignarles una persona del catálogo, para saber qué tipo de trabajo es y quién lo atiende._ **Corregida por el PO el 2026-10-27:** son tipos de tarea, no tres responsables.

- [x] Tipos de tarea **Actividad**, **Gestión** y **Seguimiento** en el catálogo de cada espacio (después de Fast track) y en los espacios nuevos.
- [x] La tarea tiene **un solo Responsable**, una persona del catálogo con o sin cuenta (con alias). La migración conserva al responsable de cada tarea.
- [x] En el formulario se elige el Responsable y se puede dar de alta una persona nueva desde ahí.
- [x] **Mi trabajo** muestra las tareas donde soy el Responsable.
- [x] Solo personas activas del espacio (400 si no); al editar se conserva una archivada que ya estaba. Si el Responsable pierde el acceso, la tarjeta avisa para reasignarla. Pruebas.

#### HU-36 · Personas del proyecto desde el catálogo (3 pts)

_Como responsable, quiero elegir al solicitante, al PM y a los demás de la lista de personas, para no escribir el mismo nombre de formas distintas._

- [x] Solicitante, Asignado a, Project manager, Gte. Consultoría y Business partner se eligen del catálogo, con alta rápida.
- [x] Migración: cada texto distinto (sin mayúsculas ni espacios sobrantes) se convierte en persona del espacio; si coincide con la persona de un miembro, se usa esa.
- [x] La tabla de proyectos y los filtros (HU-09) usan el nombre de la persona. Pruebas.

#### HU-37 · Tipos de tarea por contenedor (3 pts)

_Como responsable, quiero limitar los tipos de tarea de cada mantenimiento, para que el Mtto A use 3 tipos y el Mtto B, 2._

- [x] En los datos del contenedor se eligen sus tipos de tarea; sin elegir, admite los de su tipo (HU-22).
- [x] Solo se puede elegir un subconjunto de los que admite su tipo; la API lo valida (400).
- [x] No se quita un tipo que ya usan sus tareas (409); al cambiar el tipo del contenedor, la lista propia se descarta si ya no es subconjunto.
- [x] El selector de tipo de la tarea ofrece solo los del contenedor. Pruebas.

#### HU-38 · Folios automáticos (3 pts)

_Como responsable, quiero que cada proyecto, mantenimiento y actividad reciba un folio consecutivo si no trae uno de otro sistema, para identificarlos igual que en mi operación._ Pedido del PO a mitad del sprint (2026-10-26). Cambia la regla de HU-31: el folio ya **no** puede repetirse.

- [x] Formato: **prefijo + AAMM + "-" + contador de 3 dígitos**. **PY** para proyectos, **MT** para todos los mantenimientos y **ACT** para actividades. Ejemplo: MT2610-001, MT2610-002… y en noviembre MT2611-001.
- [x] El contador es **por espacio** y vuelve a 1 **cada mes** (y cada año); el mes es el de la fecha local del usuario.
- [x] Se asigna **solo si el folio se deja vacío al crear**; un folio de otro sistema se respeta y no consume número. Al editar, vaciarlo lo deja vacío.
- [x] **Sin folios repetidos** en el espacio (sin distinguir mayúsculas, papelera incluida): 409. Al editar se conserva el propio; los repetidos de antes de esta regla siguen editables mientras no cambie su folio.
- [x] **Teclear solo el formato** ("MT", "PY2611-", "act") lo completa con el número vigente de ese prefijo y mes; el automático se salta los números que alguien ya tecleó a mano.
- [x] Contador atómico en la BD (dos altas a la vez no repiten número). Pruebas de formato, secuencia, cambio de mes, espacios, folio manual, duplicados y formato.

#### HU-32 · Mover entre espacios de trabajo (5 pts)

_Como Admin, quiero mover un proyecto, mantenimiento o tarea a otro espacio, para corregir dónde se dio de alta sin volver a capturarlo._

- [x] Opción **Mover** en el proyecto o mantenimiento (se lleva sus tareas; las fases llegarán con HU-07) y **Mover a otro proyecto** al editar una tarea (del mismo espacio o de otro).
- [x] Solo quien es **Admin en ambos espacios** (o el Admin del sistema); la API lo verifica en el origen y en el destino.
- [x] Se conservan los IDs (las integraciones no se rompen), el historial y las fechas; queda registrado quién lo movió (RNF-01).
- [x] Los responsables que no son miembros del destino quedan marcados "ya no es miembro" (HU-25).
- [x] El tipo de contenedor se elige del catálogo del destino (se propone el del mismo nombre); los tipos de tarea y las personas se buscan por nombre en el destino y, si no existen, se crean. Si el destino no admite algún tipo de tarea, se rechaza (409) y no se mueve nada.
- [x] Confirmación que dice qué se va a mover, y pruebas de permisos.

#### HU-09 · Tabla de proyectos con filtros y orden (5 pts)

_Como miembro, quiero filtrar y ordenar los proyectos, para encontrar rápido lo que busco aunque sean muchos._

- [x] Filtros: texto (nombre, folio o personas), área y clasificación (con los valores existentes), estado, prioridad y "fecha de fin hasta".
- [x] **Ordenar** por cualquier columna, ascendente o descendente.
- [x] Terminados y Cancelados **ocultos por defecto**, con la casilla "Mostrar terminados y cancelados".
- [x] Los filtros y el orden viven en la URL (ADR-0003): un enlace compartido abre la misma vista.
- [x] Mensaje "Ningún proyecto coincide con los filtros" y botón "Limpiar filtros".
- [x] Filtro por tipo (cuando la sección tiene más de uno, p. ej. Mtto correctivo y evolutivo). La lógica son funciones puras con pruebas (shared).

#### HU-39 · Vista "Tareas" con filtros (5 pts)

_Como miembro, quiero ver todas las tareas del espacio y filtrarlas como los proyectos, para saber qué vence y quién lo tiene sin entrar proyecto por proyecto._ Pedido del PO al revisar HU-09 (2026-10-27): "Fin hasta" de la lista de proyectos sigue siendo la fecha de fin del contenedor, y la consulta de tareas va en su propia vista.

- [x] Opción **Tareas** en el menú lateral (entre Actividades y Gantt): las tareas de proyectos, mantenimientos y actividades, con su contenedor (folio y nombre, enlace al proyecto).
- [x] Filtros: texto (título, tipo, responsable, folio o nombre del contenedor), sección, contenedor, tipo de tarea, responsable (o "Sin asignar"), estado, "fin hasta" (fecha de fin **de la tarea**) y "Solo vencidas".
- [x] Hechas y Canceladas **ocultas por defecto**, con la casilla "Mostrar hechas y canceladas". Las Fast track (⚡) primero si no se eligió orden.
- [x] Orden por cualquier columna; filtros y orden en la URL, como HU-09.
- [x] Clic en la tarea abre su edición (quien tiene permiso), la misma ventana del tablero.
- [x] API `GET /workspaces/:id/tasks` con permiso de lectura; sin lo que está en la papelera. Pruebas en shared y en la API.

### Sprint 5

Plan: [sprints/sprint-05.md](sprints/sprint-05.md). Decisiones del PO al planificar (2026-10-27): HU-26 baja a 2 pts porque la vista Tareas (HU-39) ya cubre los filtros; HU-23 y HU-17 pasan al Sprint 6.

#### HU-40 · Menú lateral plegable (1 pt)

_Como usuario, quiero ocultar el menú lateral, para que tablas y tableros usen todo el ancho._ Pedido del PO al iniciar el sprint (2026-10-28).

- [x] Botón en la barra superior ("Ocultar menú" / "Menú") y atajo **Ctrl+B** para ocultarlo y mostrarlo.
- [x] Oculto, el contenido ocupa todo el ancho; en el celular también se oculta.
- [x] Cada navegador recuerda la preferencia (almacenamiento local, con respaldo si está bloqueado).

#### HU-41 · Pantallas compactas (2 pts)

_Como usuario, quiero que las pantallas aprovechen el espacio vertical, para ver la mayor cantidad de información sin desplazarme._ Pedido del PO (2026-10-28), junto con HU-40.

- [x] Encabezado de página en una línea: título, descripción a su derecha y, al extremo, el conteo y los botones (Proyectos, Mantenimientos, Actividades, Tareas, Mi trabajo, Personas, Miembros, Configuración, Papelera).
- [x] Proyectos y Tareas sin el título repetido dentro de la tarjeta.
- [x] Filtros en un solo bloque que se acomoda al ancho (en pantalla ancha, menos renglones).
- [x] Barra superior, márgenes, tarjetas y filas de tabla más compactos en toda la aplicación.
- [x] En el proyecto, la descripción y el sprint lado a lado en pantallas anchas.

#### HU-42 · Ocultar lo que el perfil no permite (1 pt)

_Como usuario, quiero ver solo las opciones que puedo usar, para no toparme con botones que no me corresponden._ Pedido del PO (2026-10-28).

- [x] Revisión por perfil (Admin, Miembro, Lector): la sección Administración, Renombrar, Nuevo proyecto, Nueva tarea, editar y dar de baja ya se ocultaban según el rol.
- [x] **Solo el Admin del sistema crea espacios**: el botón "Nuevo espacio" (y "Crear mi primer espacio") solo lo ve él y la API responde 403 a los demás. Pruebas.
- [x] "Mover" ya no aparece deshabilitado: si no hay otro espacio donde sea Admin, no se muestra.
- [x] Los permisos ajustados por persona (HU-17) usarán la misma regla: lo que no se puede, no se ve.

#### HU-43 · "Sin folio" puede repetirse (1 pt)

_Como responsable, quiero capturar "Sin folio" en varios contenedores, para marcar los que no traen folio de otro sistema sin que se les asigne uno automático._ Pedido del PO (2026-10-28). Ajusta la regla de HU-38.

- [x] **"Sin folio" es el único folio que puede repetirse** en el espacio, al crear y al editar. Se reconoce sin importar mayúsculas ni espacios ("Sin Folio", "SIN FOLIO"); "Sin folio 2" sigue siendo un folio normal y no se repite.
- [x] No consume número del folio automático. Cualquier otro folio repetido sigue dando 409.
- [x] El formulario lo explica junto al campo Folio. Pruebas.

#### HU-44 · Depurar el catálogo de personas (2 pts)

_Como Admin, quiero borrar a las personas que di de baja y que nadie usa, y ocultar las archivadas, para que el catálogo no estorbe._ Pedido del PO (2026-10-28).

- [x] Una persona **archivada** que no aparece en ninguna tarea (papelera incluida) ni en ningún rol de proyecto se puede **borrar definitivamente**, con confirmación. Solo el Admin.
- [x] Si alguien la usa, o su cuenta sigue siendo miembro del espacio, el botón aparece deshabilitado y **el motivo se ve bajo el nombre** (p. ej. "Aparece en 2 tarea(s)… reasígnalas primero"; corregido tras la prueba del PO: antes solo salía al pasar el ratón); la API responde 409.
- [x] Las archivadas se **ocultan por defecto**; el interruptor "Mostrar archivadas (N)" las muestra.
- [x] Debajo del nombre ya no se repite la cuenta vinculada: la muestra el combo. Pruebas.

#### HU-45 · Dónde aparece una persona (1 pt)

_Como Admin, quiero ver en qué tareas y proyectos aparece una persona archivada, para reasignarla y poder borrarla._ Pedido del PO (2026-10-28), tras probar HU-44.

- [x] En Personas, el aviso "Aparece en N tarea(s)…" de una archivada es un enlace "Ver dónde" que abre una ventana con sus tareas (con su proyecto) y los proyectos donde tiene un rol (Solicitante, PM…).
- [x] Cada elemento tiene "Abrir" (va al proyecto para reasignar) o "En la papelera" (va a la papelera). Solo el Admin; otro espacio da 404. Pruebas.

#### HU-46 · Actividades: fecha fin y columnas según el espacio (1 pt)

_Como responsable, quiero ver la fecha fin de cada grupo de actividades sin que la tabla se amontone._ Pedido del PO (2026-10-28).

- [x] La tabla de Actividades muestra la columna **Fin** (con los días que faltan), ordenable.
- [x] **Abiertas** se oculta mientras el menú lateral está visible y vuelve a aparecer al ocultarlo (botón o Ctrl+B). Proyectos y Mantenimientos no cambian.

#### HU-47 · Origen de la tarea (3 pts)

_Como responsable, quiero registrar de dónde llega cada tarea y su detalle, para rastrearla y filtrar por origen._ Pedido del PO (2026-10-28). Decisiones del PO: el origen es una **lista en Configuración**; la descripción es el **detalle del origen**.

- [x] Catálogo **Orígenes de tarea** en Configuración (solo Admin): agregar, renombrar y archivar; sin nombres repetidos (409). Los espacios nuevos traen Correo, Teléfono, Junta y Ticket; los existentes empiezan vacíos.
- [x] En la tarea, **Origen** (de la lista, o ninguno) y **Detalle del origen** (texto, hasta 300). Un origen de otro espacio o archivado da 400; al editar se conserva el que ya tenía aunque se haya archivado.
- [x] La tarjeta del tablero muestra "Origen: Ticket · #4521…".
- [x] Vista Tareas: filtro **Origen**. Ejemplo: con Origen = Ticket encuentra las tareas con origen Ticket y no las que no tienen origen; "Sin origen" encuentra solo esas. El buscador también busca en el origen y su detalle.
- [x] Al mover una tarea o un contenedor a otro espacio, el origen se busca por nombre en el destino (o se crea). Pruebas.

#### HU-48 · Mi trabajo: ocultar el panel lateral (1 pt)

_Como responsable, quiero ocultar proyectos activos y mantenimientos en Mi trabajo, para ver más tareas en la pantalla._ Pedido del PO (2026-10-28).

- [x] Botón **Ocultar panel / Mostrar panel** en la cabecera de Mi trabajo, como el del menú lateral; el navegador recuerda la elección. Por omisión se ve como antes.
- [x] Con el panel oculto, Mis tareas usa todo el ancho y cada tarea va en un renglón: título y, a su derecha, tipo · proyecto · estado.

#### HU-49 · Contenedores de trabajo o personales (2 pts)

_Como usuario, quiero marcar si un proyecto, mantenimiento o actividad es de trabajo o personal, para no llenar en lo personal campos que no aplican._ Pedido del PO (2026-10-28).

- [x] Campo **Ámbito** (Trabajo / Personal) en el formulario, junto al Tipo. Los que ya existían quedan como Trabajo.
- [x] Al dar de alta uno personal, Sprint y Actividades del sprint empiezan en **N/A**. Project manager, Gte. Consultoría y Business partner quedan sin persona y la pantalla muestra **N/A** (no se crea una persona falsa en el catálogo).
- [x] Botón **Ocultar / Mostrar campos de trabajo** en los personales (ficha y formulario): oculta esos 5 campos; el navegador recuerda la elección. Los de trabajo los siguen mostrando. Ocultos conservan su valor al guardar.
- [x] Filtro **Ámbito** en las listas. Ej.: «Personal» encuentra «Mudanza» (personal) y no encuentra «Portal de clientes» (trabajo).

#### HU-49b · Personales: campos de trabajo ocultos y menú oculto en contenedores (1 pt)

_Ajuste de HU-49 pedido por el PO (2026-10-29), tras probarla._

- [x] En un personal, los campos de trabajo (PM, Gte. Consultoría, BP, Sprint y Actividades del sprint) empiezan **ocultos** cada vez, en la ficha y en el formulario; «Mostrar campos de trabajo» los despliega.
- [x] Desplegados, cada «N/A» dice de qué campo es (p. ej. «Project manager: N/A», «Sprint: N/A»), también en «Datos del proyecto».
- [x] En Proyectos, Mantenimientos, Actividades y la ficha de un contenedor, el **menú lateral empieza oculto**; el botón «Menú» (o Ctrl+B) lo muestra. En las demás páginas se usa lo que recuerda el navegador.

#### HU-52 · Ver el trabajo de otras personas (3 pts)

_Como Admin, quiero ver el trabajo de todos y decidir de quién puede ver el trabajo cada miembro, para dar seguimiento sin hacerlo Admin._ Pedido del PO (2026-10-29).

- [x] Mi trabajo tiene el combo **«Ver el trabajo de»**. El Admin ve «Todas las personas» por omisión (también las tareas sin Responsable) y puede elegir a una. Un miembro que sigue a otras personas ve «Yo y a quienes sigo», «Yo» o una de ellas. Cada tarea dice de quién es.
- [x] En Miembros → Permisos, la sección **«Puede ver el trabajo de»** elige personas del catálogo (con o sin cuenta). Ej.: Ana (Miembro, «las suyas») con Luis marcado ve las tareas donde Luis es Responsable; no ve las de Pedro.
- [x] Es **solo lectura**: Ana no modifica ni da de baja las tareas de Luis. Ve también, en solo lectura, los contenedores donde trabaja Luis; dentro de ellos solo las tareas de Luis (y las suyas).
- [x] La API lo aplica en todas las vistas (Tareas, tableros, proyectos, Mi trabajo); de alguien que no sigue, Mi trabajo da 404.

#### HU-53 · Lector solo de trabajo; Miembro ve las tareas de lo que ve (2 pts)

_Como Admin, quiero que un Lector vea solo lo de trabajo y que un Miembro vea todas las tareas de los contenedores a los que tiene acceso, para dar contexto sin exponer lo personal._ Pedido del PO (2026-10-29).

- [x] La matriz tiene la casilla **«Solo trabajo»**; la plantilla Lector la trae marcada. Ej.: en Monex el Lector ve «Certificación Linux» (Trabajo) con sus tareas; «Gimnasio» (Personal) da 404 y sus tareas no aparecen. Lo que creó o donde es Responsable sí lo ve.
- [x] La plantilla Miembro ve **todas las tareas de los contenedores que ve**, también donde solo tiene una tarea asignada. Ej.: prueba4 ve todas las tareas de «Certificación Linux», pero solo modifica las que creó o donde es Responsable (las suyas).
- [x] La migración actualiza a los Lectores y Miembros que tenían la plantilla sin ajustes (también en invitaciones pendientes); los «(ajustado)» se quedan igual.

#### HU-50 · Catálogo de personas compartido entre espacios (5 pts) — pasa al Sprint 7

_Como Admin, quiero que una persona dada de alta en un espacio aparezca en otros, para no darla de alta dos veces._ Pedido del PO (2026-10-28). **Diseño confirmado por el PO (2026-10-30)** con el ejemplo de Luis.

- [ ] En Personas, «Compartir con…» ofrece los espacios donde soy Admin. Ej.: Luis, de workpers, compartido con Monex, aparece en Personas de Monex («compartida desde workpers») y en sus combos de Responsable, PM, etc.
- [ ] Solo se edita, archiva o borra desde su espacio dueño; en los otros, «Dejar de compartir» si no está asignada a nada ahí.
- [ ] Compartir exige ser Admin en ambos espacios.

#### HU-51 · Fusionar personas duplicadas (3 pts)

_Como Admin, quiero fusionar dos personas que son la misma, para que sus tareas y proyectos queden en una sola y se vean en Mi trabajo._ Pedido del PO (2026-10-29), tras encontrar «Rul» (con cuenta) y «Raúl Paredes» (sin cuenta) en Monex.

- [x] En Personas, «Fusionar» pasa a la persona elegida todas las tareas (también las de la papelera) y los roles en proyectos (Solicitante, Asignado, PM, Gte. Consultoría, BP) de la duplicada, y la borra. Ej.: «Raúl Paredes» (sin cuenta) fusionada en «Rul» (con cuenta): sus 10 tareas aparecen en Mi trabajo de adminrul.
- [x] Si la duplicada tiene cuenta y la otra no, la cuenta pasa a la que se queda. Si las dos tienen cuenta, no se permite (son usuarios distintos); tampoco con una archivada.
- [x] Quien podía ver el trabajo de la duplicada (HU-52) ve el de la que se queda.
- [x] Solo el Admin; se pide confirmación diciendo cuántas tareas y proyectos se pasan.

#### TEC-04 · Despliegue gratuito con HTTPS (5 pts)

_Como PO, quiero la aplicación en una URL pública con HTTPS, para usarla con mi equipo sin depender de mi PC._

- [x] Se comparan 2 o 3 servicios gratuitos (aplicación y PostgreSQL) con sus condiciones vigentes, y la elección queda en un ADR. El PO aprueba antes de crear cuentas. → [ADR-0007](adr/ADR-0007-despliegue.md): Render + Neon, aprobado 2026-10-29.
- [x] API y web en producción con **HTTPS**, HSTS y cookies `Secure` (ya previsto en `security.ts`); CORS solo para el dominio publicado. La API sirve la web (`@fastify/static`, misma URL). En producción desde 2026-10-29: <https://gestion-proyectos-gnnp.onrender.com> (HTTP → HTTPS, HSTS y CSP comprobados; el PO entró con el primer Admin).
- [x] Secretos solo en las variables del hosting (nunca en el repositorio); `.env.example` documenta cada una.
- [x] Las migraciones se aplican al desplegar (en el build); el primer Admin se crea con `setup:admin` desde la PC del PO.
- [x] Se despliega desde `main` con CI en verde (`render.yaml`); [docs/despliegue.md](despliegue.md) explica cómo desplegar, cómo ver los registros y cómo respaldar la base de datos.

#### HU-07 · Fases (8 pts)

_Como responsable de un proyecto, quiero agrupar sus tareas en fases (y subfases), para ver el trabajo ordenado y el avance de cada parte, como en Project._

Confirmado por el PO (2026-10-30) con el ejemplo "Certificación Linux" → "Módulo 101" → "Tema 1": la fase solo tiene nombre y orden; las maneja quien puede modificar el contenedor.

- [x] Crear, renombrar, reordenar (subir/bajar) y dar de baja **fases** dentro de un proyecto; una fase puede contener tareas y otras fases, hasta **4 niveles**.
- [x] Una tarea pertenece a una fase o queda **suelta** (sin fase); se puede mover de fase al crearla o editarla. Al moverla a otro proyecto (HU-32) queda suelta.
- [x] La fase **calcula sola** su avance (con las reglas de HU-06), su inicio (el más temprano) y su fin (el más tardío) a partir de todo lo que contiene; no se capturan a mano.
- [x] En el proyecto, las fases se ven como un **esquema con sangría** que se pliega y despliega, con su avance (pestaña **Fases**); el tablero se puede **filtrar por fase**. Ejemplo: "Módulo 101" muestra sus tareas y las de sus subfases; "Sin fase", las sueltas. Clic en una fase del esquema abre el tablero filtrado.
- [x] Dar de baja una fase manda a la papelera su contenido (subfases y tareas) y restaurarla lo devuelve, como un proyecto (HU-15). Detalle en ADR-0002 §4.
- [x] El tipo de contenedor (ADR-0004) decide si usa fases: casilla **Usa fases** en Configuración; marcada en Proyecto (Con fin), desmarcada en Mantenimiento y Actividades.
- [x] Cumple RNF-01 y RNF-05, con pruebas de permisos y de los cálculos (funciones puras en shared).

#### HU-26 · Pestaña Lista del proyecto (2 pts) — pasa al Sprint 6

_Como miembro, quiero ver las tareas de un proyecto en lista, para manejar proyectos con muchas tareas._ Reducida por el PO (2026-10-27): reutiliza la vista Tareas (HU-39).

- [x] En el proyecto se alterna entre **Tablero** y **Lista**; la Lista es la tabla de la vista Tareas filtrada a ese proyecto (mismos filtros y orden, en la URL).
- [x] Con fases (HU-07), las tareas se **agrupan por fase con sangría**, y se pueden plegar.
- [x] Clic en una tarea abre su edición, como en el tablero.

#### HU-27 · Gantt (8 pts) — pasa al Sprint 6

_Como responsable, quiero ver mis proyectos y tareas en un diagrama de Gantt, para comparar lo planeado contra lo real._

Confirmado por el PO (2026-10-30) con el ejemplo "Certificación Linux": **dos barras por tarea** (arriba la planeada, abajo la real: de que pasó a En curso hasta que quedó Hecha, o hasta hoy); hitos = tareas de **tipo Entregable**; el del espacio con un **combo de sección**; las tareas **sin fechas** aparecen en su renglón, sin barra. Se entrega en dos PR: HU-27a (proyecto) y HU-27b (espacio).

- [x] Dentro de cada proyecto (sus tareas; HU-27a) y uno general del espacio (menú lateral → Gantt: los contenedores de la sección elegida como barras, plegados, con sus tareas al desplegarlos; hechos y cancelados ocultos salvo que se pidan; HU-27b).
- [x] Barras con las fechas planeadas coloreadas por estado, línea de "hoy" y vencido resaltado.
- [x] **Planeado contra real** (ADR-0004 §2.1). Las canceladas no se dibujan.
- [x] Zoom semana / mes / trimestre (en la URL).
- [x] **Fases como barras resumen** (HU-07) y Entregables como hitos (rombo).
- [x] Sin librería nueva (cuadrícula de CSS). Dependencias entre tareas: más adelante, si hacen falta.

#### HU-29 · Mi perfil (3 pts)

_Como usuario, quiero cambiar mi nombre, mi correo y mi contraseña, sin pedírselo al Admin._

- [x] Desde el menú del usuario (**Mi perfil**, `/perfil`): cambiar nombre, correo y contraseña. Al cambiar el nombre, también cambia el de su persona en los espacios donde se llamaba igual; si el Admin le puso otro nombre (alias), se respeta.
- [x] Cambiar el correo o la contraseña pide la **contraseña actual** (con límite de intentos, como el login).
- [x] El correo nuevo se guarda en minúsculas y no puede estar en uso.
- [x] Al cambiar el correo o la contraseña se **cierran mis demás sesiones**.
- [x] Cumple RNF-01. Sin verificación por correo mientras no haya servicio de correo.

#### HU-30 · Usuarios del sistema (3 pts)

_Como Admin del sistema, quiero corregir correos y desactivar cuentas, para mantener los accesos en orden._

- [x] Pantalla solo para el **Admin del sistema** con todos los usuarios (nombre, correo, espacios, estado y último acceso): menú del usuario → **Usuarios del sistema** (`/usuarios`).
- [x] Puede **cambiar el correo** de cualquiera (mismas reglas que HU-29); se cierran sus sesiones.
- [x] Puede **desactivar o reactivar** una cuenta: una cuenta desactivada no inicia sesión y sus sesiones se cierran. No puede desactivar la suya (nadie podría reactivarla). Sus tareas y su persona se conservan.
- [x] El Admin de un espacio no cambia correos: quita al miembro e invita el correo correcto (la API le responde 403).

#### HU-17 · Permisos por persona y por espacio (13 pts)

_Como Admin, quiero configurar a cada persona al invitarla (en qué espacios entra, qué ve y qué puede hacer), para que cada quien trabaje solo con lo que le corresponde._ Une HU-17 y HU-16. Diseño en [ADR-0006](adr/ADR-0006-permisos-por-persona.md).

**HU-17a · Modelo y API (5 pts)**
- [x] Matriz por membresía (JSON validado con Zod) y lista "Estos…"; plantillas Admin, Miembro y Lector.
- [x] La migración conserva lo que hoy puede hacer cada miembro (ADR-0006 §5); quita `Project.visibility`.
- [x] Un solo filtro de visibilidad aplicado en listas, detalle, tareas del proyecto, vista Tareas, Mi trabajo, Mover y papelera: lo que no ve da 404; lo que ve pero no puede modificar da 403.
- [x] Contenedor visible en solo lectura si tengo una tarea en él.
- [x] Papelera: cada quien restaura lo que su permiso le permite; borrar definitivamente, solo Admin.
- [x] Pruebas por endpoint de "otro usuario no lo ve" y de cada opción de la matriz.

**HU-17b · Pantalla de permisos (5 pts)**
- [x] En Miembros, "Permisos" abre la matriz de la persona: plantilla y ajustes por sección (Ver, Crear, Modificar, Dar de baja y restaurar) y la lista "Estos…" (solo se guardan los contenedores de secciones que ven "Estos…"). Cambiar el rol en el combo aplica su plantilla y descarta los ajustes.
- [x] Muestra "Miembro (ajustado)" cuando la matriz ya no coincide con la plantilla (en Miembros y en "tu rol" de cada sección).
- [x] La web oculta lo que el usuario no puede hacer según su matriz: Nuevo proyecto/mantenimiento/actividad por sección, Editar datos, Dar de baja, Nueva tarea y editar o dar de baja cada tarea. La Papelera aparece para quien puede dar de baja algo; "Borrar definitivamente" sigue siendo solo del Admin.

**HU-17c · Invitación a varios espacios (3 pts)**
- [x] Una invitación incluye uno o varios espacios, cada uno con su plantilla y su matriz (y su lista "Estos…"); quien invita debe ser Admin de cada uno (403 si no). En "Invitar": plantilla y "Permisos" por espacio, y "+ Agregar otro espacio".
- [x] Al aceptar, entra a todos con su persona del catálogo; las invitaciones pendientes de antes siguen funcionando (la migración las convierte en invitaciones de un espacio). La invitación aparece como pendiente en cada espacio y se revoca entera desde cualquiera; ya miembro o con otra invitación pendiente en alguno de los espacios da 409 con su nombre.

### Sprint 6

Plan: [sprints/sprint-06.md](sprints/sprint-06.md). Objetivo: cerrar el MVP. HU-26 (Lista) y HU-27 (Gantt) están arriba, en el Sprint 5, de donde vienen. Los criterios de esta sección son iniciales: cada historia se confirma con un ejemplo concreto antes de construirla (acuerdo del Sprint 4).

#### HU-54 · Restablecer una contraseña olvidada (3 pts)

_Como usuario que olvidó su contraseña, quiero recuperar el acceso sin perder mi cuenta._ Pedido del PO (2026-10-30), después de no poder entrar a producción. **Diseño confirmado por el PO (2026-10-30)** con el ejemplo de prueba4.

- [x] En Usuarios del sistema (HU-30), **Restablecer contraseña** genera un enlace de un solo uso, válido 48 horas, que el Admin del sistema copia y manda (como las invitaciones, sin correo automático). Ej.: prueba4 olvida su contraseña; el Admin le manda el enlace por WhatsApp; prueba4 crea una nueva y entra.
- [x] Al usar el enlace se cierran todas las sesiones de esa cuenta; en la BD solo se guarda el hash del token.
- [x] Si quien la olvida es el Admin del sistema: comando `pnpm reset:password` desde la PC del PO (como `setup:admin`), que pide el correo y la contraseña nueva sin mostrarla.
- [x] "¿Olvidaste tu contraseña?" en el login explica que se pide al Admin del sistema. Sin correo automático mientras no haya servicio de correo.

#### HU-23 · Campos de detalle por tipo (8 pts)

_Como Admin, quiero que cada tipo de contenedor y de tarea pida su propio detalle, para capturar lo que cada trabajo necesita sin cambiar el código._ Diseño en [ADR-0004 §3](adr/ADR-0004-tipos-de-trabajo.md).

Confirmado por el PO (2026-10-30) con el ejemplo Incidencia → "Severidad" (lista, obligatoria): botón **Campos** en cada tipo de Configuración; los tipos **empiezan sin campos** (no se cargan los propuestos del ADR-0004 §5); los valores se ven en el formulario (sección Detalle) y en Datos del proyecto. Se entrega en dos PR: HU-23a (definir los campos) y HU-23b (capturar y validar los valores).

- [x] En Configuración, cada tipo define sus campos: texto corto, texto largo, número, fecha, lista de opciones o Sí/No; obligatorio u opcional, con orden (HU-23a).
- [x] Los formularios de contenedor y de tarea muestran solos los campos del tipo elegido (sección Detalle). Ej.: una tarea Incidencia pide Severidad (obligatoria); una Tarea no pide nada extra. Los del contenedor también se ven en Datos del proyecto (HU-23b).
- [x] La API valida los valores contra la definición (reglas puras en shared, las mismas que usa la web): tipo equivocado, opción inexistente u obligatorio vacío → 400 "Detalle: Severidad: Obligatorio". Mover de columna no los pide; al cambiar de tipo se validan los del tipo nuevo y los anteriores se conservan (HU-23b).
- [x] Se puede renombrar un campo y agregar opciones; no se cambia la clase de un campo ni se quitan opciones (409). Quitar un campo lo archiva y conserva sus valores (HU-23a).
- [x] ~~Valores iniciales del ADR-0004 §5~~: el PO decidió que los tipos empiecen sin campos.

#### HU-10 · Tablero Kanban de proyectos (5 pts)

_Como responsable, quiero ver mis contenedores en un tablero por estado, para saber de un vistazo qué está en curso._ Confirmado por el PO (2026-10-31) con el ejemplo de su lista de Proyectos: también en Mantenimientos y Actividades; el estado se cambia con un combo en la tarjeta (sin arrastrar).

- [x] En Proyectos, Mantenimientos y Actividades se alterna entre **Tabla** y **Tablero** (en la URL); el tablero tiene una columna por estado y respeta los filtros de la lista. Los terminados y cancelados se cuentan aunque "Mostrar terminados" esté apagado (ver el ajuste de abajo).
- [x] Cada tarjeta muestra folio, nombre, prioridad, sprint, avance (o abiertas y vencidas) y fin; clic en el nombre abre el contenedor.
- [x] El combo de Estado de la tarjeta lo pasa de columna (PATCH .../status, registra las fechas reales), solo si la matriz permite modificarlo (ADR-0006).
- [x] Ajuste del PO en la prueba (2026-10-31): Terminado y Cancelado **no se muestran por omisión**, para dar espacio a los otros tres; dos botones "Terminados (N)" y "Cancelados (N)" muestran u ocultan su columna.

#### HU-55 · Filtro por año en las listas (3 pts)

_Como responsable, quiero ver mis contenedores por año, separando abiertos y cerrados, para revisar lo de cada año sin mezclarlo con lo anterior._ Pedido del PO (2026-10-31), confirmado con el ejemplo "Portal clientes" (En curso), "Migración ERP" (Terminado en marzo de 2026) y "Curso Linux" (Terminado en 2025).

- [ ] En Proyectos, Mantenimientos y Actividades (tabla y tablero), un combo **Año** con los años que tienen datos (el en curso por omisión) y un selector **Abiertos / Cerrados / Ambos** que reemplaza la casilla "Mostrar terminados"; en la URL como los demás filtros.
- [ ] **Abiertos** en un año: creados a más tardar ese año y sin cerrar. **Cerrados**: terminados o cancelados ese año (fecha de fin real). Ej.: 2026 con "Ambos" muestra Portal clientes y Migración ERP; Curso Linux, no.
- [ ] Al llegar 2027 aparecen 2026 y 2027 en el combo; 2026 sigue mostrando lo que estuvo vivo y lo que se cerró ese año.

#### HU-13 · Exportar (3 pts)

_Como usuario, quiero exportar lo que veo, para respaldarlo o analizarlo en Excel._ Confirmado por el PO (2026-10-31): columnas con los nombres nuevos; se exporta desde el menú del espacio.

- [x] Menú lateral → **Exportar** (para cualquier miembro): **Excel (CSV)** con BOM UTF-8, una fila por tarea, las 16 columnas del prototipo en su orden con los nombres de ahora (Proyecto, Área, …, Fase, …, Tarea, …, Completada), luego Sección, Tipo de contenedor, Folio, Estado de la tarea, Responsable, Origen, Detalle del origen y una columna por campo de detalle. La fase va con su ruta ("Módulo 101 / Tema 1") y sus fechas calculadas; un contenedor sin tareas lleva una fila. **Respaldo (JSON)**: catálogos, personas y contenedores con fases y tareas (`format`, `version` para Importar).
- [x] Respeta la visibilidad de quien exporta (ADR-0006) y excluye lo borrado. Celdas que parecen fórmulas de Excel (=, +, -, @) se protegen con un apóstrofo. Sin dependencias nuevas.

#### HU-11 · Detalle del proyecto (3 pts)

_Como responsable, quiero una vista de resumen del proyecto, para ver su estado sin abrir cada pestaña._

- [ ] Pestaña **Resumen** con datos, personas, avance, minutos pendientes, días restantes, fechas planeadas contra reales y avance por fase.
- [ ] Qué datos lleva y en qué orden se confirma con el PO antes de construirla.

### Sprints siguientes (criterios por detallar en su planificación)

- **HU-14 · Importar:** JSON o CSV, incluidos los respaldos del prototipo; "Actualizar" busca coincidencias por ID o, si no hay, por nombre sin distinguir mayúsculas; "Reemplazar" pide doble confirmación y manda lo anterior a la papelera; fechas normalizadas a AAAA-MM-DD (ambiguas = día/mes/año).
- **Integraciones (TEC-08 a HU-20):** diseño en ADR-0002 §7.
