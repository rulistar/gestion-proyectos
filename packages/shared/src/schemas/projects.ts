import { z } from 'zod';
import { endAfterStart, endAfterStartError, optionalDate, optionalText } from './common.js';
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
    area: optionalText(80),
    classification: optionalText(80),
    status: projectStatusSchema.default('NOT_STARTED'),
    priority: projectPrioritySchema.default('MEDIUM'),
    startDate: optionalDate,
    endDate: optionalDate,
    notes: optionalText(2000),
  })
  .refine(endAfterStart, endAfterStartError);
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  area: z.string().nullable(),
  classification: z.string().nullable(),
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  progress: projectProgressSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** Respuesta de GET /workspaces/:workspaceId/projects */
export const projectListSchema = z.array(projectSchema);
