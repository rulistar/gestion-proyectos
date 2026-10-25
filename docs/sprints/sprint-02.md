# Sprint 2 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-24 → 2026-11-06** (se adelanta: el Sprint 1 terminó antes de lo previsto) |
| Capacidad | 5–10 h/semana (PO + Claude Code) |
| Compromiso | **21 puntos** |

## Objetivo del sprint

> **"Gestiono mis proyectos y tareas viendo su avance, e invito a mi equipo con un rol."**

Al final del sprint el Admin entra a un workspace, crea proyectos y tareas, las mueve entre Pendiente, En curso y Hecha, ve el % de avance y los días restantes, e invita a otra persona que entra con el rol asignado. Cada endpoint verifica la membresía y los permisos del rol (RNF-02).

## Elementos comprometidos

Orden elegido por el PO: **primero los proyectos** (la app se puede usar pronto con datos reales) y al final las invitaciones.

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-05 | Crear y editar proyectos (+ catálogo de permisos y `requirePermission`) | 5 |
| 2 | HU-08 | Crear y asignar tareas, y moverlas entre estados | 5 |
| 3 | HU-06 | % de avance, minutos pendientes y días restantes | 3 |
| 4 | HU-04 | Invitar miembros con un rol | 5 |
| 5 | HU-01 | Aceptar una invitación | 3 |
| | | **Total** | **21** |

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-2).

## Decisiones del PO para este sprint (2026-10-24)

| Tema | Decisión |
|---|---|
| Entrega de invitaciones | **Enlace para copiar.** La app muestra el enlace al Admin y él lo envía por el medio que quiera. Sin servicio de correo ni dependencias nuevas; el envío automático puede llegar después. |
| Caducidad de la invitación | **48 horas**, un solo uso. Si caduca, el Admin genera otra. |
| Orden | Proyectos → tareas → avance → invitar → aceptar. |

## Plan de trabajo (una rama y un PR por elemento)

1. HU-05 → 2. HU-08 → 3. HU-06 → 4. HU-04 → 5. HU-01.

Cada PR incluye la sección **"Cómo probarlo"** (acuerdo de la retrospectiva del Sprint 1). El PO lo prueba antes de fusionarlo.

## Dependencias nuevas

**Ninguna prevista.**
- Las fechas se manejan como texto `AAAA-MM-DD` (columnas `date`) con las funciones nativas de JavaScript.
- Las tareas se mueven entre estados con un selector, sin arrastrar. El arrastre llega con el Kanban (HU-10, Sprint 3).

Si apareciera una necesidad, se propondrá con su porqué antes de instalar nada.

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Errores de zona horaria con fechas sin hora (un día de diferencia) | Media | Media | Columnas `date` y texto `AAAA-MM-DD` en el contrato; "hoy" se calcula en la zona del usuario; pruebas con casos límite. |
| La autorización por rol se olvida en algún endpoint | Media | Alta | `requirePermission()` reutilizable, más pruebas de Lector y de no miembro en cada endpoint. |
| Fuga de un enlace de invitación | Baja | Media | Un solo uso, 48 h, solo se guarda el hash del token, el Admin puede revocarlo, límite de intentos. |
| Curva de aprendizaje (permisos, relaciones entre tablas) | Alta | Media | Explicación en cada PR y la guía de la arquitectura como referencia. |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-24 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión (_review_) | Al terminar las 5 historias | Demostración del objetivo funcionando |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar, qué probar en el Sprint 3 |

## Resultado (cierre: 2026-10-25)

- Puntos completados: **21 / 21**
- Objetivo cumplido: ☑ Sí ☐ No. El PO hizo la demostración completa: proyecto real con tareas, avance, invitar a un Lector y a un Miembro, permisos por rol.

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| HU-05 | Crear y editar proyectos (con permisos por rol) | 5 | #14 |
| HU-08 | Tareas: crear, asignar y mover | 5 | #15 |
| HU-06 | Avance: %, minutos pendientes, días restantes | 3 | #16 |
| HU-04 | Invitar miembros con un rol | 5 | #17 |
| HU-01 | Aceptar una invitación | 3 | #18 |

- 136 pruebas en verde. Además: [ADR-0004](../adr/ADR-0004-tipos-de-trabajo.md), tipos de trabajo configurables (#19).

**Comentarios del PO en la demostración**, que pasan al backlog:

| Comentario | Respuesta |
|---|---|
| No hay forma de dar de baja un proyecto | HU-15 (papelera) se adelanta al Sprint 3 |
| Las tareas necesitan estados Pausada y Cancelada | HU-24: Pausada cuenta como pendiente; Cancelada se descuenta; motivo obligatorio |
| Gantt para ver los avances | HU-27, del proyecto y del espacio, con planeado contra real |
| Con muchas tareas, ¿cómo se manejan en pantalla? | HU-26: vista Lista, filtros, columnas plegables |
| Filtros y orden en la lista de proyectos | HU-09 ampliada con orden por columna |
| Dar de baja a un usuario invitado | HU-25: cambiar el rol y quitar del espacio |
| Permisos por usuario (limitar altas, modificaciones, visualizaciones) | HU-17 (matriz de permisos) y HU-16 (visibilidad por proyecto) |

### Retrospectiva

**Salió bien**

- Los 21 puntos, cada uno con su sección "Cómo probarlo", y el PO probó cada historia antes de fusionarla.
- La necesidad de los tipos de trabajo se detectó **antes** de construir la tabla y el Kanban: corregir el diseño cuesta poco; corregir código ya hecho, mucho.
- Las dudas con GitHub (rama "out-of-date", ramas apiladas) se resolvieron sobre la marcha.

**A mejorar**

- **Punto del PO:** probar historia por historia no basta para validar que el conjunto es lo que quiere. Hace falta una prueba integral con datos reales.
- Una API desactualizada en `pnpm dev` causó un error falso. Remedio: reiniciar `pnpm dev` tras fusionar o cambiar de rama.
- Dos ramas quedaron apiladas porque un PR se creó tarde.

**Acuerdos para el Sprint 3**

1. **Validar el concepto antes de construir todo:** en las historias grandes, primero una versión que el PO pueda probar en el navegador; después el resto.
2. **Demostración integral en cada revisión**, con datos reales del PO.
3. **Fusionar un PR antes de empezar el siguiente**, salvo que el PO decida otra cosa.