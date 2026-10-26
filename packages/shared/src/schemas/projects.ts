import { z } from 'zod';
import {
  endAfterStart,
  endAfterStartError,
  optionalDate,
  optionalId,
  optionalText,
} from './common.js';
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
    /** Personas del proyecto (HU-31): solo el nombre, pueden no tener cuenta en el sistema */
    requester: optionalText(120),
    assignedTo: optionalText(120),
    projectManager: optionalText(120),
    consultingManager: optionalText(120),
    businessPartner: optionalText(120),
    area: optionalText(80),
    classification: optionalText(80),
    status: projectStatusSchema.default('NOT_STARTED'),
    priority: projectPrioritySchema.default('MEDIUM'),
    startDate: optionalDate,
    endDate: optionalDate,
    /** Observaciones (antes "Notas") */
    notes: optionalText(2000),
  })
  .refine(endAfterStart, endAfterStartError);
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  type: projectTypeRefSchema,
  name: z.string(),
  folio: z.string().nullable(),
  description: z.string().nullable(),
  requester: z.string().nullable(),
  assignedTo: z.string().nullable(),
  projectManager: z.string().nullable(),
  consultingManager: z.string().nullable(),
  businessPartner: z.string().nullable(),
  area: z.string().nullable(),
  classification: z.string().nullable(),
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  /** Fechas reales (ADR-0004 §2.1): las pone el sistema al cambiar el estado */
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  progress: projectProgressSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** Respuesta de GET /workspaces/:workspaceId/projects */
export const projectListSchema = z.array(projectSchema);
