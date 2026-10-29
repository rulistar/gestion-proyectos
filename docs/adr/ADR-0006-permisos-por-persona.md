# ADR-0006: Permisos por persona y visibilidad

- **Estado:** Aceptado (2026-10-28)
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** Hoy los permisos dependen solo del rol en cada espacio (Admin, Miembro, Lector; ADR-0002 §5), y todo miembro ve todos los proyectos del espacio. El PO pidió configurar a cada usuario al invitarlo:
  - En qué espacios entra.
  - Qué puede dar de alta: proyectos, mantenimientos, actividades y tareas.
  - Si puede dar de baja y restaurar lo que él creó.
  - Si ve lo de otros, en solo lectura o pudiendo modificarlo.

  Por defecto, un miembro ve sus tareas, puede agregar tareas y modificar las suyas, pero no lo que hizo otro usuario a menos que tenga el permiso. Esto une y amplía HU-17 (permisos por usuario) y HU-16 (visibilidad).

## Decisiones del PO (2026-10-28)

| Tema | Decisión |
|---|---|
| Ver lo de otros | Por sección: **solo los míos**, **todos** o **estos…** (una lista de contenedores elegidos) |
| "Mis tareas" | Las que **creé** o donde soy el **Responsable** |
| Invitación | **Varios espacios en una sola invitación**, con plantilla y permisos para cada uno |
| Prioridad | **Antes del despliegue** (TEC-04). El Gantt (HU-27) y la pestaña Lista (HU-26) pasan al Sprint 6 |
| Crear espacios | Solo el Admin del sistema (HU-42, ya entregado) |

## Decisión

### 1. Matriz de permisos por membresía

Cada miembro tiene, **en cada espacio**, una matriz. Las tres secciones de contenedores se configuran por separado:

| | Ver | Crear | Modificar | Dar de baja y restaurar |
|---|---|---|---|---|
| Proyectos | Solo los míos · Todos · Estos… | Sí / No | Ninguno · Los míos · Los que ve | Ninguno · Los míos · Los que puede modificar |
| Mantenimientos | (igual) | | | |
| Actividades | (igual) | | | |
| Tareas | Las mías · Todas las de lo que ve | Sí / No | Las mías · Las que ve | Ninguna · Las mías · Las que puede modificar |

- **"Los míos"** son los contenedores que la persona **creó** (`createdById`). Al moverlos entre espacios (HU-32) se conserva quién los creó.
- **"Las mías"** son las tareas que la persona **creó** o donde su persona del catálogo es el **Responsable** (ADR-0005).
- **Ver sin modificar = solo lectura.** Ejemplo: ve todos los Mantenimientos, pero solo edita los suyos.
- Si una persona tiene una tarea en un contenedor que no puede ver, **ese contenedor se le muestra en solo lectura** (nombre, folio, datos), para que tenga el contexto de su tarea. No ve las demás tareas de ese contenedor salvo que su permiso de tareas lo diga.
- Crear una tarea exige poder ver el contenedor; modificarla exige además el permiso de tareas.

En la base de datos:

```
Membership
  role          ADMIN | MEMBER | VIEWER     (la plantilla de la que partió)
  permissions   JSON validado con Zod (packages/shared): la matriz de arriba
MembershipProjectAccess                     (la lista de "Estos…")
  membershipId, projectId
```

La matriz va en una columna JSON, validada con un esquema de Zod compartido: se lee completa en cada petición (junto con la membresía, que ya se carga en `requireMembership`) y no se consulta por partes. La lista "Estos…" va en una tabla aparte porque se cruza con los proyectos en las consultas.

### 2. Plantillas (el rol)

| Plantilla | Contenedores | Tareas |
|---|---|---|
| **Admin** | Todo | Todo |
| **Miembro** (valor por defecto del PO) | Ver: solo los míos · Crear: no · Modificar: los míos · Baja: ninguno | Ver: todas las de lo que ve (HU-53) · Crear: sí · Modificar: las mías · Baja: ninguna |
| **Lector** | Ver: todos los de trabajo (HU-53) · nada más | Ver: todas las de lo que ve · nada más |

