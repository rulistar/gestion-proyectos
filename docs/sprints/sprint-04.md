# Sprint 4 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-26 → 2026-11-08** |
| Capacidad | 5–10 h/semana (PO + Claude Code). Velocidad del Sprint 3: 37 pts; el límite real es el tiempo del PO para probar |
| Compromiso | **28 puntos** |

## Objetivo del sprint

> **"Cada tarea dice quién la hace, quién la gestiona y quién le da seguimiento, con las personas reales de mi equipo (tengan o no cuenta), y encuentro rápido lo que busco."**

Responde a la revisión del Sprint 3: catálogo de personas con alias, tres responsabilidades por tarea, datos del sprint en el proyecto y tipos de tarea por contenedor. Diseño: [ADR-0005](../adr/ADR-0005-personas-y-responsabilidades.md).

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-33 | Sprint en proyectos y mantenimientos: "Sprint" y "Actividades del sprint" | 2 |
| 2 | HU-34 | Catálogo de personas por espacio, con vínculo a usuarios (alias) | 5 |
| 3 | HU-35 | Responsabilidades de la tarea: Actividad, Gestión y Seguimiento | 5 |
| 4 | HU-36 | Personas del proyecto desde el catálogo | 3 |
| 5 | HU-37 | Tipos de tarea por contenedor (subconjunto de su tipo) | 3 |
| 6 | HU-32 | Mover un proyecto, mantenimiento o tarea a otro espacio | 5 |
| 7 | HU-09 | Filtros y orden en la lista de proyectos | 5 |
| | | **Total** | **28** |

**Agregadas por el PO durante el sprint (acuerdo 2 de la retrospectiva):**

| Fecha | ID | Elemento | Pts |
|---|---|---|---|
| 2026-10-26 | — | Quitar la columna Solicitante de Proyectos y Mantenimientos | — |
| 2026-10-26 | HU-38 | Folios automáticos PY / MT / ACT + AAMM + contador mensual | 3 |
| 2026-10-27 | HU-39 | Vista "Tareas": todas las tareas del espacio con filtros y orden | 5 |

El compromiso queda en **36 puntos**.

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-4).

**Pasan al Sprint 5:**
- Fases (HU-07).
- Vista Lista (HU-26).
- Despliegue (TEC-04).
- Campos de detalle (HU-23), que el PO sacó del sprint al planificar.

El PO puede reordenar.

## Plan de trabajo

1. Una rama y un PR por historia, con **"Cómo probarlo"**. El PO prueba antes de fusionar.
2. Se fusiona un PR antes de empezar el siguiente.
3. Antes de pedir una prueba, la carpeta del PO queda en la rama que trae el cambio: `pnpm dev` ejecuta lo que esté en ella (lección del Sprint 3).
4. Revisión con el **guion de demostración** y datos reales del PO.

## Dependencias nuevas

**Ninguna prevista.**

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Las migraciones con datos (responsable → Actividad, texto → personas) pierden o duplican información | Media | Alta | SQL revisado a mano, verificado contra la base del PO antes del PR, con pruebas |
| Nombres casi iguales crean personas duplicadas ("Carlos Ruiz" y "carlos ruiz ") | Media | Baja | Se comparan sin espacios sobrantes ni mayúsculas; el Admin puede fusionar después archivando |
| "Mi trabajo" deja de mostrar tareas al cambiar de responsable a persona | Baja | Media | La migración vincula cada miembro con su persona; prueba específica |
| Ocho historias seguidas cansan la prueba del PO | Media | Media | Historias chicas primero; guion de prueba corto en cada PR |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-26 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión | Al terminar las 7 historias | Guion de demostración con datos reales |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar |

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 28
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
