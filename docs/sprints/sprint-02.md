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

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 21
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
