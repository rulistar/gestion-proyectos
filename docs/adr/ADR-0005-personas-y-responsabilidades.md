# ADR-0005: Catálogo de personas y responsabilidades de la tarea

- **Estado:** Aceptado (2026-10-26)
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** En la revisión del Sprint 3 el PO pidió tres cosas:
  - Asignar en cada tarea **tres responsabilidades**: Actividad, Gestión y Seguimiento.
  - Que esas personas puedan **no tener cuenta** en el sistema.
  - Que los usuarios del sistema puedan aparecer **con otro nombre**: el usuario "adminrul" debe verse como "Rodrigo".

  Hoy la tarea tiene un solo responsable (`assigneeId`), que debe ser un miembro con cuenta. Las personas del proyecto (Solicitante, PM…) son texto libre (HU-31).

## Decisiones del PO (2026-10-26)

| Tema | Decisión |
|---|---|
| Responsabilidades | Cada tarea tiene **Actividad** (quien la hace), **Gestión** (quien la gestiona) y **Seguimiento** (quien le da seguimiento): **una persona en cada una**. Pueden repetirse y todas son opcionales. |
| Responsable actual | **Actividad reemplaza a Responsable.** "Mi trabajo" muestra las tareas donde aparezco en cualquiera de las tres, e indica en cuál. |
| Catálogo | **Por espacio de trabajo.** Lo gestiona el Admin. Una persona puede **vincularse a un usuario del sistema**: así "Rodrigo" es adminrul y sus tareas le aparecen en "Mi trabajo". |
| Personas del proyecto | Solicitante, Asignado a, PM, Gte. Consultoría y Business partner **se eligen del catálogo**. Lo ya capturado se convierte en personas del catálogo. |
| Tipos de tarea por contenedor | Además de lo que admite su tipo (HU-22), **cada contenedor puede limitarse más**. Ejemplo: Mtto A usa 3 de los 5 tipos y Mtto B, 2. |

## Decisión

### 1. Persona (catálogo por espacio)

```
Person
  id, workspaceId
  name            "Rodrigo"         (único en el espacio, sin contar archivadas)
  userId?         adminrul          (opcional; un usuario, a lo más una persona por espacio)
  archivedAt?                       (no se borra si está en uso: se archiva)
  createdBy/At, updatedBy/At        (RNF-01)
```

- **El nombre que se muestra es el de la persona**, no el de la cuenta. Así se resuelve el alias sin tocar la cuenta, que es la misma en todos los espacios.
- **Al entrar un miembro** (invitación aceptada, espacio creado), se crea su persona vinculada con su nombre de cuenta, si no tiene una. El Admin puede renombrarla.
- **Quitar a un miembro** no borra a su persona. Sus tareas conservan el nombre, y la persona queda marcada "sin acceso" mientras su usuario no sea miembro. Sustituye al aviso "ya no es miembro" de HU-25.
- Se puede **vincular** una persona sin cuenta a un usuario cuando este entra al espacio. Por ejemplo, "Laura Méndez" ya tenía tareas y después la invitan.

### 2. Responsabilidades de la tarea

`Task.assigneeId` (usuario) se reemplaza por tres referencias a `Person`:

| Campo | Responsabilidad |
|---|---|
| `activityPersonId` | **Actividad**: quien la hace (el antiguo Responsable) |
| `managementPersonId` | **Gestión** |
| `followUpPersonId` | **Seguimiento** |

- **Migración:** cada tarea con responsable pasa a Actividad, con la persona vinculada a ese usuario.
- **"Mi trabajo"** busca las tareas donde la persona vinculada a mi usuario aparece en cualquiera de los tres campos. Cada tarea muestra la etiqueta Actividad, Gestión o Seguimiento.
- **Validación:** solo personas **activas del mismo espacio**. Al editar se puede conservar una persona archivada que ya estaba.

### 3. Personas del proyecto

Los cinco campos de texto de HU-31 pasan a referencias a `Person`: `requesterId`, `assignedToId`, `projectManagerId`, `consultingManagerId` y `businessPartnerId`.

- **Migración:** por cada texto distinto, sin distinguir mayúsculas, se crea una persona del catálogo en ese espacio. Si coincide con el nombre de una persona vinculada a un miembro, se usa esa.
- En el formulario se elige de la lista, y desde ahí mismo se puede **dar de alta** una persona nueva.

### 4. Tipos de tarea por contenedor

Tabla `ProjectTaskType (projectId, taskTypeId)`:

- **Sin filas:** el contenedor admite lo que admite su tipo (HU-22).
- **Con filas:** solo esos tipos, y deben ser un **subconjunto** de los que admite su tipo.
- Al cambiar el tipo del contenedor, la lista propia se descarta si deja de ser subconjunto.
- Siguen las reglas del ADR-0004 §4: no se quita un tipo que ya usan sus tareas (409).

### 5. Permisos

- Ver el catálogo: `project.read`, porque hace falta para elegir personas.
- Crear personas desde un formulario: `project.create` o `task.create`, para no frenar la captura.
- Renombrar, vincular y archivar: `member.manage` (Admin).
- Limitar los tipos de tarea de un contenedor: `project.update`.

## Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| Alias en la membresía (nombre por espacio en `Membership`) | No cubre a las personas sin cuenta: habría dos listas distintas para lo mismo. |
| Cambiar el nombre de la cuenta (HU-29) | El nombre de la cuenta es uno solo; el PO quiere poder llamarla distinto por espacio. |
| Varias personas por responsabilidad | El PO eligió una por responsabilidad: más simple de filtrar y de mostrar en tarjetas. |
| Catálogo global | Cada espacio puede ser de un cliente distinto; mezclar personas complica la privacidad (HU-16). |

## Consecuencias

- **Positivas:**
  - Una sola lista de personas para tareas y proyectos.
  - El alias funciona sin tocar las cuentas.
  - "Mi trabajo" refleja las tres responsabilidades.
  - Lo ya capturado se conserva.
- **Negativas:**
  - Dos migraciones con datos: responsable → Actividad, y texto → personas.
  - Formularios con más selectores.
  - La regla "ya no es miembro" de HU-25 se rehace sobre personas.
- **Historias:** HU-33 a HU-37 (backlog).
