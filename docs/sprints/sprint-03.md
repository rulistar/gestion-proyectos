# Sprint 3 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-25 → 2026-11-07** |
| Capacidad | 5–10 h/semana (PO + Claude Code) |
| Compromiso | **26 puntos** (repriorizado por el PO el 2026-10-25: rediseño y tipos primero) |

## Objetivo del sprint

> **"Trabajo con más control: pauso o cancelo tareas con motivo, doy de baja proyectos y miembros, y encuentro rápido lo que busco aunque sean muchos."**

Responde a los comentarios del PO en la revisión del Sprint 2. **Cambio del PO (2026-10-25):** antes de seguir, rediseñar la interfaz ([maqueta](https://claude.ai/artifact/QkTijPe4GF7EtTePxQHYFR)) y adelantar los tipos de trabajo; la papelera (HU-15), miembros (HU-25) y filtros (HU-09, HU-26) pasan al Sprint 4.

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-24 | Pausar y cancelar tareas con motivo | 3 |
| 2 | HU-28a | Rediseño: nueva estructura (menú lateral, combo de espacios, tema, login) | 5 |
| 3 | HU-28b | Rediseño: pantalla "Mi trabajo" | 5 |
| 4 | HU-28c | Rediseño: página del proyecto y ventanas | 5 |
| 5 | HU-21 | Tipos de contenedor (proyecto, mantenimientos, actividades) | 5 |
| 6 | HU-22 | Tipos de tarea (incidencia, fast track…) | 3 |
| | | **Total** | **26** |

**Adelantadas por el PO (2026-10-25):** tras probar HU-28a pidió ya la baja de miembros y de proyectos. Entran al sprint HU-25 Gestionar miembros (3 pts, ✅) y HU-15 Papelera (5 pts); el sprint queda en 34 pts.

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-3).

## Siguientes sprints (orden del PO)

| Sprint | Contenido |
|---|---|
| 4 | Filtros (HU-09, HU-26), campos de detalle (HU-23) y despliegue (TEC-04) |
| 5 | Gantt (HU-27), permisos por usuario (HU-17) y visibilidad por proyecto (HU-16) |
| 6 | Kanban de proyectos, fases, exportar, Swagger y pruebas extremo a extremo → **MVP** |

## Plan de trabajo

1. Una rama y un PR por historia, con la sección **"Cómo probarlo"**; el PO prueba antes de fusionar.
2. Se fusiona un PR antes de empezar el siguiente (acuerdo de la retrospectiva).
3. Revisión con **demostración integral** usando datos reales del PO.

## Dependencias nuevas

Aprobadas por el PO para el rediseño (HU-28): `lucide-react` 1.59.0, `@radix-ui/react-dialog` 1.3.1, `@radix-ui/react-dropdown-menu` 2.2.1 y `sonner` 2.0.8 (estándar de shadcn/ui; versiones con más de una semana publicadas; `pnpm audit` sin hallazgos).

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
