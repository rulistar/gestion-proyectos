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
- Con las adiciones (HU-40 a HU-53: 24 pts), el compromiso queda en **56 puntos**.

**Lo que el PO pida a mitad del sprint** se anota aquí el mismo día, con sus puntos:

| Fecha | ID | Elemento | Pts |
|---|---|---|---|
| 2026-10-28 | HU-40 | Menú lateral plegable (botón y Ctrl+B) | 1 |
| 2026-10-28 | HU-41 | Pantallas compactas: más información visible sin desplazarse | 2 |
| 2026-10-28 | HU-42 | Ocultar lo que el perfil no permite; solo el Admin del sistema crea espacios | 1 |
| 2026-10-28 | HU-43 | "Sin folio" es el único folio que puede repetirse | 1 |
| 2026-10-28 | HU-44 | Personas: borrar a quien no se usa y ocultar las archivadas | 2 |
| 2026-10-28 | HU-45 | Personas: ver dónde aparece una persona para reasignarla | 1 |
| 2026-10-28 | HU-46 | Actividades: fecha fin; Abiertas solo con el menú oculto | 1 |
| 2026-10-28 | HU-47 | Origen de la tarea (catálogo, detalle y filtro) | 3 |
| 2026-10-28 | HU-48 | Mi trabajo: ocultar el panel lateral; tareas en un renglón | 1 |
| 2026-10-28 | HU-49 | Contenedores de trabajo o personales | 2 |
| 2026-10-28 | HU-49b | Personales: campos de trabajo ocultos; menú oculto en contenedores | 1 |
| 2026-10-29 | HU-52 | Ver el trabajo de otras personas | 3 |
| 2026-10-29 | HU-53 | Lector solo de trabajo; Miembro ve las tareas de lo que ve | 2 |
| 2026-10-29 | HU-51 | Fusionar personas duplicadas (adelantada del Sprint 6) | 3 |

El compromiso queda en **58 puntos** (56 después de la replaneación de abajo).

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

## Resultado (cierre: 2026-10-30)

- Puntos completados: **56 / 32 comprometidos** tras la replaneación (34 al planificar), más 24 de historias que el PO agregó durante el sprint.
- Objetivo replaneado cumplido: ☑ Sí. El PO probó cada historia en local antes de fusionarla. La revisión en producción está en curso (guion de abajo).
- Se cerró antes de la fecha planeada (2026-11-10). El Sprint 6 empieza el 2026-10-31.

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| HU-40 | Menú lateral plegable (botón y Ctrl+B) | 1 | #52 |
| HU-41 | Pantallas compactas | 2 | #53 |
| HU-42 | Ocultar lo que el perfil no permite; solo el Admin del sistema crea espacios | 1 | #54 |
| — | ADR-0006: permisos por persona | — | #55 |
| HU-17a | Permisos: modelo, migración y filtro de visibilidad único en la API | 5 | #56 |
| HU-43 | "Sin folio" es el único folio que puede repetirse | 1 | #57 |
| HU-44 | Personas: borrar a quien no se usa y ocultar las archivadas | 2 | #58, #59 |
| HU-17b | Permisos: pantalla de la matriz en Miembros | 5 | #60 |
| HU-45 | Personas: ver dónde aparece una persona | 1 | #61 |
| HU-46 | Actividades: columna Fin; Abiertas solo con el menú oculto | 1 | #62 |
| HU-47 | Origen de la tarea (catálogo, detalle y filtro) | 3 | #63 |
| HU-48 | Mi trabajo: ocultar el panel; tareas en un renglón | 1 | #64 |
| HU-17c | Permisos: invitación a varios espacios | 3 | #65 |
| HU-49 | Contenedores de trabajo o personales | 2 | #66 |
| HU-49b | Personales: campos de trabajo ocultos; menú oculto en contenedores | 1 | #67 |
| HU-52 | Ver el trabajo de otras personas | 3 | #68 |
| HU-53 | Lector solo de trabajo; Miembro ve las tareas de lo que ve | 2 | #69 |
| HU-51 | Fusionar personas duplicadas | 3 | #70 |
| TEC-04 | Despliegue en Render + Neon con HTTPS (ADR-0007) | 5 | #71, #72 |
| HU-07 | Fases anidadas hasta 4 niveles, con avance y fechas calculados | 8 | #73 |
| HU-29 | Mi perfil: nombre, correo y contraseña | 3 | #74 |
| HU-30 | Usuarios del sistema: corregir correos y desactivar cuentas | 3 | #76 |

