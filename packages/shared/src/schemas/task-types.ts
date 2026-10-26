import { z } from 'zod';

/** Lo que una tarea dice de su tipo (HU-22) */
export const taskTypeRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Atención inmediata (ADR-0004 §5): se resalta y va primero en su columna */
  expedited: z.boolean(),
});
export type TaskTypeRef = z.infer<typeof taskTypeRefSchema>;

/** Un tipo de tarea del catálogo del espacio */
export const taskTypeSchema = taskTypeRefSchema.extend({
  position: z.number().int(),
  /** Archivado: ya no se ofrece para lo nuevo; las tareas existentes lo conservan */
  archived: z.boolean(),
  /** Tareas (sin papelera) de este tipo */
  taskCount: z.number().int(),
});
export type TaskType = z.infer<typeof taskTypeSchema>;

export const taskTypeListSchema = z.array(taskTypeSchema);

const typeName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'Máximo 60 caracteres');

/** Cuerpo de POST /workspaces/:workspaceId/task-types */
export const createTaskTypeSchema = z.object({
  name: typeName,
  expedited: z.boolean().default(false),
});
export type CreateTaskTypeInput = z.infer<typeof createTaskTypeSchema>;

/** Cuerpo de PATCH .../task-types/:typeId: renombrar, atención inmediata, archivar */
export const updateTaskTypeSchema = z
  .object({ name: typeName, expedited: z.boolean(), archived: z.boolean() })
  .partial();
export type UpdateTaskTypeInput = z.infer<typeof updateTaskTypeSchema>;

/**
 * Tipos que se cargan al crear un espacio (ADR-0004 §5). `legacy` es el valor del antiguo enum
 * TaskType: la migración lo usa para pasar las tareas existentes al catálogo.
 */
export const DEFAULT_TASK_TYPES: readonly { name: string; expedited: boolean; legacy?: string }[] =
  [
    { name: 'Tarea', expedited: false, legacy: 'TASK' },
    { name: 'Incidencia', expedited: false },
    { name: 'Fast track', expedited: true },
    { name: 'Reunión', expedited: false, legacy: 'MEETING' },
    { name: 'Entregable', expedited: false, legacy: 'DELIVERABLE' },
    { name: 'Revisión', expedited: false, legacy: 'REVIEW' },
    { name: 'Investigación', expedited: false, legacy: 'RESEARCH' },
    { name: 'Examen', expedited: false, legacy: 'EXAM' },
  ];

/** Tipos de tarea permitidos en los tipos de contenedor iniciales; los demás admiten todos */
export const DEFAULT_ALLOWED_TASK_TYPES: Readonly<Record<string, readonly string[]>> = {
  'Mtto correctivo': ['Incidencia', 'Fast track', 'Tarea'],
  'Mtto evolutivo': ['Tarea', 'Fast track', 'Entregable', 'Revisión'],
};
