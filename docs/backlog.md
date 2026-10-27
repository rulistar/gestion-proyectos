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
| Revisión del Sprint 3 (2026-10-26) | Se hizo lo pedido. Nuevos: **Sprint** y **Actividades del sprint** en proyectos y mantenimientos; en cada tarea **Actividad, Gestión y Seguimiento** (una persona cada una; Actividad reemplaza a Responsable); **catálogo de personas por espacio**, con o sin cuenta, vinculables a un usuario para mostrarlo con otro nombre; personas del proyecto desde el catálogo; **tipos de tarea limitados por contenedor**. Diseño en [ADR-0005](adr/ADR-0005-personas-y-responsabilidades.md). Sprint 4: estas historias + HU-32 + HU-09 (28 pts); HU-23 pasa al Sprint 5. |
| Datos del proyecto (2026-10-25) | Los proyectos llevan **Folio** (viene de otro sistema: opcional, editable, puede repetirse), **Descripción**, **Observaciones** (antes "Notas") y personas como **texto libre** (solo el nombre): Solicitante, Asignado a, Project manager, Gte. Consultoría y Business partner. Se hace ya (HU-31). **Mover** proyectos, mantenimientos y tareas **entre espacios**, solo Admin (HU-32, Sprint 4). |

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
| 21 | HU-35 | Responsabilidades de la tarea: Actividad, Gestión y Seguimiento | Tareas | 5 | 🔴 | 4 |
| 22 | HU-36 | Personas del proyecto desde el catálogo | Personas | 3 | 🔴 | 4 |
| 23 | HU-37 | Tipos de tarea por contenedor (subconjunto de los de su tipo) | Tipos | 3 | 🔴 | 4 |
| 24 | HU-38 | Folios automáticos: PY, MT y ACT + AAMM + "-" + contador mensual por espacio | Proyectos | 3 | 🔴 | 4 |
| 25 | HU-32 | Mover un proyecto, mantenimiento o tarea a otro espacio de trabajo (solo Admin) | Workspaces | 5 | 🔴 | 4 |
| 26 | HU-09 | Tabla de proyectos con filtros y orden por columna | Vistas | 5 | 🔴 | 4 |
| 27 | HU-07 | Fases: agrupar las tareas de un proyecto en fases anidadas (hasta 4 niveles), con avance y fechas calculadas | Proyectos | 8 | 🔴 | 5 |
| 28 | HU-26 | Muchas tareas: vista Lista, filtros y columnas plegables | Vistas | 5 | 🔴 | 5 |
| 29 | HU-23 | Campos de detalle por tipo (ADR-0004) | Tipos | 8 | 🔴 | 5 |
| 30 | TEC-04 | Despliegue gratuito en la nube con HTTPS | Plataforma | 5 | 🔴 | 5 |
| 31 | HU-27 | Diagrama de Gantt del proyecto y del espacio (planeado contra real) | Vistas | 8 | 🔴 | 5 |
| 32 | HU-17 | Permisos por usuario: matriz de acciones por miembro | Permisos | 8 | 🔴 | 5 |
| 33 | HU-16 | Restringir qué proyectos ve cada usuario | Permisos | 5 | 🔴 | 5 |
| 34 | HU-29 | Mi perfil: cambiar mi nombre, correo y contraseña | Usuarios | 3 | 🔴 | 5 |
| 35 | HU-30 | Usuarios del sistema: el Admin del sistema cambia correos y desactiva cuentas | Usuarios | 3 | 🔴 | 5 |
| 36 | HU-10 | Tablero Kanban de proyectos por estado | Vistas | 5 | 🔴 | 6 |
| 37 | HU-13 | Exportar datos en JSON y CSV compatible con Excel | Respaldo | 3 | 🟡 | 6 |
| 38 | HU-11 | Vista de detalle del proyecto | Vistas | 3 | 🟡 | 6 |
| 39 | TEC-05 | Documentación OpenAPI (Swagger) | Plataforma | 3 | 🟡 | 6 |
| 40 | TEC-06 | Pruebas extremo a extremo con Playwright | Plataforma | 3 | 🟡 | 6 |
| 41 | HU-12 | Gráficas por mes de término y por estado, e indicadores de tiempos (ADR-0004 §2.1) | Reportes | 5 | 🟢 | 7 |
| 42 | HU-14 | Importar desde JSON o CSV (actualizar o reemplazar), incluidos los respaldos del prototipo | Respaldo | 8 | 🟢 | 7 |
| 43 | TEC-08 | Apps externas: `ApiClient`, usuario de servicio y tokens de API | Integraciones | 5 | 🟡 | 7 |
| 44 | HU-18 | Vincular un proyecto, fase o tarea con un recurso de otra app (curso, unidad, actividad) | Integraciones | 3 | 🟡 | 8 |
| 45 | TEC-09 | Avisos salientes: Outbox + webhooks firmados con reintentos | Integraciones | 8 | 🟡 | 8 |
| 46 | TEC-10 | Avisos entrantes: webhook firmado e idempotente | Integraciones | 5 | 🟡 | 8 |
| 47 | HU-19 | Que el avance en la app de estudio complete automáticamente las tareas vinculadas | Integraciones | 3 | 🟡 | 9 |
| 48 | HU-20 | Crear fases y tareas de un proyecto a partir de las unidades y actividades de un curso | Integraciones | 5 | 🟢 | 9 |

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

