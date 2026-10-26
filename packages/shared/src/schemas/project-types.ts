import { z } from 'zod';

/**
 * Comportamiento de un tipo de contenedor (ADR-0004 §2): el nombre del tipo es libre, pero la
 * forma de medirlo es una de estas tres.
 */
export const projectBehaviorSchema = z.enum(['WITH_END', 'ONGOING', 'ON_DEMAND']);
export type ProjectBehavior = z.infer<typeof projectBehaviorSchema>;

/** Lo que un proyecto dice de su tipo */
export const projectTypeRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  behavior: projectBehaviorSchema,
});
export type ProjectTypeRef = z.infer<typeof projectTypeRefSchema>;

/** Un tipo de contenedor del catálogo del espacio (HU-21) */
export const projectTypeSchema = projectTypeRefSchema.extend({
  position: z.number().int(),
  /** Archivado: ya no se ofrece para lo nuevo; lo existente lo conserva (ADR-0004 §4) */
  archived: z.boolean(),
  /** Contenedores (sin papelera) de este tipo */
  projectCount: z.number().int(),
  /** Tipos de tarea que admite (HU-22); vacío = todos */
  allowedTaskTypeIds: z.array(z.uuid()),
});
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectTypeListSchema = z.array(projectTypeSchema);

const typeName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'Máximo 60 caracteres');

/** Cuerpo de POST /workspaces/:workspaceId/project-types */
export const createProjectTypeSchema = z.object({
  name: typeName,
  behavior: projectBehaviorSchema,
});
export type CreateProjectTypeInput = z.infer<typeof createProjectTypeSchema>;

/** Cuerpo de PATCH .../project-types/:typeId: renombrar, cambiar comportamiento, archivar */
export const updateProjectTypeSchema = z
  .object({
    name: typeName,
    behavior: projectBehaviorSchema,
    archived: z.boolean(),
    allowedTaskTypeIds: z.array(z.uuid()).max(100),
  })
  .partial();
export type UpdateProjectTypeInput = z.infer<typeof updateProjectTypeSchema>;

/** Tipos que se cargan al crear un espacio (ADR-0004 §5); el Admin los ajusta después */
export const DEFAULT_PROJECT_TYPES: readonly CreateProjectTypeInput[] = [
  { name: 'Proyecto', behavior: 'WITH_END' },
  { name: 'Mtto correctivo', behavior: 'ONGOING' },
  { name: 'Mtto evolutivo', behavior: 'ONGOING' },
  { name: 'Actividades', behavior: 'ON_DEMAND' },
];
