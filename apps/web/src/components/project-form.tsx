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
  'folio',
  'name',
  'description',
  'requester',
  'assignedTo',
  'projectManager',
  'consultingManager',
  'businessPartner',
  'area',
  'classification',
  'status',
  'priority',
  'startDate',
  'endDate',
  'notes',
] as const;

/** Personas del proyecto (HU-31): solo se escribe el nombre; pueden no tener cuenta */
const PEOPLE = [
  { name: 'requester', label: 'Solicitante' },
  { name: 'assignedTo', label: 'Asignado a' },
  { name: 'projectManager', label: 'Project manager' },
  { name: 'consultingManager', label: 'Gte. Consultoría' },
  { name: 'businessPartner', label: 'Business partner' },
] as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-t pt-4 text-sm font-semibold text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

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
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('folio')}>Folio</Label>
          <Input
            {...form.field('folio')}
            defaultValue={project?.folio ?? ''}
            maxLength={40}
            placeholder="El del sistema de origen (opcional)"
          />
          <FieldError {...form.errorProps('folio')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('name')}>Nombre</Label>
          <Input {...form.field('name')} defaultValue={project?.name} maxLength={120} />
          <FieldError {...form.errorProps('name')} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={form.idOf('description')}>Descripción</Label>
          <Textarea
            {...form.field('description')}
            defaultValue={project?.description ?? ''}
            maxLength={2000}
          />
          <FieldError {...form.errorProps('description')} />
        </div>

        <SectionTitle>Personas</SectionTitle>
        {PEOPLE.map(({ name, label }) => (
          <div key={name} className="grid gap-2">
            <Label htmlFor={form.idOf(name)}>{label}</Label>
            <Input {...form.field(name)} defaultValue={project?.[name] ?? ''} maxLength={120} />
            <FieldError {...form.errorProps(name)} />
          </div>
        ))}

        <SectionTitle>Planeación</SectionTitle>
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
          <Label htmlFor={form.idOf('notes')}>Observaciones</Label>
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
