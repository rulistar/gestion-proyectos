# Cierre de la versión 1.0

> Informe de cierre (PMI, grupo de procesos de Cierre). Resume qué se entregó, cómo se cumplió el acta, qué se aprendió y qué sigue. Fecha de cierre: **2026-11-01**.

| Campo | Valor |
|---|---|
| Versión | **1.0** (etiqueta `v1.0` en Git) |
| Periodo | 2026-10-22 (acta) → 2026-11-01 |
| Sprints | 7 (Scrum, planeados de 2 semanas; se completaron antes de su fecha) |
| Puntos entregados | **239** en 61 elementos del backlog (los 6 de integraciones pasaron a la v2) |
| Pull Requests fusionados | 95 hasta el cierre del Sprint 7, todos con CI en verde |
| Producción | https://gestion-proyectos-gnnp.onrender.com (Render Free + Neon Free, HTTPS) |
| Costo de infraestructura | $0 |

## 1. Notas de la versión 1.0

### Usuarios y acceso
- Registro **solo por invitación**; el primer Admin se crea con `pnpm setup:admin`. Una invitación puede dar acceso a varios espacios.
- Inicio y cierre de sesión con cookie HttpOnly, sesión en la BD y contraseñas con Argon2id; límite de intentos.
- Mi perfil: nombre, correo y contraseña (piden la contraseña actual y cierran las demás sesiones).
- Usuarios del sistema: el Admin del sistema cambia correos, desactiva cuentas y genera un enlace para restablecer una contraseña olvidada (también `pnpm reset:password`).

### Espacios de trabajo y permisos
- Espacios → proyectos, mantenimientos y actividades → fases (hasta 4 niveles) → tareas.
- Roles Admin, Miembro y Lector como **plantilla** de una **matriz de permisos por persona y espacio** (qué ve, crea, modifica y da de baja, por sección). Lo que no se ve responde 404.
- Seguir el trabajo de otras personas (solo lectura) y **Ver como** un miembro (el Admin ve lo que ve otra persona, sin poder cambiar nada).
- Mover un contenedor o una tarea a otro espacio, traduciendo los catálogos.

### Proyectos, mantenimientos y actividades
- Tipos de contenedor con comportamiento (con fin, continuo o por demanda) y tipos de tarea configurables; tipos de tarea permitidos por contenedor.
- Folios automáticos (PY, MT, ACT + AAMM + contador mensual), datos del proyecto, personas del proyecto, sprint, contenedores de trabajo o personales.
- **Campos de detalle por tipo** (texto, número, fecha, opciones, sí/no), definidos en Configuración.
- Avance, minutos pendientes, días restantes y fecha de fin calculados; avance y fechas por fase.

### Tareas y personas
- Estados Pendiente, En curso, Pausada (con motivo), Hecha y Cancelada (con motivo, se descuenta del avance).
- Responsable desde un **catálogo de personas por espacio**, con o sin cuenta; alias, archivar, fusionar duplicadas, ver dónde aparece y **compartir entre espacios**.
- Origen de la tarea (catálogo), minutos estimados, fechas planeadas y reales.

### Vistas
- Lista de contenedores con filtros y orden en la URL, filtro por año (abiertos, cerrados o ambos) y **tablero Kanban** por estado.
- Proyecto: Resumen, Tablero de tareas, Lista agrupada por fase y **Gantt** (planeado contra real); Gantt del espacio.
- Mi trabajo (mis tareas por fecha de fin), vista Tareas del espacio con filtros.
- **Gráficas** por mes de término y por estado (se muestran y ocultan) e **Indicadores** de tiempos por tipo.
- Menú lateral plegable, pantallas compactas, tema turquesa.

### Datos
- **Papelera**: borrado lógico restaurable; borrado físico solo desde la papelera y solo el Admin. Lo borrado no aparece en listas, exportaciones ni gráficas.
- **Exportar** en CSV para Excel y respaldo JSON; **Cargar información** desde JSON o Excel (solo actualizar, nunca borra), incluidos los respaldos del prototipo.
- Trazabilidad en toda entidad: quién y cuándo creó, modificó y dio de baja.

