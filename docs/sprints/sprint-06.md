# Sprint 6 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-31 → 2026-11-13** |
| Capacidad | 5–10 h/semana (PO + Claude Code). Velocidad: Sprint 4 = 36 pts, Sprint 5 = 56 pts (24 agregados a mitad del sprint); el límite real es el tiempo del PO para probar |
| Compromiso | **43 puntos** (32 al planificar + HU-55 + HU-14) |

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
| Revisión | Al terminar las 7 historias | El guion de arriba, en producción; recorrido del MVP del acta |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar |

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 43
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
