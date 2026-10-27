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
});
export type Person = z.infer<typeof personSchema>;

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
