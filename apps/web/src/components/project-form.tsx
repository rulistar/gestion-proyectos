import { projectInputSchema, type Project, type ProjectInput } from '@gestion/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from '@/lib/projects';

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
type Field = (typeof FIELDS)[number];
type FieldErrors = Partial<Record<Field, string>>;

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const parsed = projectInputSchema.safeParse(
      Object.fromEntries(FIELDS.map((field) => [field, values.get(field)])),
    );
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(parsed.data, form);
  }

  /** Props comunes de cada campo: id, name y el enlace accesible con su mensaje de error */
  function field(name: Field) {
    const id = `project-${name}`;
    return {
      id,
      name,
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name] ? `${id}-error` : undefined,
    };
  }

  function errorFor(name: Field) {
    const message = fieldErrors[name];
    return (
      message && (
        <p id={`project-${name}-error`} className="text-sm text-destructive">
          {message}
        </p>
      )
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset disabled={readOnly || isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="project-name">Nombre</Label>
          <Input {...field('name')} defaultValue={project?.name} maxLength={120} />
          {errorFor('name')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-area">Área</Label>
          <Input
            {...field('area')}
            defaultValue={project?.area ?? ''}
            maxLength={80}
            placeholder="Personal, Trabajo, Estudio…"
          />
          {errorFor('area')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-classification">Clasificación</Label>
          <Input
            {...field('classification')}
            defaultValue={project?.classification ?? ''}
            maxLength={80}
          />
          {errorFor('classification')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-status">Estado</Label>
          <NativeSelect {...field('status')} defaultValue={project?.status ?? 'NOT_STARTED'}>
            {Object.entries(PROJECT_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          {errorFor('status')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-priority">Prioridad</Label>
          <NativeSelect {...field('priority')} defaultValue={project?.priority ?? 'MEDIUM'}>
            {Object.entries(PROJECT_PRIORITIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          {errorFor('priority')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-startDate">Fecha de inicio</Label>
          <Input {...field('startDate')} type="date" defaultValue={project?.startDate ?? ''} />
          {errorFor('startDate')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-endDate">Fecha de fin</Label>
          <Input {...field('endDate')} type="date" defaultValue={project?.endDate ?? ''} />
          {errorFor('endDate')}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="project-notes">Notas</Label>
          <Textarea {...field('notes')} defaultValue={project?.notes ?? ''} maxLength={2000} />
          {errorFor('notes')}
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit">{isPending ? 'Guardando…' : submitLabel}</Button>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              status
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}
