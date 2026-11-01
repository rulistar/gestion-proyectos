# Gestor de Proyectos v1.0 — descripción para una revisión externa

> Documento para que **otra IA** revise la aplicación y proponga mejoras para la versión 2, sin acceso al código. Lo preparó Claude Code al cerrar la v1 (2026-11-01). Describe hechos, no opiniones. Las debilidades que el equipo ya conoce están al final (sección 9): conviene leerlas después de formarse una opinión propia. No contiene secretos ni datos personales.

## Instrucciones para quien revisa

Eres un consultor senior en gestión de proyectos (PMBOK 7, Scrum) y en arquitectura de software web. Revisa la aplicación descrita abajo y entrega, en español:

1. **Análisis funcional**: qué tan bien cubre la gestión de proyectos de una persona y un equipo pequeño, comparado con PMBOK (alcance, cronograma, recursos, riesgos, interesados, comunicaciones) y con Scrum. Qué falta y qué sobra.
2. **Experiencia de uso**: flujos que probablemente cuesten, consistencia, uso en celular y tablet.
3. **Análisis técnico**: arquitectura, modelo de datos, seguridad, rendimiento, pruebas, operación con presupuesto $0 y deuda técnica.
4. **Propuesta para la v2**, priorizada con **MoSCoW** (Must, Should, Could, Won't), con una frase de por qué para cada punto y su tamaño relativo (S, M, L).
5. **Riesgos de la v2** y cómo mitigarlos.

Restricciones que tu propuesta debe respetar: presupuesto de infraestructura $0, un solo lenguaje (TypeScript), desarrollo a tiempo parcial por una persona que está aprendiendo el stack con ayuda de IA, y la PC de desarrollo con Windows y *Smart App Control* (bloquea binarios nativos no firmados).

## 1. Contexto

- **Propósito**: gestionar proyectos personales y de un equipo pequeño (hasta ~10 personas), con crecimiento por módulos e integración con otras apps por API.
- **Origen**: generaliza un prototipo previo, "Gestor de cursos" (una sola página, datos en el navegador): curso → proyecto, unidad → fase, actividad → tarea, con sus mismos estados y reglas de avance.
- **Equipo**: una persona (Product Owner y único usuario principal) más Claude Code como implementador.
- **Método**: PMI para el gobierno (acta, ADRs, riesgos, cierre) y Scrum para la ejecución (7 sprints; 239 puntos en 61 historias; una rama y un Pull Request por historia).
- **Estado**: en producción desde el sprint 5, gratis (Render Free para la app, Neon Free para PostgreSQL), con HTTPS. La v1 se cerró el 2026-11-01 y empieza un periodo de 2 a 4 semanas de uso real.

## 2. Conceptos del dominio

```
Espacio de trabajo (workspace)
 ├─ Miembros (usuario + rol + matriz de permisos)
 ├─ Catálogos: tipos de contenedor, tipos de tarea, orígenes de tarea, campos de detalle, personas
 └─ Contenedores (proyecto, mantenimiento o actividad, según su tipo)
     ├─ Fases anidadas (hasta 4 niveles)
     └─ Tareas (cada una en una fase o sin fase)
```

- **Contenedor**: todo lo que agrupa tareas. Su **tipo** define un **comportamiento**:
  - **Con fin** (proyectos): fecha de fin, % de avance, días restantes, Gantt.
  - **Continuo** (mantenimientos): no termina; se mide por tareas abiertas, vencidas y hechas en el mes.
  - **Por demanda** (actividades): agrupa trabajo que llega suelto.
- Los contenedores pueden ser **de trabajo** o **personales** (los personales ocultan los campos de trabajo: folio, solicitante, PM…).
- **Folio automático**: prefijo según comportamiento (PY, MT, ACT) + AAMM + contador mensual por espacio. "Sin folio" es el único repetible.
- **Persona**: entrada de un catálogo por espacio, **con o sin cuenta de usuario**. Las tareas y los roles del proyecto (solicitante, asignado a, PM, gerente de consultoría, business partner) apuntan a personas, no a usuarios, para poder registrar a quien no usa la app. Una persona puede tener alias, archivarse, fusionarse con un duplicado y **compartirse con otros espacios** (se edita solo en su espacio dueño).
- **Tipos de tarea** configurables (p. ej. Actividad, Gestión, Seguimiento, Incidencia); cada contenedor puede limitar cuáles admite.
- **Campos de detalle por tipo**: campos adicionales definidos por el Admin para un tipo de contenedor o de tarea (texto corto o largo, número, fecha, opciones, sí/no). La clase no cambia después de crear el campo; las opciones solo se agregan; los campos se archivan, no se borran. Se guardan en una columna JSONB.
- **Origen de tarea**: catálogo de dónde viene el trabajo (por omisión: Correo, Teléfono, Junta, Ticket).

## 3. Funcionalidad

**Acceso**
- Registro solo por invitación (enlace con token de un solo uso). Una invitación puede dar acceso a varios espacios. El primer Admin se crea por terminal.
- Sesión en cookie HttpOnly con expiración por inactividad; contraseñas Argon2id; límite de intentos en inicio de sesión y cambios de perfil.
- Restablecer contraseña sin correo: el Admin del sistema genera un enlace (48 h, un solo uso) y lo entrega por el medio que acuerden; también por terminal.
- Mi perfil (nombre, correo, contraseña); Admin del sistema: cambiar correos, desactivar y reactivar cuentas.

**Permisos** (la parte más elaborada)
- Roles por espacio: **Admin, Miembro, Lector**. El rol es una **plantilla** que llena una **matriz por persona y espacio**: para proyectos, mantenimientos, actividades y tareas, qué **ve** (lo suyo, todo o una lista), y si **crea, modifica o da de baja**.
- "Lo suyo" se define por las personas: lo que la persona tiene asignado o en lo que participa.
- **Seguir a otras personas**: ver en solo lectura el trabajo de personas elegidas.
- **Ver como**: el Admin ve la app exactamente como la ve otro miembro, sin poder cambiar nada.
- Lo que alguien no puede ver responde 404 (no revela que existe). Un solo filtro de visibilidad en la API para proyectos y tareas.
- Solo el Admin del sistema crea espacios.

**Trabajo diario**
- Estados de tarea: Pendiente, En curso, Pausada (con motivo), Hecha, Cancelada (con motivo).
- Estados de contenedor: Sin iniciar, En curso, Pausado, Cancelado, Terminado.
- Fechas **planeadas** (las pone la persona) y **reales** (las registra el sistema al pasar a En curso y a Hecha/Terminado; no se editan).
- Responsable, minutos estimados, origen, fase, tipo y campos de detalle por tarea.
- Mover un contenedor o una tarea a otro espacio (Admin en ambos), traduciendo los catálogos.

**Vistas**
- Lista de contenedores por sección (Proyectos, Mantenimientos, Actividades), con filtros y orden guardados en la URL, filtro por año (abiertos, cerrados o ambos) y **tablero Kanban** por estado.
- Proyecto: pestañas **Resumen** (KPIs, tareas por estado, avance por fase, próximas a vencer), **Tablero** de tareas, **Lista** agrupada por fase y **Gantt** (barras planeadas contra reales, hitos, línea de hoy). Gantt del espacio.
- **Mi trabajo**: mis tareas agrupadas por fecha de fin, con filtro para ver las de personas que sigo.
- **Tareas**: todas las tareas visibles del espacio con filtros.
- **Gráficas** (se muestran/ocultan sobre cada lista): contenedores por mes de término planeado, coloreados por resultado, y por estado. **Indicadores** por tipo: tiempo de espera, de trabajo y de atención, % a tiempo y desviación contra lo planeado.

**Datos**
- Papelera: borrado lógico restaurable; borrado físico solo desde la papelera y solo el Admin. Lo borrado no aparece en listas, exportaciones ni gráficas.
- Exportar CSV (compatible con Excel, con BOM) y JSON completo. Cargar desde CSV o JSON con vista previa: solo agrega y actualiza, nunca borra; reconoce los respaldos del prototipo.
- Trazabilidad en toda entidad: creado, modificado y dado de baja por quién y cuándo.

**Reglas de cálculo**
- % de avance = tareas Hechas / tareas no canceladas, redondeado; Pausada cuenta como pendiente.
- Trabajo pendiente = suma de minutos estimados de las tareas no hechas ni canceladas.
- Días restantes contra la fecha de fin, con la fecha local del usuario (no la del servidor).
- Fase: avance y fechas calculados desde sus tareas y subfases.

## 4. Arquitectura

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces; Node 24; TypeScript estricto en todo |
| Web | React 19, Vite 7, TanStack Router y Query, Tailwind CSS 4, componentes shadcn/ui copiados (Radix), iconos lucide |
| API | Fastify 5, monolito modular (un módulo por funcionalidad), 75 rutas bajo `/api/v1` |
| Contrato | Esquemas Zod 4 en un paquete compartido: validan la entrada en la API, las respuestas en la web y generan la documentación OpenAPI |
| Datos | PostgreSQL 17 con Prisma 7 (26 migraciones versionadas); IDs UUID v7; índices únicos parciales que ignoran la papelera |
| Despliegue | Una sola app en Render Free: la API también sirve la web compilada (misma URL, sin CORS en producción); BD en Neon Free |

- La web no guarda tokens: la sesión viaja solo en la cookie. La web oculta botones con las mismas reglas de permisos del paquete compartido, pero la autorización real es del backend en cada ruta.
- Las reglas de negocio puras (avance, filtros, Gantt, gráficas, permisos, importación) viven en el paquete compartido, sin BD, con pruebas unitarias; la API y la web usan las mismas.
- Las fechas de calendario se guardan como `date` y viajan como texto `AAAA-MM-DD`.

**Modelo de datos (tablas principales)**: User, Session, PasswordReset, Workspace, Membership (rol + matriz), MembershipProjectAccess y MembershipPersonAccess (listas de la matriz y personas seguidas), Invitation e InvitationGrant, Person y PersonShare, ProjectType, TaskType y su relación de permitidos, DetailField, TaskOrigin, FolioCounter, Project, Phase, Task.

**Decisiones de arquitectura registradas (ADRs)**: 1) stack; 2) modelo de datos, permisos y borrado; 3) enrutador de la web; 4) tipos de trabajo configurables y fechas planeadas/reales; 5) catálogo de personas; 6) permisos por persona y visibilidad; 7) despliegue gratuito.