**«Las de lo que ve»** incluye los contenedores que ve en solo lectura por tener una tarea suya (HU-53). **«Solo trabajo»** (HU-53, casilla de la matriz): no ve los contenedores Personales (HU-49) ni sus tareas, salvo los que creó o donde tiene una tarea suya; tampoco lo Personal de las personas que sigue (HU-52).

Al elegir una plantilla se llena la matriz, y después se ajusta casilla por casilla. La pantalla muestra "Miembro (ajustado)" cuando la matriz ya no coincide con la plantilla.

**Siguen siendo solo del Admin**, sin casilla en la matriz:
- Miembros, Personas e invitaciones.
- Configuración (catálogos).
- Renombrar el espacio.
- Mover entre espacios (HU-32).
- **Borrar definitivamente** desde la papelera.

El Admin del sistema sigue entrando a todos los espacios como Admin.

### 3. Visibilidad en la API (sustituye la visibilidad por proyecto de HU-16)

- Un solo módulo, `access/visibility.ts`, construye a partir de la membresía las condiciones de Prisma de "contenedores que ve", "tareas que ve" y "puede modificar o dar de baja esto". **Todas las consultas lo usan**: listas de contenedores, detalle, tareas del proyecto, vista Tareas, Mi trabajo, Mover, papelera y, cuando lleguen, Gantt y exportación.
- Lo que no puede ver responde **404** (no se revela que existe). Si lo ve pero no puede modificarlo, responde **403**.
- La web recibe la matriz efectiva del usuario (en el detalle del espacio) y **oculta lo que no puede hacer** (regla de HU-42). Ocultar no es seguridad: lo que cuenta es la API.
- La columna `Project.visibility` y la tabla `ProjectAccess` previstas para HU-16 **no se usan**: la visibilidad ahora es por persona. La migración quita la columna (siempre ha estado en su valor por defecto).
- **Papelera:** cada quien ve y restaura lo que su permiso de "dar de baja y restaurar" le permite. Borrar definitivamente sigue siendo solo del Admin.

### 4. Invitación a varios espacios

```
Invitation              email, token (hash), vence en 48 h, quién la envió
InvitationGrant         invitationId, workspaceId, role (plantilla), permissions (JSON), proyectos de "Estos…"
```

- Quien invita debe ser **Admin de cada espacio** que incluye (o Admin del sistema).
- Al aceptar, la persona entra a todos los espacios de la invitación, cada uno con su matriz y su persona del catálogo (`ensureMemberPerson`, ADR-0005).
- Las invitaciones pendientes de hoy se convierten en una invitación con un solo espacio.

### 5. Los miembros actuales no pierden acceso

La migración da a cada membresía actual una matriz que reproduce lo que hoy puede hacer:

| Rol actual | Contenedores | Tareas |
|---|---|---|
| Admin | Todo | Todo |
| Miembro | Ver todos · Crear: sí · Modificar: los que ve · Baja: ninguno | Ver todas · Crear · Modificar las que ve · Baja: las que puede modificar |
| Lector | Ver todos | Ver todas |

Las invitaciones nuevas usan las plantillas del §2.

## Consecuencias

- **Positivas:**
  - Cada persona ve y hace solo lo que le corresponde, configurado al invitarla.
  - Una sola regla de visibilidad en la API, probada por endpoint, en lugar de comprobaciones repartidas.
  - El rol sigue existiendo como plantilla, así que lo ya construido (permisos de Admin, HU-42) no cambia.
- **Negativas:**
  - Todas las consultas de proyectos y tareas cambian: riesgo de dejar una sin filtrar. Se mitiga con pruebas de "otro usuario no lo ve" en cada endpoint.
  - Las consultas son algo más complejas (condiciones por sección y por creador). Para el tamaño del equipo no afecta el rendimiento; si creciera, se agregan índices por `createdById`.

## Entregas

| ID | Qué | Pts |
|---|---|---|
| HU-17a | Modelo, migración que conserva los accesos y filtro de visibilidad en toda la API | 5 |
| HU-17b | Pantalla de la matriz en Miembros (plantilla + ajustes, lista "Estos…"); la web oculta lo que no se puede | 5 |
| HU-17c | Invitación a varios espacios, con matriz por espacio | 3 |

HU-16 queda cubierta por HU-17 (la opción "Estos…").
