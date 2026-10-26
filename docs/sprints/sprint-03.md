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

**Adelantadas por el PO (2026-10-25):** tras probar HU-28a pidió ya la baja de miembros y de proyectos. Entran al sprint HU-25 Gestionar miembros (3 pts, ✅), HU-15 Papelera (5 pts, ✅) y, para cargar información real, HU-31 Datos del proyecto (3 pts); el sprint queda en 37 pts.

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-3).

## Siguientes sprints (orden del PO)

| Sprint | Contenido |
|---|---|
| 4 | Ver [sprint-04.md](sprint-04.md): personas y responsabilidades (HU-33 a HU-37), mover entre espacios (HU-32) y filtros (HU-09) |
| 5 | Fases (HU-07), vista Lista (HU-26), despliegue (TEC-04), campos de detalle (HU-23), Gantt (HU-27), permisos (HU-17, HU-16), Mi perfil (HU-29) y usuarios del sistema (HU-30). Se ajusta en su planificación |
| 6 | Kanban de proyectos, exportar, Swagger y pruebas extremo a extremo → **MVP** |

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

## Resultado (cierre: 2026-10-26)

- Puntos completados: **37 / 26 comprometidos** (más 11 de historias que el PO adelantó durante el sprint)
- Objetivo cumplido: ☑ Sí. El PO confirmó en la revisión que se hizo la funcionalidad pedida.

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| HU-24 | Pausar y cancelar tareas con motivo | 3 | #21 |
| HU-28a | Rediseño: estructura, menú, combo de espacios, tema; solo el Admin ve Miembros; renombrar el espacio | 5 | #22 |
| HU-25 | Gestionar miembros: cambiar el rol y quitar | 3 | #23 |
| HU-15 | Papelera: dar de baja, restaurar, borrar definitivamente | 5 | #24 |
| HU-28b | Mi trabajo (+ editar tareas en ventana) | 5 | #26 |
| HU-31 | Datos del proyecto: folio, descripción, personas (+ ajustes del PO) | 3 | #28, #29 |
| HU-28c | Página del proyecto y ventanas | 5 | #30 |
| HU-21 | Tipos de contenedor, fechas reales, Configuración | 5 | #31 |
| HU-22 | Tipos de tarea, atención inmediata, tipos permitidos | 3 | #32 |

- 204 pruebas en verde.
- Documentación: fases (#25), perfil y usuarios del sistema (#27).

**Comentarios del PO en la revisión**, que pasan al backlog. Diseño en [ADR-0005](../adr/ADR-0005-personas-y-responsabilidades.md):

| Comentario | Respuesta |
|---|---|
| El proyecto necesita "Sprint" y "Actividades del sprint" (texto) | HU-33 |
| Las tareas necesitan tres responsabilidades: Actividad, Gestión y Seguimiento | HU-35 (Actividad reemplaza a Responsable) |
| Un catálogo de personas que incluya a quien no tiene cuenta | HU-34, por espacio |
| Usar a los usuarios con otro nombre ("adminrul" → "Rodrigo") | HU-34: la persona vinculada al usuario lleva el nombre que se muestra |
| Las personas del proyecto también desde el catálogo | HU-36 |
| Limitar los tipos de tarea por cada mantenimiento, no solo por tipo | HU-37 |

### Retrospectiva

**Salió bien**

- Se entregó más de lo comprometido (37 de 26) sin bajar la calidad: cada historia con pruebas, CI en verde y "Cómo probarlo".
- El rediseño se validó primero con una maqueta y después se construyó en tres entregas. El PO ajustó sobre la marcha: colores, orden del menú, columnas.
- Las migraciones con datos (tipos de contenedor y de tarea) se verificaron contra la base real del PO antes de pedir la prueba.

**A mejorar**

- La edición de tareas "no respondía". El panel se abría fuera de la vista, y la corrección no se vio al principio porque la carpeta del PO estaba en otra rama.
- El alcance creció un 42 % dentro del sprint. Salió bien, pero la planificación dejó de reflejar el trabajo real.
- El guion de demostración integral se propuso al final; conviene tenerlo desde la planificación.

**Acuerdos para el Sprint 4**

1. **La carpeta del PO queda en la rama que trae el cambio** antes de pedirle que pruebe. Se le dice cuál es.
2. **Lo que el PO pida a mitad del sprint se anota en el plan** el mismo día, con sus puntos.
3. **El guion de demostración se escribe al planificar**, con la lista de historias.