## 5. Seguridad

- Helmet (CSP, nosniff, frame-options), CORS restringido a orígenes conocidos, límite de peticiones global y estricto en rutas sensibles.
- HTTPS obligatorio en producción: redirección, HSTS de un año y cookies `Secure` + `SameSite`.
- Tokens de invitación, sesión y restablecimiento: aleatorios para el usuario; en la BD solo su hash SHA-256. Los enlaces llevan el token tras `#`, así que no llegan a los registros del servidor.
- Toda entrada (cuerpo, parámetros, encabezados, archivos importados) se valida con Zod. Acceso a datos solo con Prisma.
- Secretos solo en variables de entorno validadas al arrancar. Escaneo de secretos (gitleaks) y auditoría de dependencias en cada PR; Dependabot.

## 6. Calidad y proceso

- 426 pruebas: 313 de la API contra PostgreSQL real (base aparte, sin red, con `inject`), 112 unitarias de reglas puras y un recorrido en el navegador con Playwright (iniciar sesión → crear proyecto → crear tarea → terminarla → avance al 100 %).
- CI en GitHub Actions con 4 checks obligatorios para fusionar en `main`: formato, lint, tipos, pruebas y compilación; auditoría de dependencias (falla con altas o críticas); escaneo de secretos; Playwright.
- Cada historia tiene criterios de aceptación en el backlog; cada PR trae instrucciones de prueba; el PO prueba en local antes de fusionar y se confirma el despliegue en producción.
- Documentación: acta, 7 ADRs, backlog priorizado (MoSCoW), un documento por sprint (plan, revisión, retrospectiva), guía de despliegue y documentación OpenAPI en `/api/v1/docs` (con sesión en producción).

