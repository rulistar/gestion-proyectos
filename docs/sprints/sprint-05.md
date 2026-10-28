# Sprint 5 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-28 → 2026-11-10** |
| Capacidad | 5–10 h/semana (PO + Claude Code). Velocidad: Sprint 3 = 37 pts, Sprint 4 = 36 pts; el límite real es el tiempo del PO para probar |
| Compromiso | **34 puntos** |

## Objetivo del sprint

> **"La aplicación está en la nube con HTTPS; organizo cada proyecto en fases, lo veo en Gantt (planeado contra real) y controlo quién entra y qué ve."**

> **Replaneado por el PO (2026-10-28):** "Configuro a cada persona al invitarla (qué espacios, qué ve y qué puede hacer); la aplicación está en la nube con HTTPS y organizo cada proyecto en fases." Diseño de permisos: [ADR-0006](../adr/ADR-0006-permisos-por-persona.md).

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | TEC-04 | Despliegue gratuito en la nube con HTTPS | 5 |
| 2 | HU-07 | Fases anidadas (hasta 4 niveles), con avance y fechas calculadas | 8 |
| 3 | HU-26 | Pestaña Lista del proyecto (reutiliza la vista Tareas, agrupada por fase) | 2 |
| 4 | HU-27 | Gantt del proyecto y del espacio, planeado contra real | 8 |
| 5 | HU-29 | Mi perfil: nombre, correo y contraseña | 3 |
| 6 | HU-30 | Usuarios del sistema: cambiar correos, desactivar cuentas | 3 |
| 7 | HU-16 | Restringir qué proyectos ve cada usuario | 5 |
| | | **Total** | **34** |

**Por qué este orden:**
- **El despliegue va primero.** Ya se pospuso dos veces, y la Definición de Terminado pide que funcione en el entorno desplegado. Con él listo, el resto del sprint se puede probar también en la nube.
- **Fases antes que Lista y Gantt.** La Lista se agrupa por fase y el Gantt dibuja las fases como barras resumen.
- **Cuentas y visibilidad al final.** Son historias independientes y más chicas.

**Decisiones del PO al planificar (2026-10-27):**
- **HU-26 baja de 5 a 2 puntos.** La vista Tareas (HU-39) ya cubre los filtros. La pestaña Lista del proyecto reutiliza esa tabla filtrada al proyecto, y suma la agrupación por fase.
- **Pasan al Sprint 6:**
  - Campos de detalle por tipo (HU-23, 8 pts).
  - Permisos por usuario (HU-17, 8 pts).

Detalle y criterios de aceptación: [backlog.md](../backlog.md#sprint-5).

**Replaneación del PO (2026-10-28):** los permisos por persona van antes del despliegue, para que la aplicación salga a internet con ellos.

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | HU-17a | Permisos: modelo, migración que conserva los accesos y filtro de visibilidad en la API | 5 |
| 2 | HU-17b | Permisos: pantalla de la matriz en Miembros | 5 |
| 3 | HU-17c | Permisos: invitación a varios espacios | 3 |
| 4 | TEC-04 | Despliegue gratuito en la nube con HTTPS | 5 |
| 5 | HU-07 | Fases anidadas (hasta 4 niveles) | 8 |
| 6 | HU-29 | Mi perfil | 3 |
| 7 | HU-30 | Usuarios del sistema | 3 |
| | | **Total replaneado** | **32** |

- **HU-16 se une a HU-17** (la opción "Estos…" de la matriz).
- **Pasan al Sprint 6:** Gantt (HU-27, 8 pts) y pestaña Lista (HU-26, 2 pts).
- Con las adiciones (HU-40 a HU-44: 7 pts), el compromiso queda en **39 puntos**.

**Lo que el PO pida a mitad del sprint** se anota aquí el mismo día, con sus puntos:

| Fecha | ID | Elemento | Pts |
|---|---|---|---|
| 2026-10-28 | HU-40 | Menú lateral plegable (botón y Ctrl+B) | 1 |
| 2026-10-28 | HU-41 | Pantallas compactas: más información visible sin desplazarse | 2 |
| 2026-10-28 | HU-42 | Ocultar lo que el perfil no permite; solo el Admin del sistema crea espacios | 1 |
| 2026-10-28 | HU-43 | "Sin folio" es el único folio que puede repetirse | 1 |
| 2026-10-28 | HU-44 | Personas: borrar a quien no se usa y ocultar las archivadas | 2 |

El compromiso queda en **41 puntos** (39 después de la replaneación de abajo).

## Guion de demostración (se arma al planificar, acuerdo del Sprint 3)

1. Abrir la URL pública con HTTPS (candado) e iniciar sesión.
2. En "Certificación Linux", crear las fases "Módulo 1" y "Módulo 2" con una subfase. Mover tareas a cada fase y ver el avance por fase.
3. Pestaña **Lista**: tareas agrupadas por fase, con sangría, y los filtros de la vista Tareas.
4. Pestaña **Gantt**: barras planeadas contra reales, línea de hoy, una tarea vencida resaltada y zoom por semana y por mes. Abrir el Gantt general del espacio.
5. **Mi perfil**: cambiar mi nombre. Cambiar la contraseña pide la actual y cierra las otras sesiones.
6. **Usuarios del sistema** (Admin del sistema): corregir el correo de un usuario y desactivar una cuenta de prueba, que ya no puede entrar.
7. Marcar un proyecto como **restringido**: un Miembro sin autorización no lo ve en Proyectos, Tareas ni Mi trabajo.

## Plan de trabajo

1. Una rama y un PR por historia, con **"Cómo probarlo"**. El PO prueba antes de fusionar.
2. Se fusiona un PR antes de empezar el siguiente.
3. La carpeta del PO queda en la rama que trae el cambio antes de pedirle que pruebe.
4. Acuerdos del Sprint 4:
   - Un término nuevo se confirma con un ejemplo concreto antes de cambiar el modelo de datos.
   - Antes de subir cambios a una rama, se comprueba que su PR no esté fusionado.
   - Cada filtro nuevo lleva en el PR un ejemplo de lo que encuentra y lo que no.

## Dependencias nuevas

- **TEC-04:** ninguna librería prevista. El servicio de hosting gratuito (aplicación + PostgreSQL) se elige al empezar la historia, porque las condiciones de las capas gratuitas cambian seguido. Se registra en un ADR nuevo y **se le pregunta al PO antes de crear cuentas o agregar configuración**.
- **HU-27:** sin librería; el Gantt se dibuja con una cuadrícula de CSS (ya decidido en el backlog).

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| La capa gratuita del hosting cambia, duerme la aplicación o limita la base de datos | Media | Media | Comparar 2 o 3 opciones al empezar y documentar en el ADR; la app ya corre en Docker (portabilidad) |
| Las fases cambian el modelo de tareas y rompen el tablero, Mi trabajo o Mover | Media | Alta | Migración que no toca las tareas existentes (fase opcional); pruebas de las vistas actuales |
| El Gantt es grande (8 pts) y visual | Media | Media | Primero el Gantt del proyecto y después el del espacio, en dos entregas si hace falta |
| Restringir proyectos debe aplicarse en todas las consultas (listas, tareas, mover, papelera) | Media | Alta | Un solo filtro de visibilidad en la API, con pruebas por cada endpoint |
| Cambiar el correo o desactivar una cuenta deja sesiones abiertas | Baja | Alta | Se cierran todas sus sesiones en la misma transacción, con prueba |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-27 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión | Al terminar las 7 historias | El guion de arriba, en el entorno desplegado |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar |

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 34
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
