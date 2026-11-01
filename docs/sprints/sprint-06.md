# Sprint 6 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-31 → 2026-11-13** |
| Capacidad | 5–10 h/semana (PO + Claude Code). Velocidad: Sprint 4 = 36 pts, Sprint 5 = 56 pts (24 agregados a mitad del sprint); el límite real es el tiempo del PO para probar |
| Compromiso | **48 puntos** (32 al planificar + HU-55 + HU-14 + HU-56) |

## Objetivo del sprint

> **"Cierro el MVP: veo cada proyecto en Gantt y en lista por fases, capturo el detalle que pide cada tipo, veo mis contenedores en tablero y exporto mis datos."**

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-54 | Restablecer una contraseña olvidada | 3 |
| 2 | HU-26 | Pestaña Lista del proyecto, agrupada por fase | 2 |
| 3 | HU-27 | Gantt del proyecto y del espacio, planeado contra real | 8 |
| 4 | HU-23 | Campos de detalle por tipo (ADR-0004 §3) | 8 |
| 5 | HU-10 | Tablero Kanban de proyectos por estado | 5 |
| 6 | HU-13 | Exportar en JSON y CSV compatible con Excel | 3 |
| 7 | HU-11 | Detalle del proyecto (pestaña Resumen) | 3 |
| | | **Total** | **32** |

**Por qué este orden:**
- **Restablecer contraseña primero.** Es chica y hoy, si alguien olvida su contraseña, no puede volver a entrar.
- **Lista y Gantt primero.** Ya se pospusieron dos veces, y las fases (HU-07) que necesitan ya están en `main`.
- **Campos de detalle antes de Exportar.** El CSV y el JSON deben llevar las columnas de los campos de detalle.
- **Resumen al final.** Junta datos de las demás historias (avance por fase, planeado contra real).

**Decisiones del PO al planificar (2026-10-30):**
- Se elige **cerrar el MVP** (29 pts). Queda espacio para lo que se pida a mitad del sprint.
- Se agrega **HU-54** (restablecer contraseña, 3 pts), pedida en la revisión del Sprint 5: el compromiso queda en 32.
- **Pasan al Sprint 7:** HU-50 (personas compartidas, diseño confirmado), TEC-05 (Swagger) y TEC-06 (Playwright).

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-6).

**Lo que el PO pida a mitad del sprint** se anota aquí el mismo día, con sus puntos. Si no cabe, se dice qué historia comprometida sale (acuerdo del Sprint 5):

| Fecha | ID | Elemento | Pts | Sale |
|---|---|---|---|---|
| 2026-10-31 | HU-55 | Filtro por año (abiertos, cerrados o ambos) en las listas | 3 | — (cabe: compromiso 35) |
| 2026-10-31 | HU-14 | Cargar información desde JSON o Excel (adelantada del Sprint 7) | 8 | — (cabe: compromiso 43) |
| 2026-10-31 | HU-56 | Ver como un miembro (el Admin ve lo que ve otra persona, solo lectura) | 5 | — (cabe: compromiso 48) |
| 2026-10-31 | — | Tablero: cerrados ocultos con botones; Mi trabajo más compacto; "Proyecto/Mantenimiento/Actividad" en Tareas | — | — |

## Guion de demostración (en producción)

1. **Usuarios del sistema** → restablecer la contraseña de la cuenta de prueba; abrir el enlace en una ventana privada, crear una nueva y entrar.
1. En "Certificación Linux", pestaña **Lista**: tareas agrupadas por fase con sangría, plegar "Módulo 101" y usar los filtros de la vista Tareas.
2. Pestaña **Gantt**: barras planeadas contra reales, línea de hoy, una tarea vencida resaltada, fases como barras resumen y zoom por semana, mes y trimestre. Abrir el Gantt general del espacio.
3. **Configuración** → agregar al tipo Incidencia el campo "Severidad" (lista, obligatorio). Crear una incidencia sin severidad da error; con severidad se guarda.
4. **Proyectos** → cambiar a **Tablero** y pasar un proyecto de "Planeado" a "En curso".
5. **Exportar** CSV y abrirlo en Excel: acentos correctos y una fila por tarea, con la severidad.
6. Pestaña **Resumen** de "Certificación Linux": avance, días restantes y avance por fase.

## Plan de trabajo

1. Una rama y un PR por historia, con **"Cómo probarlo"**. El PO prueba antes de fusionar.
2. Se fusiona un PR antes de empezar el siguiente.
3. La carpeta del PO queda en la rama que trae el cambio antes de pedirle que pruebe.
4. Acuerdos del Sprint 5:
   - Al fusionar un PR, se confirma que el despliegue en Render terminó en verde.
   - Si algo nuevo a mitad del sprint no cabe, se dice qué historia comprometida sale.
   - Las migraciones se crean una sola vez y se revisan antes de aplicarlas.
5. Siguen los acuerdos del Sprint 4: ejemplo concreto antes de cambiar el modelo, comprobar la fusión antes de subir cambios, y cada filtro con un ejemplo.

## Dependencias nuevas

