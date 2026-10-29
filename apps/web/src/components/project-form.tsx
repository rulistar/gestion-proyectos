import {
  FOLIO_PREFIXES,
  folioPeriod,
  formatFolio,
  NOT_APPLICABLE,
  projectInputSchema,
  REPEATABLE_FOLIO,
  type Project,
  type ProjectInput,
  type ProjectScope,
  type Person,
  type ProjectType,
  type TaskType,
} from '@gestion/shared';
import { Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { QuickAddPerson } from '@/components/quick-add-person';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { todayIso } from '@/lib/dates';
import { selectablePeople } from '@/lib/people';
import {
  PROJECT_PRIORITIES,
  PROJECT_SCOPES,
  PROJECT_STATUSES,
  useWorkFields,
} from '@/lib/projects';
import { useSchemaForm } from '@/lib/use-schema-form';
import { cn } from '@/lib/utils';

const FIELDS = [
  'typeId',
  'folio',
  'name',
  'description',
  'requesterId',
  'assignedToId',
  'projectManagerId',
  'consultingManagerId',
  'businessPartnerId',
  'scope',
  'area',
  'classification',
  'status',
  'priority',
  'startDate',
  'endDate',
  'notes',
  'sprint',
  'sprintActivities',
  'taskTypeIds',
] as const;

/**
 * Personas del proyecto (HU-36): se eligen del catálogo; pueden no tener cuenta. `work` = solo
 * aplica al trabajo: en un personal muestra "N/A" y se puede ocultar (HU-49)
 */
const PEOPLE = [
  { field: 'requesterId', key: 'requester', label: 'Solicitante', work: false },
  { field: 'assignedToId', key: 'assignedTo', label: 'Asignado a', work: false },
  { field: 'projectManagerId', key: 'projectManager', label: 'Project manager', work: true },
  { field: 'consultingManagerId', key: 'consultingManager', label: 'Gte. Consultoría', work: true },
  { field: 'businessPartnerId', key: 'businessPartner', label: 'Business partner', work: true },
] as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-t pt-4 text-sm font-semibold text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

/**
 * Tipos de tarea propios del contenedor (HU-37): casillas con los que admite su tipo. Sin marcar
 * ninguna, admite todos los de su tipo. Viajan en un campo oculto, separados por comas.
 */
function OwnTaskTypes({
  projectType,
  taskTypes,
  initial,
  error,
}: {
  projectType: ProjectType | undefined;
  taskTypes: TaskType[];
  initial: string[];
  error: { id: string; message: string | undefined };
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial));
  const typeAllowed = new Set(projectType?.allowedTaskTypeIds ?? []);
  const choices = taskTypes.filter(
    (taskType) =>
      selected.has(taskType.id) ||
      (!taskType.archived && (typeAllowed.size === 0 || typeAllowed.has(taskType.id))),
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="text-sm font-medium">Tipos de tarea</legend>
      <p className="text-xs text-muted-foreground">
        Sin marcar ninguno, admite todos los de su tipo ({projectType?.name ?? '—'}). Marca solo los
        que use este contenedor.
      </p>
      <input type="hidden" name="taskTypeIds" value={[...selected].join(',')} />
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {choices.map((taskType) => (
          <label key={taskType.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(taskType.id)}
              onChange={() => toggle(taskType.id)}
              className="size-4 accent-primary"
            />
            {taskType.name}
            {taskType.expedited && (
              <Zap aria-label="Atención inmediata" className="size-3 text-warning-foreground" />
            )}
          </label>
        ))}
      </div>
      <FieldError {...error} />
    </fieldset>
  );
}

