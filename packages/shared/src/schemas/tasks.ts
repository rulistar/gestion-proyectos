import { z } from 'zod';
import {
  endAfterStart,
  endAfterStartError,
  optionalDate,
  optionalId,
  optionalInt,
} from './common.js';

/** Tipos genéricos (ADR-0002 §1.1): reemplazan a los tipos de actividad del prototipo */
export const taskTypeSchema = z.enum([
  'TASK',
  'MEETING',
  'DELIVERABLE',
  'REVIEW',
  'RESEARCH',
  'EXAM',
]);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const taskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Cuerpo de POST y PUT .../projects/:projectId/tasks (HU-08) */
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio').max(200, 'Máximo 200 caracteres'),
    type: taskTypeSchema.default('TASK'),
    status: taskStatusSchema.default('PENDING'),
    /** Hasta una semana de trabajo continuo (10 080 min) por tarea */
    estimatedMinutes: optionalInt(10_080),
    /** Responsable: un miembro activo del workspace, o null (sin asignar) */
    assigneeId: optionalId,
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine(endAfterStart, endAfterStartError);
export type TaskInput = z.infer<typeof taskInputSchema>;

/** Cuerpo de PATCH .../tasks/:taskId/status: mover la tarea de columna */
export const taskStatusUpdateSchema = z.object({ status: taskStatusSchema });
export type TaskStatusUpdate = z.infer<typeof taskStatusUpdateSchema>;

export const taskSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  type: taskTypeSchema,
  status: taskStatusSchema,
  estimatedMinutes: z.number().int().nullable(),
  assigneeId: z.uuid().nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  /** Cuándo pasó a Hecha; null si no está Hecha */
  completedAt: z.iso.datetime().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.array(taskSchema);
