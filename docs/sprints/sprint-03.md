# Sprint 3 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-25 → 2026-11-07** |
| Capacidad | 5–10 h/semana (PO + Claude Code) |
| Compromiso | **21 puntos** |

## Objetivo del sprint

> **"Trabajo con más control: pauso o cancelo tareas con motivo, doy de baja proyectos y miembros, y encuentro rápido lo que busco aunque sean muchos."**

Responde a los comentarios del PO en la revisión del Sprint 2.

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-24 | Pausar y cancelar tareas con motivo | 3 |
| 2 | HU-15 | Papelera: dar de baja, restaurar y borrar definitivamente | 5 |
| 3 | HU-25 | Gestionar miembros: cambiar el rol y quitar del espacio | 3 |
| 4 | HU-09 | Tabla de proyectos con filtros y orden | 5 |
| 5 | HU-26 | Muchas tareas: vista Lista, filtros y columnas plegables | 5 |
| | | **Total** | **21** |

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-3).

## Siguientes sprints (orden del PO)

| Sprint | Contenido |
|---|---|
| 4 | Tipos de trabajo ([ADR-0004](../adr/ADR-0004-tipos-de-trabajo.md)): HU-21, HU-22, HU-23 + despliegue (TEC-04) |
| 5 | Gantt (HU-27), permisos por usuario (HU-17) y visibilidad por proyecto (HU-16) |
| 6 | Kanban de proyectos, fases, exportar, Swagger y pruebas extremo a extremo → **MVP** |

## Plan de trabajo

1. Una rama y un PR por historia, con la sección **"Cómo probarlo"**; el PO prueba antes de fusionar.
2. Se fusiona un PR antes de empezar el siguiente (acuerdo de la retrospectiva).
3. Revisión con **demostración integral** usando datos reales del PO.

## Dependencias nuevas

**Ninguna prevista.** Los filtros usan los `search params` de TanStack Router (ADR-0003), que ya está instalado.

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Borrar definitivamente por error | Media | Alta | Solo desde la papelera, solo Admin, escribiendo el nombre para confirmar |
| Quitar al último Admin y dejar el espacio sin administración | Baja | Alta | Regla en la API y prueba que lo verifica |
| Cambiar los estados de tarea rompe el avance ya calculado | Media | Media | Migración del `enum` y pruebas de la regla de avance con los 5 estados |
| El MVP se recorre a los sprints 5 y 6 | Alta | Media | Decisión consciente del PO; el despliegue (TEC-04) se adelanta al Sprint 4 |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-25 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión | Al terminar las 5 historias | Demostración integral con datos reales del PO |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar |

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 21
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