**Ninguna prevista.** El Gantt se dibuja con una cuadrícula de CSS; el Kanban de proyectos sigue el tablero de tareas; el CSV se arma sin librería (decisión del PO).

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| El Gantt es grande (8 pts) y visual | Media | Media | Primero el del proyecto y después el del espacio, en dos entregas si hace falta |
| Los campos de detalle cambian formularios, API y exportación a la vez | Media | Alta | Validación armada en la API desde la definición, con pruebas por clase de campo; la columna `details` es opcional y no toca lo existente |
| La migración de valores iniciales choca con tipos que el PO ya renombró | Media | Baja | Se cargan solo en tipos con su nombre original; el PO los ajusta después |
| Producción duerme (capa gratuita) y la prueba en la nube se siente lenta | Alta | Baja | Esperar la primera carga; las pruebas de cada historia siguen en local |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-30 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión | Al terminar las 7 historias | El guion de arriba, en producción; recorrido del MVP del acta ✅ 2026-10-31 |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar ✅ 2026-10-31 |

## Resultado (cierre: 2026-10-31)

- Puntos completados: **48 / 48 comprometidos** (32 al planificar, más HU-55, HU-14 y HU-56, que el PO pidió durante el sprint y cupieron sin sacar nada).
- Objetivo cumplido: ☑ Sí. El PO probó cada historia en local antes de fusionarla y revisó en producción el 2026-10-31 ("por ahorita bien"), sin observaciones pendientes.
- Se cerró antes de la fecha planeada (2026-11-13). El Sprint 7 empieza el 2026-11-01.

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| HU-54 | Restablecer una contraseña olvidada (enlace del Admin del sistema y `pnpm reset:password`) | 3 | #78 |
| HU-26 | Pestaña Lista del proyecto, agrupada por fase | 2 | #79 |
| HU-27 | Gantt del proyecto (27a) y del espacio (27b), planeado contra real | 8 | #80, #81 |
| HU-23 | Campos de detalle por tipo: definición (23a) y valores (23b) | 8 | #82, #83, #84 |
| HU-10 | Tablero Kanban de contenedores; cerrados ocultos con botones; vista junto a los filtros | 5 | #85, #86 |
| HU-13 | Exportar en CSV para Excel y respaldo JSON | 3 | #87 |
| HU-11 | Pestaña Resumen del proyecto | 3 | #88 |
| — | Menú lateral más angosto | — | #89 |
| HU-55 | Filtro por año con Abiertos / Cerrados / Ambos | 3 | #90 |
| HU-14 | Cargar información desde JSON o Excel, incluidos los respaldos del prototipo | 8 | #91 |
| HU-56 | Ver como un miembro (solo lectura) | 5 | #92 |

- 413 pruebas en verde: 305 de la API y 108 de shared.
- Sin dependencias nuevas en todo el sprint: el Gantt es una cuadrícula de CSS y el CSV se arma y se lee sin librería.
- Cada fusión se confirmó en producción (acuerdo del Sprint 5).

**Recorrido del MVP del acta** (objetivo 1):

| Alcance del acta (§3) | Estado |
|---|---|
| Usuarios con invitación y roles; espacios → proyectos → fases → tareas | ✅ |
| Tabla con filtros, tablero Kanban y vista de detalle | ✅ |
| Fechas, % de avance y días restantes | ✅ |
| Respaldo e importación JSON/Excel | ✅ solo "actualizar"; "reemplazar" quedó fuera por decisión del PO |
| Gráficas por mes de término y por estado | ❌ falta: **HU-12**, primera del Sprint 7 |
| Gantt (era backlog futuro) | ✅ adelantado |

Objetivo 4 del acta (API documentada con OpenAPI antes del Sprint 6): **no se cumplió**; TEC-05 va en el Sprint 7.

**Comentarios del PO durante el sprint:**

| Comentario | Respuesta |
|---|---|
| "¿Cómo se va a cargar 2027, en automático?" | Sí: el combo Año sale de los datos y del reloj del navegador; no hay que dar de alta años |
| ¿Cómo sincronizar local, web y app? | Una sola fuente de verdad (producción). Local es banco de pruebas; la app usa la misma API; la app de estudio, por API y webhooks (ADR-0002 §7) |
| App para Android, en tablet y celular | Una sola app adaptable; recomendada como PWA. Pasa a la **versión 2** |
| Terminar la versión 1 y pedir un análisis profesional para la versión 2 | Decisión: la v1 termina con el Sprint 7. Plan en [sprint-07.md](sprint-07.md#después-del-sprint-7-cierre-de-la-versión-1) |

### Retrospectiva

Borrador de Claude Code; el PO lo ajusta.

**Salió bien**

- Se entregaron los 48 puntos, incluidas tres historias pedidas durante el sprint; cada una se anotó el mismo día y se dijo que cabía (acuerdo del Sprint 5).
- Se confirmó el despliegue después de cada fusión, y las dos migraciones del sprint se crearon una sola vez y se revisaron antes de aplicarlas.
- Los diseños se confirmaron con un ejemplo antes de tocar el modelo: Gantt, campos de detalle, Kanban, filtro por año, Cargar información y Ver como. No hubo retrabajo de fondo.

**A mejorar**

- El CI falló en HU-26 porque se revisaron los tipos solo de la web. Desde entonces se corre `pnpm typecheck` completo antes de cada commit.
- Hubo confusión con "Campos" entre HU-23a y HU-23b: el PR de la primera parte no decía qué todavía no se vería.
- La prueba "limita los intentos" de `profile.test.ts` falla al azar cuando cambia el minuto del reloj, y en HU-55 se subió un commit con esa falla sin notarla.

**Acuerdos para el Sprint 7**

1. Cuando una historia se entrega en partes, el PR dice **qué todavía no se ve**.
2. Se corrige la prueba que falla al azar (**TEC-11**, 1 pt).
3. Siguen los acuerdos de los Sprints 4 y 5.
