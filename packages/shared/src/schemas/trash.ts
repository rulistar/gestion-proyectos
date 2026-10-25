import { z } from 'zod';

export const trashKindSchema = z.enum(['project', 'task']);
export type TrashKind = z.infer<typeof trashKindSchema>;

/** Algo dado de baja (HU-15): qué es, quién lo dio de baja y cuándo */
export const trashItemSchema = z.object({
  kind: trashKindSchema,
  id: z.uuid(),
  /** Nombre del proyecto o título de la tarea */
  name: z.string(),
  /** Proyecto al que pertenece la tarea (null en los proyectos) */
  projectName: z.string().nullable(),
  /** Tareas que se van con el proyecto (0 en las tareas) */
  taskCount: z.number().int(),
  deletedAt: z.iso.datetime(),
  deletedByName: z.string().nullable(),
});
export type TrashItem = z.infer<typeof trashItemSchema>;

/** Respuesta de GET /workspaces/:workspaceId/trash; lo más reciente primero */
export const trashListSchema = z.array(trashItemSchema);
