import { z } from 'zod';

/**
 * Persona del catálogo del espacio (HU-34, ADR-0005): tenga o no cuenta. Si está vinculada a un
 * usuario, su nombre es el que se muestra en lugar del de la cuenta ("adminrul" → "Rodrigo").
 */
export const personSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Usuario vinculado (opcional); a lo más una persona por usuario en cada espacio */
  userId: z.uuid().nullable(),
  /** Nombre de la cuenta vinculada, para que el Admin sepa quién es */
  userName: z.string().nullable(),
  /** El usuario vinculado sigue siendo miembro activo del espacio */
  hasAccess: z.boolean(),
  archived: z.boolean(),
  /** Tareas donde es Responsable, papelera incluida (HU-44): con alguna no se borra */
  taskCount: z.number().int(),
  /** Proyectos donde tiene un rol (Solicitante, PM…), papelera incluida */
  projectCount: z.number().int(),
});
export type Person = z.infer<typeof personSchema>;

/**
 * ¿Se puede borrar definitivamente? (HU-44) Solo archivada y sin uso: nadie la cita en tareas ni
 * proyectos, y su cuenta (si tiene) ya no es miembro del espacio
 */
export function canDeletePerson(person: Person): boolean {
  return (
    person.archived && person.taskCount === 0 && person.projectCount === 0 && !person.hasAccess
  );
}

export const personListSchema = z.array(personSchema);

/** Lo que una tarea dice de cada persona responsable (HU-35) */
export const personRefSchema = personSchema.pick({
  id: true,
  name: true,
  userId: true,
  hasAccess: true,
  archived: true,
});
export type PersonRef = z.infer<typeof personRefSchema>;

const personName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'Máximo 120 caracteres');

/** Cuerpo de POST /workspaces/:workspaceId/people (alta rápida desde un formulario o el catálogo) */
export const createPersonSchema = z.object({ name: personName });
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

/** Cuerpo de PATCH .../people/:personId: renombrar, vincular/desvincular usuario, archivar */
export const updatePersonSchema = z
  .object({ name: personName, userId: z.uuid().nullable(), archived: z.boolean() })
  .partial();
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

/** Rol de una persona en un proyecto (HU-36) */
export const projectPersonRoleSchema = z.enum([
  'requester',
  'assignedTo',
  'projectManager',
  'consultingManager',
  'businessPartner',
]);
export type ProjectPersonRole = z.infer<typeof projectPersonRoleSchema>;

/**
 * Respuesta de GET .../people/:personId/usage (HU-45): dónde aparece una persona, para reasignarla
 * antes de borrarla. `deleted` = está en la papelera (o su proyecto lo está).
 */
export const personUsageSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      projectId: z.uuid(),
      projectName: z.string(),
      deleted: z.boolean(),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      folio: z.string().nullable(),
      roles: z.array(projectPersonRoleSchema),
      deleted: z.boolean(),
    }),
  ),
});
export type PersonUsage = z.infer<typeof personUsageSchema>;

/** Cuerpo de POST .../people/:personId/merge (HU-51): la persona que se queda */
export const mergePersonSchema = z.object({ intoId: z.uuid() });
export type MergePersonInput = z.infer<typeof mergePersonSchema>;

/** Respuesta de la fusión: cuántas tareas y proyectos pasaron a la persona que se queda */
export const mergePersonResultSchema = z.object({
  tasks: z.number().int(),
  projects: z.number().int(),
});
export type MergePersonResult = z.infer<typeof mergePersonResultSchema>;