Orden del PO (2026-10-26): HU-33 → HU-34 → HU-35 → HU-36 → HU-37 → HU-32 → HU-09. Diseño de personas y responsabilidades: [ADR-0005](adr/ADR-0005-personas-y-responsabilidades.md).

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

#### HU-35 · Responsabilidades de la tarea (5 pts)

_Como responsable, quiero indicar en cada tarea quién la hace, quién la gestiona y quién le da seguimiento, para que cada uno sepa qué le toca._

- [ ] Tres campos opcionales, una persona del catálogo cada uno: **Actividad**, **Gestión** y **Seguimiento**. **Actividad reemplaza a Responsable**; la migración pasa cada responsable a Actividad.
- [ ] En el formulario se elige de la lista de personas y se puede dar de alta una nueva desde ahí.
- [ ] La tarjeta muestra el avatar de Actividad y, al pasar el cursor, las tres responsabilidades.
- [ ] **Mi trabajo** muestra las tareas donde aparezco en cualquiera de las tres, con la etiqueta de cuál me toca.
- [ ] Solo personas activas del espacio (400 si no); al editar se conserva una archivada que ya estaba. Pruebas.

#### HU-36 · Personas del proyecto desde el catálogo (3 pts)

_Como responsable, quiero elegir al solicitante, al PM y a los demás de la lista de personas, para no escribir el mismo nombre de formas distintas._

- [ ] Solicitante, Asignado a, Project manager, Gte. Consultoría y Business partner se eligen del catálogo, con alta rápida.
- [ ] Migración: cada texto distinto (sin mayúsculas ni espacios sobrantes) se convierte en persona del espacio; si coincide con la persona de un miembro, se usa esa.
- [ ] La tabla de proyectos y los filtros (HU-09) usan el nombre de la persona. Pruebas.

#### HU-37 · Tipos de tarea por contenedor (3 pts)

_Como responsable, quiero limitar los tipos de tarea de cada mantenimiento, para que el Mtto A use 3 tipos y el Mtto B, 2._

- [ ] En los datos del contenedor se eligen sus tipos de tarea; sin elegir, admite los de su tipo (HU-22).
- [ ] Solo se puede elegir un subconjunto de los que admite su tipo; la API lo valida (400).
- [ ] No se quita un tipo que ya usan sus tareas (409); al cambiar el tipo del contenedor, la lista propia se descarta si ya no es subconjunto.
- [ ] El selector de tipo de la tarea ofrece solo los del contenedor. Pruebas.

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

- [ ] Opción **Mover a otro espacio** en el proyecto o mantenimiento (se lleva sus fases y tareas) y en cada tarea (elige el proyecto destino).
- [ ] Solo quien es **Admin en ambos espacios** (o el Admin del sistema); la API lo verifica en el origen y en el destino.
- [ ] Se conservan los IDs (las integraciones no se rompen), el historial y las fechas; queda registrado quién lo movió (RNF-01).
- [ ] Los responsables que no son miembros del destino quedan marcados "ya no es miembro" (HU-25).
- [ ] Si el tipo de contenedor o de tarea no existe en el destino, se pide elegir uno equivalente (ADR-0004).
- [ ] Confirmación que dice qué se va a mover, y pruebas de permisos.

#### HU-09 · Tabla de proyectos con filtros y orden (5 pts)

_Como miembro, quiero filtrar y ordenar los proyectos, para encontrar rápido lo que busco aunque sean muchos._

- [ ] Filtros: texto (nombre, folio o personas), área y clasificación (con los valores existentes), estado, prioridad y "fecha de fin hasta".
- [ ] **Ordenar** por cualquier columna, ascendente o descendente.
- [ ] Terminados y Cancelados **ocultos por defecto**, con la casilla "Mostrar terminados y cancelados".
- [ ] Los filtros y el orden viven en la URL (ADR-0003): un enlace compartido abre la misma vista.
- [ ] Mensaje "Ningún proyecto coincide con los filtros" y botón "Limpiar filtros".
- [ ] El filtro por tipo se suma con HU-21.

