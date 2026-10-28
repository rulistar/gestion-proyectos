import { z } from 'zod';
import {
  endAfterStart,
  endAfterStartError,
  optionalDate,
  optionalId,
  optionalText,
} from './common.js';
import { personRefSchema } from './people.js';
import { projectTypeRefSchema } from './project-types.js';
import { projectProgressSchema } from './progress.js';

export const projectStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PAUSED',
  'CANCELLED',
  'DONE',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ProjectPriority = z.infer<typeof projectPrioritySchema>;

/** Cuerpo de POST y PUT /workspaces/:workspaceId/projects (HU-05) */
export const projectInputSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
    /** Tipo de contenedor (HU-21). Sin él: al crear, el primer tipo "Con fin"; al editar, el actual */
    typeId: optionalId,
    /** Folio del sistema de origen (HU-31): opcional, editable y sin regla de unicidad */
    folio: optionalText(40),
    description: optionalText(2000),
    /** Personas del proyecto (HU-36, ADR-0005 §3): del catálogo del espacio, o nadie */
    requesterId: optionalId,
    assignedToId: optionalId,
    projectManagerId: optionalId,
    consultingManagerId: optionalId,
    businessPartnerId: optionalId,
    area: optionalText(80),
    classification: optionalText(80),
    status: projectStatusSchema.default('NOT_STARTED'),
    priority: projectPrioritySchema.default('MEDIUM'),
    startDate: optionalDate,
    endDate: optionalDate,
    /** Observaciones (antes "Notas") */
    notes: optionalText(2000),
    /** Sprint en curso y lo que se hace en él (HU-33): texto libre */
    sprint: optionalText(60),
    sprintActivities: optionalText(4000),
    /**
     * Tipos de tarea propios del contenedor (HU-37): subconjunto de los que admite su tipo. Vacío =
     * los de su tipo; sin enviar = no cambia. El formulario los manda separados por comas.
     */
    taskTypeIds: z
      .preprocess(
        (value) =>
          typeof value === 'string' ? value.split(',').filter(Boolean) : (value ?? undefined),
        z.array(z.uuid('Tipo de tarea no válido')).max(100),
      )
      .optional(),
  })
  .refine(endAfterStart, endAfterStartError);
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  type: projectTypeRefSchema,
  name: z.string(),
  folio: z.string().nullable(),
  /** Quién lo creó: "los míos" de la matriz de permisos (ADR-0006) */
  createdById: z.uuid().nullable(),
  description: z.string().nullable(),
  requester: personRefSchema.nullable(),
  assignedTo: personRefSchema.nullable(),
  projectManager: personRefSchema.nullable(),
  consultingManager: personRefSchema.nullable(),
  businessPartner: personRefSchema.nullable(),
  area: z.string().nullable(),
  classification: z.string().nullable(),
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  sprint: z.string().nullable(),
  sprintActivities: z.string().nullable(),
  /** Tipos de tarea propios (HU-37); vacío = admite los de su tipo */
  allowedTaskTypeIds: z.array(z.uuid()),
  /** Fechas reales (ADR-0004 §2.1): las pone el sistema al cambiar el estado */
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  progress: projectProgressSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** Respuesta de GET /workspaces/:workspaceId/projects */
export const projectListSchema = z.array(projectSchema);
