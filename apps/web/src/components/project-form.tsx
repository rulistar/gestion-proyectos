import { projectInputSchema, type Project, type ProjectInput } from '@gestion/shared';
import type { ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from '@/lib/projects';
import { useSchemaForm } from '@/lib/use-schema-form';

const FIELDS = [
  'name',
  'area',
  'classification',
  'status',
  'priority',
  'startDate',
  'endDate',
  'notes',
] as const;

interface ProjectFormProps {
  /** Valores iniciales al editar; sin ellos el formulario está vacío (crear) */
  project?: Project;
  submitLabel: string;
  isPending: boolean;
  /** Error de la API, si la última petición falló */
  error?: string | undefined;
  /** Solo lectura (por ejemplo, para un Lector) */
  readOnly?: boolean;
  /** Mensaje bajo el botón, como "Cambios guardados" */
  status?: ReactNode;
  onSubmit: (data: ProjectInput, form: HTMLFormElement) => void;
}

/** Formulario de proyecto (HU-05): se valida con el mismo esquema que la API */
export function ProjectForm({
  project,
  submitLabel,
  isPending,
  error,
  readOnly = false,
  status,
  onSubmit,
}: ProjectFormProps) {
  const form = useSchemaForm(projectInputSchema, FIELDS, onSubmit);

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={readOnly || isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={form.idOf('name')}>Nombre</Label>
          <Input {...form.field('name')} defaultValue={project?.name} maxLength={120} />
          <FieldError {...form.errorProps('name')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('area')}>Área</Label>
          <Input
            {...form.field('area')}
            defaultValue={project?.area ?? ''}
            maxLength={80}
            placeholder="Personal, Trabajo, Estudio…"
          />
          <FieldError {...form.errorProps('area')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('classification')}>Clasificación</Label>
          <Input
            {...form.field('classification')}
            defaultValue={project?.classification ?? ''}
            maxLength={80}
          />
          <FieldError {...form.errorProps('classification')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('status')}>Estado</Label>
          <NativeSelect {...form.field('status')} defaultValue={project?.status ?? 'NOT_STARTED'}>
            {Object.entries(PROJECT_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('status')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('priority')}>Prioridad</Label>
          <NativeSelect {...form.field('priority')} defaultValue={project?.priority ?? 'MEDIUM'}>
            {Object.entries(PROJECT_PRIORITIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('priority')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('startDate')}>Fecha de inicio</Label>
          <Input {...form.field('startDate')} type="date" defaultValue={project?.startDate ?? ''} />
          <FieldError {...form.errorProps('startDate')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('endDate')}>Fecha de fin</Label>
          <Input {...form.field('endDate')} type="date" defaultValue={project?.endDate ?? ''} />
          <FieldError {...form.errorProps('endDate')} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={form.idOf('notes')}>Notas</Label>
          <Textarea {...form.field('notes')} defaultValue={project?.notes ?? ''} maxLength={2000} />
          <FieldError {...form.errorProps('notes')} />
        </div>

        {!readOnly && (
          <FormActions
            submitLabel={submitLabel}
            isPending={isPending}
            error={error}
            status={status}
          />
        )}
      </fieldset>
    </form>
  );
}