#### HU-07 · Fases (8 pts)

_Como responsable de un proyecto, quiero agrupar sus tareas en fases (y subfases), para ver el trabajo ordenado y el avance de cada parte, como en Project._

- [ ] Crear, renombrar, reordenar (subir/bajar) y dar de baja **fases** dentro de un proyecto; una fase puede contener tareas y otras fases, hasta **4 niveles**.
- [ ] Una tarea pertenece a una fase o queda **suelta** (sin fase); se puede mover de fase al crearla o editarla.
- [ ] La fase **calcula sola** su avance (con las reglas de HU-06), su inicio (el más temprano) y su fin (el más tardío) a partir de todo lo que contiene; no se capturan a mano.
- [ ] En el proyecto, las fases se ven como un **esquema con sangría** que se pliega y despliega, con su avance; el tablero se puede **filtrar por fase**.
- [ ] Dar de baja una fase manda a la papelera su contenido (subfases y tareas) y restaurarla lo devuelve, como un proyecto (HU-15).
- [ ] El tipo de contenedor (ADR-0004) decide si usa fases: Proyecto sí; Mantenimiento y Actividades, no por defecto.
- [ ] Cumple RNF-01 y RNF-05, con pruebas de permisos y de los cálculos (funciones puras en shared).

#### HU-26 · Muchas tareas en pantalla (5 pts)

_Como miembro, quiero ver las tareas en lista y filtrarlas, para manejar proyectos con muchas tareas._

- [ ] En el proyecto se alterna entre **Tablero** y **Lista** (tabla compacta y ordenable, agrupada por fases con sangría).
- [ ] Filtros: texto, **Mis tareas**, responsable, tipo, estado, vencidas y rango de fechas (se muestran las tareas cuyo rango se cruza con el elegido, como en el prototipo).
- [ ] Las columnas Hecha y Cancelada muestran las 10 más recientes y un botón "Ver más".
- [ ] Los filtros viven en la URL.
- [ ] La lógica de filtrado son funciones puras con pruebas.

### Sprints siguientes (criterios por detallar en su planificación)

- **HU-16 · Visibilidad:** un proyecto puede marcarse como restringido, con una lista de usuarios autorizados; los demás no lo ven en ninguna vista, búsqueda ni exportación.
- **HU-17 · Permisos por usuario:** pantalla con la **matriz de permisos** de cada miembro (filas: ver, crear, editar, borrar, exportar... sobre proyectos y tareas; columnas: lo que da su rol y el ajuste personal). El Admin concede o quita acciones concretas, por ejemplo limitar las altas o las modificaciones.
- **HU-29 · Mi perfil:** desde el menú del usuario, cambiar mi nombre, mi correo y mi contraseña. Cambiar el correo o la contraseña pide la **contraseña actual**; el correo nuevo se guarda en minúsculas y no puede estar en uso; al cambiarlos se **cierran mis demás sesiones**. Cumple RNF-01. Sin verificación por correo mientras no haya servicio de correo.
- **HU-30 · Usuarios del sistema:** pantalla solo para el **Admin del sistema** con todos los usuarios (nombre, correo, espacios, estado). Puede **cambiar el correo** de cualquiera (mismas reglas que HU-29; se cierran sus sesiones) y **desactivar o reactivar** una cuenta (una cuenta desactivada no inicia sesión y sus sesiones se cierran). El Admin de un espacio no cambia correos: quita al miembro e invita el correo correcto.
- **HU-27 · Gantt:** dentro de cada proyecto (sus tareas) y uno general del espacio (los proyectos como barras, con sus tareas desplegables). Barras con las fechas planeadas coloreadas por estado, línea de "hoy", vencido resaltado, **planeado contra real** (ADR-0004 §2.1), zoom semana / mes / trimestre, **fases como barras resumen** (HU-07) y Entregables como hitos (rombo). Sin librería nueva (cuadrícula de CSS). Dependencias entre tareas: más adelante, si hacen falta.
- **HU-13 · Exportar:** JSON (respaldo completo) y CSV con BOM UTF-8 (una fila por tarea, compatible con el formato del prototipo); respeta la visibilidad y excluye lo borrado. Sin dependencias nuevas.
- **HU-14 · Importar:** JSON o CSV, incluidos los respaldos del prototipo; "Actualizar" busca coincidencias por ID o, si no hay, por nombre sin distinguir mayúsculas; "Reemplazar" pide doble confirmación y manda lo anterior a la papelera; fechas normalizadas a AAAA-MM-DD (ambiguas = día/mes/año).
- **Integraciones (TEC-08 a HU-20):** diseño en ADR-0002 §7.
