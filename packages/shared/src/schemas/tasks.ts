import { z } from 'zod';
import {
  endAfterStart,
  endAfterStartError,
  optionalDate,
  optionalId,
  optionalInt,
  optionalText,
} from './common.js';
import { personRefSchema } from './people.js';
import { taskOriginRefSchema } from './task-origins.js';
import { taskTypeRefSchema } from './task-types.js';

export const taskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Estados que exigen un motivo (HU-24): dicen por qué la tarea está detenida */
export const STATUSES_WITH_REASON: readonly TaskStatus[] = ['PAUSED', 'CANCELLED'];

export function statusNeedsReason(status: TaskStatus): boolean {
  return STATUSES_WITH_REASON.includes(status);
}

/** Pausar o cancelar sin motivo no se permite; el error se marca en el campo del motivo */
function reasonWhenRequired(value: { status: TaskStatus; statusReason: string | null }) {
  return !statusNeedsReason(value.status) || value.statusReason !== null;
}

const reasonRequiredError = {
  message: 'Escribe el motivo para pausar o cancelar',
  path: ['statusReason'],
};

/** Cuerpo de POST y PUT .../projects/:projectId/tasks (HU-08) */
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio').max(200, 'Máximo 200 caracteres'),
    /** Tipo del catálogo (HU-22). Sin él: al crear, el primero permitido; al editar, el actual */
    typeId: optionalId,
    status: taskStatusSchema.default('PENDING'),
    /** Hasta una semana de trabajo continuo (10 080 min) por tarea */
    estimatedMinutes: optionalInt(10_080),
    /** Responsable (HU-35): una persona activa del catálogo del espacio, o nadie */
    responsiblePersonId: optionalId,
    startDate: optionalDate,
    endDate: optionalDate,
    /** Motivo de Pausada o Cancelada; en los demás estados se ignora */
    statusReason: optionalText(500),
    /** Origen (HU-47): uno activo del catálogo del espacio, o ninguno */
    originId: optionalId,
    /** Detalle del origen: "Ticket #4521 de mesa de ayuda" */
    originDetail: optionalText(300),
  })
  .refine(endAfterStart, endAfterStartError)
  .refine(reasonWhenRequired, reasonRequiredError);
export type TaskInput = z.infer<typeof taskInputSchema>;

/** Cuerpo de PATCH .../tasks/:taskId/status: mover la tarea de columna (con motivo si se pausa o cancela) */
export const taskStatusUpdateSchema = z
  .object({ status: taskStatusSchema, statusReason: optionalText(500) })
  .refine(reasonWhenRequired, reasonRequiredError);
export type TaskStatusUpdate = z.infer<typeof taskStatusUpdateSchema>;

export const taskSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  type: taskTypeRefSchema,
  status: taskStatusSchema,
  estimatedMinutes: z.number().int().nullable(),
  /** Responsable: una persona del catálogo (con alias), tenga o no cuenta */
  responsible: personRefSchema.nullable(),
  /** Quién la creó: con el Responsable, decide "las mías" (ADR-0006) */
  createdById: z.uuid().nullable(),
  /** De dónde viene (HU-47) y su detalle */
  origin: taskOriginRefSchema.nullable(),
  originDetail: z.string().nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  /** Por qué está Pausada o Cancelada; null en los demás estados */
  statusReason: z.string().nullable(),
  /** Inicio real (ADR-0004 §2.1): la primera vez que pasó a En curso o a Hecha; no se borra */
  startedAt: z.iso.datetime().nullable(),
  /** Cuándo pasó a Hecha; null si no está Hecha */
  completedAt: z.iso.datetime().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.array(taskSchema);
