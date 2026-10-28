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

## Resultado (cierre: 2026-10-27)

- Puntos completados: **36 / 28 comprometidos** (más 8 de historias que el PO agregó durante el sprint: HU-38 y HU-39)
- Objetivo cumplido: ☑ Sí. El PO probó cada historia en el navegador antes de fusionarla.
- Se cerró antes de la fecha planeada (2026-11-08); el Sprint 5 empieza el 2026-10-28.

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| HU-33 | Sprint y actividades del sprint en proyectos y mantenimientos | 2 | #34 |
| HU-38 | Folios automáticos PY / MT / ACT, sin duplicados y con autocompletado del formato | 3 | #35 |
| HU-34 | Catálogo de personas por espacio, con alias para los usuarios | 5 | #38 |
| — | Quitar la columna Solicitante de Proyectos y Mantenimientos | — | #39 |
| HU-35 | Responsable desde el catálogo; tipos de tarea Actividad, Gestión y Seguimiento | 5 | #40, #43 |
| HU-37 | Tipos de tarea por contenedor | 3 | #41, #42 |
| HU-36 | Personas del proyecto desde el catálogo | 3 | #44 |
| — | Formulario de tarea: "agregar persona" en su propia fila | — | #46 |
| HU-32 | Mover proyectos, mantenimientos y tareas entre espacios (solo Admin) | 5 | #45 |
| HU-09 | Filtros y orden en las listas de contenedores (+ conteo junto al título) | 5 | #47, #48, #49 |
| HU-39 | Vista "Tareas": todas las tareas del espacio con filtros | 5 | #50 |

- 254 pruebas en verde (218 de la API y 36 de shared).
- Migraciones con datos (responsables y personas del proyecto) verificadas contra la base del PO: mismos conteos antes y después.

**Guion de demostración** (datos reales del espacio Monex):

1. **Personas** → el usuario adminrul se muestra como "Rodrigo"; alta de una persona sin cuenta.
2. **Proyectos** → nuevo proyecto con el folio vacío → recibe `PY2610-0xx`; teclear "MT" en un mantenimiento lo completa.
3. **Datos del proyecto** → personas desde el catálogo, Sprint y Actividades del sprint.
4. **Mantenimiento** → limitar sus tipos de tarea; el formulario de tarea solo ofrece esos; Fast track ⚡ primero en su columna.
5. **Proyectos** → buscar "linux", filtrar por prioridad, ordenar por Fin y copiar el enlace en otra pestaña.
6. **Tareas** → "Fin hasta" 3 de noviembre, "Solo vencidas", responsable "Sin asignar"; editar una tarea desde la lista.
7. **Mover** → un mantenimiento a otro espacio (como Admin de ambos).

**Comentarios del PO durante la revisión**, ya atendidos dentro del sprint:

| Comentario | Respuesta |
|---|---|
| "Fin hasta" no encontraba un proyecto por la fecha de una de sus tareas | Se queda como fecha de fin del contenedor (#49); las tareas se consultan en la nueva vista **Tareas** (HU-39) |
| El conteo bajo el título ocupa espacio vertical | Va a la derecha del título en las listas (#48) |
| "Responsable" se encimaba con "Minutos estimados" | "Agregar persona" en su propia fila (#46) |

### Retrospectiva

**Salió bien**

- Se entregaron 36 puntos (28 comprometidos) con pruebas, CI en verde y "Cómo probarlo" en cada PR.
- Los acuerdos del Sprint 3 funcionaron: la carpeta del PO quedó en la rama correcta antes de cada prueba, y lo agregado a mitad del sprint se anotó el mismo día (HU-38, HU-39).
- Las preguntas antes de construir (folios, filtros, alcance) evitaron retrabajo en las historias grandes.

**A mejorar**

- Hubo un malentendido de fondo: "Actividad, Gestión y Seguimiento" se construyó como tres responsables por tarea, pero eran **tipos de tarea**. Se corrigió con #43, pero costó una migración extra.
- Dos veces se subió una corrección a una rama cuyo PR ya estaba fusionado, y una vez se borró una rama sin fusionar. Se rehízo el trabajo en ramas nuevas.
- gitleaks detectó una contraseña de prueba escrita en el código; se cambió por un valor aleatorio.
- "Fin hasta" se interpretó distinto (proyecto contra tareas). Se descubrió en la prueba del PO, no al planear.

**Acuerdos para el Sprint 5**

1. **Ante un término nuevo del PO, confirmar con un ejemplo concreto** ("¿se vería así en la pantalla?") antes de cambiar el modelo de datos.
2. **Antes de subir cambios a una rama, comprobar que su PR no está fusionado**; antes de borrar una rama, que esté en `main`.
3. **Cada filtro nuevo se describe en el PR con un ejemplo de qué encuentra y qué no.**
