import { z } from 'zod';

/**
 * Cuerpo de POST .../projects/:projectId/move (HU-32): el contenedor pasa a otro espacio con sus
 * tareas. El tipo se elige del catálogo del destino (los catálogos son por espacio).
 */
export const moveProjectSchema = z.object({
  targetWorkspaceId: z.uuid('Elige el espacio de destino'),
  typeId: z.uuid('Elige el tipo en el espacio de destino'),
});
export type MoveProjectInput = z.infer<typeof moveProjectSchema>;

/** Cuerpo de POST .../tasks/:taskId/move: la tarea pasa a otro proyecto, del mismo u otro espacio */
export const moveTaskSchema = z.object({
  targetWorkspaceId: z.uuid('Elige el espacio de destino'),
  targetProjectId: z.uuid('Elige el proyecto de destino'),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