### Plataforma
- API versionada `/api/v1` (75 rutas) con **documentación OpenAPI** en `/api/v1/docs`.
- Seguridad HTTP: helmet, CORS restringido, límite de peticiones, HTTPS/HSTS y cookies `Secure` en producción.
- Calidad: 426 pruebas (313 de la API contra PostgreSQL real, 112 de reglas puras y un recorrido en el navegador con Playwright); CI con 4 checks obligatorios (lint/tipos/pruebas, `pnpm audit`, gitleaks y Playwright); Dependabot.
- 26 migraciones de Prisma, versionadas; 7 ADRs.

## 2. Cumplimiento del acta

| Objetivo (acta §2) | Resultado | Comentario |
|---|---|---|
| 1. MVP en producción al cierre del Sprint 3 | ⚠️ Cumplido con retraso | El alcance del MVP se cumplió por completo (ver abajo), pero la app llegó a producción en el Sprint 5 (TEC-04). Los Sprints 3 y 4 se dedicaron a lo que el PO pidió al usar la app en local |
| 2. 0 vulnerabilidades críticas/altas en cada release | ✅ Cumplido | `pnpm audit --audit-level=high` en cada PR. Quedan 2 moderadas en una dependencia indirecta (`glob` vía `@fastify/static`) |
| 3. Cobertura ≥ 70 % en la lógica de negocio del backend | ❓ No medido | Las reglas de negocio tienen pruebas (426), pero no se instaló una herramienta de cobertura. Medirla requiere `@vitest/coverage-v8`, una dependencia nueva que se propone para la v2 |
| 4. API documentada (OpenAPI) antes del Sprint 6 | ⚠️ Cumplido con retraso | TEC-05, en el Sprint 7 |

| Alcance del MVP (acta §3) | Estado |
|---|---|
| Autenticación y roles (Admin, Miembro, Lector) | ✅ y además la matriz de permisos por persona |
| Espacios → proyectos → fases/entregables → tareas | ✅ |
| Tabla con filtros (estado, prioridad, fechas, clasificación) | ✅ |
| Tablero Kanban y vista de detalle | ✅ |
| Fechas, % de avance, días restantes | ✅ |
| Gráficas por mes de término y por estado (mostrar/ocultar) | ✅ |
| Respaldo e importación JSON/Excel (actualizar o reemplazar) | ✅ solo "actualizar"; "reemplazar" se dejó fuera por decisión del PO (riesgo de pérdida de datos) |

Del **backlog futuro** se adelantó el **Gantt**. Las **integraciones** (tokens de API, webhooks, app de estudio) pasan a la v2 porque la app de estudio todavía no existe.

