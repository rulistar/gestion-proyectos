import { z } from 'zod';

/** Lo que una tarea dice de su origen (HU-47) */
export const taskOriginRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});
export type TaskOriginRef = z.infer<typeof taskOriginRefSchema>;

/** Un origen del catálogo del espacio: Correo, Teléfono, Junta, Ticket... */
export const taskOriginSchema = taskOriginRefSchema.extend({
  position: z.number().int(),
  /** Archivado: ya no se ofrece para lo nuevo; las tareas existentes lo conservan */
  archived: z.boolean(),
  /** Tareas (sin papelera) con este origen */
  taskCount: z.number().int(),
});
export type TaskOrigin = z.infer<typeof taskOriginSchema>;

export const taskOriginListSchema = z.array(taskOriginSchema);

const originName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'Máximo 60 caracteres');

/** Cuerpo de POST /workspaces/:workspaceId/task-origins */
export const createTaskOriginSchema = z.object({ name: originName });
export type CreateTaskOriginInput = z.infer<typeof createTaskOriginSchema>;

/** Cuerpo de PATCH .../task-origins/:originId: renombrar o archivar */
export const updateTaskOriginSchema = z
  .object({ name: originName, archived: z.boolean() })
  .partial();
export type UpdateTaskOriginInput = z.infer<typeof updateTaskOriginSchema>;

/** Orígenes que se cargan al crear un espacio (los ejemplos que aprobó el PO) */
export const DEFAULT_TASK_ORIGINS: readonly string[] = ['Correo', 'Teléfono', 'Junta', 'Ticket'];