interface ProjectFormProps {
  /** Valores iniciales al editar; sin ellos el formulario está vacío (crear) */
  project?: Project;
  /** Tipos que se pueden elegir (HU-21); el primero es el de por omisión al crear */
  types: ProjectType[];
  /** Catálogo de tipos de tarea: para elegir los propios del contenedor (HU-37) */
  taskTypes: TaskType[];
  workspaceId: string;
  /** Catálogo de personas del espacio (HU-34) para las personas del proyecto */
  people: Person[];
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
  types,
  taskTypes,
  workspaceId,
  people,
  submitLabel,
  isPending,
  error,
  readOnly = false,
  status,
  onSubmit,
}: ProjectFormProps) {
  const form = useSchemaForm(projectInputSchema, FIELDS, onSubmit);
  // El tipo elegido decide qué tipos de tarea se pueden marcar (HU-37)
  const [typeId, setTypeId] = useState(project?.type.id ?? types[0]?.id);
  // Ejemplo del folio que recibirá si se deja vacío (HU-38): prefijo de la sección y mes actual
  const behavior = types[0]?.behavior ?? 'WITH_END';
  const folioExample = formatFolio(FOLIO_PREFIXES[behavior], folioPeriod(todayIso()), 1);
  // Trabajo o personal (HU-49): en un personal, los campos del trabajo se pueden ocultar. Se
  // ocultan con CSS (no se quitan) para que al guardar conserven su valor
  const [scope, setScope] = useState<ProjectScope>(project?.scope ?? 'WORK');
  const workFields = useWorkFields();
  const personal = scope === 'PERSONAL';
  const hideWork = personal && !workFields.open;
  // Al dar de alta un personal, el sprint empieza en "N/A"
  const sprintDefault = (value: string | null | undefined) =>
    project ? (value ?? '') : personal ? NOT_APPLICABLE : '';

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={readOnly || isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-2">
            <Label htmlFor={form.idOf('typeId')}>Tipo</Label>
            <NativeSelect
              {...form.field('typeId')}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.archived ? ' (archivado)' : ''}
                </option>
              ))}
            </NativeSelect>
            <FieldError {...form.errorProps('typeId')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={form.idOf('scope')}>Ámbito</Label>
            <NativeSelect
              {...form.field('scope')}
              value={scope}
              onChange={(event) => setScope(event.target.value as ProjectScope)}
            >
              {Object.entries(PROJECT_SCOPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <FieldError {...form.errorProps('scope')} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('folio')}>Folio</Label>
          <Input
            {...form.field('folio')}
            defaultValue={project?.folio ?? ''}
            maxLength={40}
            placeholder={
              project
                ? 'El del sistema de origen (opcional)'
                : `Vacío = automático (${folioExample})`
            }
          />
          <p className="text-xs text-muted-foreground">
            Escribe solo PY, MT o ACT y se completa con el número vigente. No se repite en el
            espacio, salvo &ldquo;{REPEATABLE_FOLIO}&rdquo; (para dejarlo sin folio automático).
          </p>
          <FieldError {...form.errorProps('folio')} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
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
        {personal && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            Es personal: Project manager, Gte. Consultoría, Business partner y el sprint no aplican.
            <Button type="button" size="sm" variant="outline" onClick={workFields.toggle}>
              {workFields.open ? 'Ocultar campos de trabajo' : 'Mostrar campos de trabajo'}
            </Button>
          </div>
        )}
        {PEOPLE.map(({ field, key, label, work }) => {
          const current = project?.[key] ?? null;
          return (
            <div key={field} className={cn('grid gap-2', work && hideWork && 'hidden')}>
              <Label htmlFor={form.idOf(field)}>{label}</Label>
              <NativeSelect {...form.field(field)} defaultValue={current?.id ?? ''}>
                <option value="">{work && personal ? NOT_APPLICABLE : '—'}</option>
                {selectablePeople(people, current?.id).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.archived ? ' (archivada)' : ''}
                  </option>
                ))}
              </NativeSelect>
              <FieldError {...form.errorProps(field)} />
            </div>
          );
        })}
        {!readOnly && (
          <div className="sm:col-span-2">
            <QuickAddPerson workspaceId={workspaceId} />
          </div>
        )}

        <OwnTaskTypes
          key={typeId}
          projectType={types.find((type) => type.id === typeId)}
          taskTypes={taskTypes}
          initial={project && typeId === project.type.id ? project.allowedTaskTypeIds : []}
          error={form.errorProps('taskTypeIds')}
        />

        <div className={cn('contents', hideWork && 'hidden')}>
          <SectionTitle>Sprint</SectionTitle>
        </div>
        <div className={cn('grid gap-2', hideWork && 'hidden')}>
          <Label htmlFor={form.idOf('sprint')}>Sprint</Label>
          <Input
            {...form.field('sprint')}
            key={`sprint-${scope}`}
            defaultValue={sprintDefault(project?.sprint)}
            maxLength={60}
            placeholder="Por ejemplo: Sprint 4"
          />
          <FieldError {...form.errorProps('sprint')} />
        </div>
        <div className={cn('grid gap-2 sm:col-span-2', hideWork && 'hidden')}>
          <Label htmlFor={form.idOf('sprintActivities')}>Actividades del sprint</Label>
          <Textarea
            {...form.field('sprintActivities')}
            key={`sprintActivities-${scope}`}
            defaultValue={sprintDefault(project?.sprintActivities)}
            maxLength={4000}
            placeholder="Qué se hará en este sprint"
          />
          <FieldError {...form.errorProps('sprintActivities')} />
        </div>

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