**Riesgos iniciales (acta §6):** ninguno se materializó con impacto alto. La curva de aprendizaje se atendió con explicaciones en cada paso; el escaneo de secretos detectó una contraseña de prueba en el Sprint 4 antes de llegar a `main`; el crecimiento del alcance fue real (hasta 43 % por sprint) pero siempre con historia de usuario y anotado el mismo día. Pérdida de datos: Neon Free solo recupera las últimas 6 horas, así que el respaldo depende de sacar uno propio con `pg_dump` antes de cada sprint ([despliegue.md](despliegue.md#4-respaldos)) y del export JSON.

## 3. Indicadores

| Sprint | Objetivo | Comprometido | Entregado |
|---|---|---|---|
| 1 | Iniciar sesión y crear un espacio de forma segura | 24 | 24 |
| 2 | Proyectos, tareas, avance e invitaciones con rol | 21 | 21 |
| 3 | Más control: pausar/cancelar, papelera, miembros, rediseño | 26 | 37 |
| 4 | Personas reales, responsables, tipos de tarea, filtros | 28 | 36 |
| 5 | En la nube con HTTPS, fases, permisos por persona | 34 → 32 | 56 |
| 6 | Cierre del MVP: Gantt, campos por tipo, Kanban, exportar y cargar | 32 | 48 |
| 7 | Gráficas, personas compartidas, OpenAPI y Playwright | 17 | 17 |
| **Total** | | **182** | **239** |

El 31 % de lo entregado se pidió a mitad de sprint. Los puntos midieron el tamaño relativo, no el calendario: el trabajo real ocurrió en 11 días.

## 4. Lecciones aprendidas

Del registro de las 7 retrospectivas. Formato: qué pasó → qué se hace desde entonces.

**Producto y alcance**
1. **Confirmar con un ejemplo concreto antes de tocar el modelo de datos.** "Actividad, Gestión y Seguimiento" se construyó como tres responsables y eran tipos de tarea (Sprint 4, una migración extra); "Fin hasta" se entendió distinto. Desde el Sprint 5 cada diseño se confirma con un ejemplo y no hubo retrabajo de fondo. Pendiente de reforzar: las reglas que surgen durante la construcción también se confirman antes (HU-50).
2. **Probar historia por historia no basta.** El PO pidió una prueba integral con datos reales (Sprint 2). Desde el Sprint 4 cada sprint tiene un guion de demostración desde la planificación.
3. **El alcance crece al usar la app.** Lo agregado a mitad de sprint se anota el mismo día con sus puntos y, si no cabe, se dice qué sale (acuerdo del Sprint 5).
4. **El MVP del acta era menor que lo que el PO necesitaba**: permisos por persona, catálogo de personas y tipos de trabajo no estaban en el acta y fueron lo más valioso. El acta de la v2 debe partir del uso real.

**Flujo de trabajo**
5. **Una rama y un PR por historia, fusionado antes de empezar la siguiente.** Las ramas apiladas, las correcciones a PRs ya fusionados y una rama borrada sin fusionar (Sprints 2 y 4) se resolvieron verificando en GitHub antes de subir o borrar.
6. **`pnpm dev` usa la rama local.** Errores "falsos" por una API desactualizada o por estar en otra rama: reiniciar `pnpm dev` tras fusionar o cambiar de rama, y decir en cada PR si hay que hacerlo.
7. **Cuando una historia se entrega en partes, el PR dice qué todavía no se ve** (Sprint 6).
8. **Dar tiempo de probar antes de fusionar**: cada PR trae "Cómo probarlo" con un ejemplo, y cada fusión se confirma en producción.

**Técnica**
9. **Correr todas las verificaciones antes de cada commit** (`format:check`, `lint`, `typecheck` completo, `test`, `build`); el CI falló cuando solo se revisó un paquete.
10. **Las pruebas no deben depender del reloj.** Dos fallas al azar (folio con la fecha del día, límite de intentos) se corrigieron fijando la fecha o el tiempo; diagnosticar la causa real antes de declarar una corrección.
11. **Migraciones: crearlas una vez, revisarlas y luego aplicarlas.** Una migración aplicada dos veces en desarrollo se tuvo que revertir a mano (Sprint 5).
12. **Despliegue: revisar después de cada fusión.** El caché de Render saltó `prisma generate` (Sprint 5) y solo se notó en su panel; desde entonces se comprueba la versión publicada.
13. **Smart App Control limita las herramientas con binarios nativos** (Vite 8, navegadores descargados). Preguntar antes de instalar y preferir alternativas firmadas (Edge para Playwright).
14. **gitleaks funciona**: detectó una contraseña de prueba; las contraseñas de prueba se generan al azar.

## 5. Pendientes conocidos (entran al análisis de la v2)

- Medir la cobertura de pruebas (objetivo 3 del acta).
- Paquete de la web de 850 kB: dividirlo antes de la app en Android.
- 2 vulnerabilidades moderadas indirectas (`glob`/`minimatch` vía `@fastify/static`): esperar la versión corregida.
- Respaldos: Neon Free solo recupera 6 horas; el respaldo propio es manual. Probar una restauración completa y evaluar automatizarlo.
- Render Free "duerme" sin uso: el primer acceso tarda.
- El nombre comercial del producto sigue provisional (`APP_NAME`).

## 6. Qué sigue

Plan acordado con el PO (2026-10-31), detalle en [sprint-07.md](sprints/sprint-07.md#después-del-sprint-7-cierre-de-la-versión-1):

1. **Uso real durante 2 a 4 semanas.** El PO anota sus observaciones en [v2/observaciones-uso.md](v2/observaciones-uso.md).
2. **Tres opiniones para la versión 2:** el análisis de Claude Code en una sesión nueva, las observaciones del PO y la revisión de otra IA a partir de [v2/descripcion-para-revision.md](v2/descripcion-para-revision.md).
3. **Acta y backlog de la v2:** app en Android (PWA, en línea primero), integraciones con la app de estudio y las mejoras priorizadas.

## 7. Aceptación

La versión 1.0 se acepta como cerrada por el Product Owner: ☐ Sí — Fecha: ________