- 350 pruebas en verde: 280 de la API y 70 de shared.
- En producción desde 2026-10-29: <https://gestion-proyectos-gnnp.onrender.com>. Render publica `main` sola cuando el CI pasa.
- Quedó pendiente HU-50 (personas compartidas). El PO confirmó su diseño al cierre y pasa al Sprint 7.

**Guion de la revisión** (en producción, con el Admin del sistema). Cambia respecto al plan: la Lista y el Gantt salieron en la replaneación, y la visibilidad se hizo con la matriz de permisos.

1. Abrir la URL: candado de HTTPS e inicio de sesión. La primera carga tarda cerca de un minuto si la app estaba dormida (capa gratuita).
2. **Configuración** → el tipo Proyecto tiene marcada **Usa fases**. Crear el proyecto "Certificación Linux", la fase "Módulo 101" con la subfase "Tema 1" y una tarea en cada una. La pestaña **Fases** muestra el avance; clic en "Módulo 101" abre el tablero filtrado.
3. **Miembros** → invitar a un correo de prueba con la plantilla Miembro y **Permisos** ajustados. Abrir el enlace en una ventana privada y crear la contraseña. Esa persona ve solo lo que dice su matriz.
4. **Mi perfil** → cambiar el nombre. Cambiar la contraseña pide la actual.
5. **Usuarios del sistema** → desactivar la cuenta de prueba: en la ventana privada ya no entra. Reactivarla.
6. Dar de baja la fase "Módulo 101" y restaurarla desde la **Papelera**: regresan su subfase y sus tareas.

**Comentarios del PO durante la revisión:**

| Comentario | Respuesta |
|---|---|
| No pudo entrar a producción ("Correo o contraseña incorrectos") hasta dar con la contraseña correcta; no hay forma de restablecerla | Nueva historia **HU-54** (restablecer contraseña, 3 pts), primera del Sprint 6 |

### Retrospectiva

Borrador de Claude Code; el PO lo ajusta.

**Salió bien**

- Se entregaron 56 puntos, con pruebas, CI en verde y "Cómo probarlo" en cada PR.
- La aplicación ya está en internet con HTTPS, y los permisos por persona se hicieron antes de publicarla, como pidió el PO.
- Los acuerdos del Sprint 4 funcionaron:
  - Fases, Lector y fusionar personas se confirmaron con un ejemplo concreto antes de tocar el modelo ("Certificación Linux" → "Módulo 101" → "Tema 1"; «Raúl Paredes» fusionada en «Rul»), y no hubo malentendidos de fondo.
  - Antes de subir cambios se comprobó cada vez si el PR estaba fusionado. Dos "listo" que llegaron antes de la fusión se detectaron y no se perdió trabajo.

**A mejorar**

- El primer despliegue después de HU-17c falló: el caché de Render saltó `prisma generate`. Se corrigió con #72, pero solo se notó al revisar el panel de Render.
- `setup:admin` apuntó a la base local porque la variable no estaba puesta en esa terminal. Se resolvió comprobando la variable antes de correrlo; queda en docs/despliegue.md.
- Al crear la migración de fases se aplicó dos veces en la base de desarrollo y se tuvo que revertir a mano. No llegó a `main`.
- Lo agregado a mitad del sprint (24 puntos, 43 % de lo entregado) desplazó dos veces la Lista y el Gantt. Todo se anotó el mismo día, pero no se dijo qué historia salía a cambio.

**Acuerdos para el Sprint 6**

1. **Al fusionar un PR, se confirma que el despliegue en Render terminó en verde** antes de dar la historia por terminada (Definición de Terminado: funciona en el entorno desplegado).
2. **Si algo nuevo a mitad del sprint no cabe, se dice en ese momento qué historia comprometida sale**, y el PO decide.
3. **Las migraciones se crean una sola vez**, con `pnpm db:migrate --create-only`, y se revisan antes de aplicarlas.
4. Siguen los acuerdos del Sprint 4: ejemplo concreto antes de cambiar el modelo, comprobar la fusión antes de subir cambios, y cada filtro con un ejemplo.