## 7. Operación

- Render Free "duerme" tras un rato sin uso: el primer acceso tarda.
- Neon Free solo permite recuperar las últimas 6 horas; el respaldo depende de un `pg_dump` manual antes de cada sprint y del export JSON.
- Sin servicio de correo: invitaciones y restablecimientos se entregan como enlaces que el Admin copia.
- Registros de la app en Render, sin datos personales ni secretos.

## 8. Planes ya decididos para la v2

- **App en Android** (celular y tablet): una sola app adaptable, recomendada como **PWA** y en línea primero, contra la misma API.
- **Integraciones con una app de estudio** (cursos + vocabulario), en ambas direcciones, cada sistema dueño de sus datos: tokens de API para apps externas, webhooks salientes firmados con reintentos (patrón outbox), webhooks entrantes idempotentes, vincular proyectos/fases/tareas con cursos, unidades y actividades, y crear fases y tareas desde un curso.
- El acta original deja fuera: facturación, chat en tiempo real y multiempresa (SaaS).

## 9. Debilidades conocidas

Las registró el equipo; la revisión puede confirmarlas, matizarlas o encontrar otras.

- La cobertura de pruebas no se mide (el acta pedía ≥ 70 % en la lógica de negocio).
- El paquete de la web pesa ~850 kB sin dividir.
- La interfaz se diseñó y probó en escritorio; no hay una versión pensada para celular o tablet.
- No hay notificaciones (ni correo ni en la app), ni bitácora de auditoría consultable, ni registro de riesgos o interesados.
- No hay estimación por puntos ni sprints formales dentro de la app: "Sprint" es un campo de texto del contenedor.
- La importación solo actualiza (nunca reemplaza ni borra).
- Respaldos manuales; hosting gratuito con arranque en frío.
- El nombre comercial del producto es provisional.
