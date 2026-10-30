import {
  orderedPhases,
  statusNeedsReason,
  taskInputSchema,
  type Person,
  type Phase,
  type Task,
  type TaskInput,
  type TaskStatus,
  type TaskTypeRef,
} from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { QuickAddPerson } from '@/components/quick-add-person';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { selectablePeople } from '@/lib/people';
import { taskOriginsQueryOptions } from '@/lib/task-origins';
import { TASK_STATUSES } from '@/lib/tasks';
import { useSchemaForm } from '@/lib/use-schema-form';

const FIELDS = [
  'title',
  'typeId',
  'status',
  'estimatedMinutes',
  'responsiblePersonId',
  'startDate',
  'endDate',
  'statusReason',
  'originId',
  'originDetail',
  'phaseId',
] as const;

interface TaskFormProps {
  /** Valores iniciales al editar; sin ellos el formulario está vacío (crear) */
  task?: Task;
  workspaceId: string;
  /** Catálogo de personas del espacio (HU-34) para Actividad, Gestión y Seguimiento */
  people: Person[];
  /** Tipos que admite el contenedor (HU-22); el primero es el de por omisión al crear */
  types: TaskTypeRef[];
  /** Fases del proyecto (HU-07); sin ellas no se muestra el campo y se conserva la que tenga */
  phases?: Phase[] | undefined;
  /** Fase con la que empieza al crear (la del filtro del tablero) */
  defaultPhaseId?: string | undefined;
  submitLabel: string;
  isPending: boolean;
  error?: string | undefined;
  /** Botones extra junto a "Guardar", como "Cancelar" */
  children?: ReactNode;
  onSubmit: (data: TaskInput, form: HTMLFormElement) => void;
}

/** Formulario de tarea (HU-08): se valida con el mismo esquema que la API */
export function TaskForm({
  task,
  workspaceId,
  people,
  types,
  phases,
  defaultPhaseId,
  submitLabel,
  isPending,
  error,
  children,
  onSubmit,
}: TaskFormProps) {
  const form = useSchemaForm(taskInputSchema, FIELDS, onSubmit);
  // El motivo solo se pide (y se muestra) en Pausada y Cancelada (HU-24)
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING');
  // Orígenes activos (HU-47) y, al editar, el que ya tenía aunque esté archivado
  const { data: origins = [] } = useQuery(taskOriginsQueryOptions(workspaceId));
  const originChoices = origins.filter((o) => !o.archived || o.id === task?.origin?.id);

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
          <Label htmlFor={form.idOf('title')}>Título</Label>
          <Input {...form.field('title')} defaultValue={task?.title} maxLength={200} />
          <FieldError {...form.errorProps('title')} />
        </div>
        {phases ? (
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={form.idOf('phaseId')}>Fase</Label>
            <NativeSelect
              {...form.field('phaseId')}
              defaultValue={task ? (task.phaseId ?? '') : (defaultPhaseId ?? '')}
            >
              <option value="">Sin fase</option>
              {orderedPhases(phases).map(({ phase, depth }) => (
                <option key={phase.id} value={phase.id}>
                  {'\u00a0\u00a0'.repeat(depth - 1)}
                  {phase.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError {...form.errorProps('phaseId')} />
          </div>
        ) : (
          // Si el tipo dejó de usar fases, editar la tarea no le quita la que tenía
          task?.phaseId && <input type="hidden" name="phaseId" value={task.phaseId} />
        )}
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('typeId')}>Tipo</Label>
          <NativeSelect {...form.field('typeId')} defaultValue={task?.type.id ?? types[0]?.id}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
                {type.expedited ? ' (atención inmediata)' : ''}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('typeId')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('status')}>Estado</Label>
          <NativeSelect
            {...form.field('status')}
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          >
            {Object.entries(TASK_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('status')} />
        </div>
        {statusNeedsReason(status) && (
          <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor={form.idOf('statusReason')}>
              Motivo ({TASK_STATUSES[status].toLowerCase()})
            </Label>
            <Input
              {...form.field('statusReason')}
              defaultValue={task?.statusReason ?? ''}
              maxLength={500}
              placeholder="Por ejemplo: esperando respuesta del cliente"
            />
            <FieldError {...form.errorProps('statusReason')} />
          </div>
        )}
        {/* Responsable (HU-35): una persona del catálogo, tenga o no cuenta */}
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('responsiblePersonId')}>Responsable</Label>
          <NativeSelect
            {...form.field('responsiblePersonId')}
            defaultValue={task?.responsible?.id ?? ''}
          >
            <option value="">Sin asignar</option>
            {selectablePeople(people, task?.responsible?.id).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.archived ? ' (archivada)' : ''}
                {person.userId && !person.hasAccess ? ' (sin acceso)' : ''}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('responsiblePersonId')} />
        </div>
        {/* Alta rápida en su propia fila, debajo del Responsable: abierta no cabe a su lado */}
        <div className="sm:col-span-2 lg:col-span-4">
          <QuickAddPerson workspaceId={workspaceId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('estimatedMinutes')}>Minutos estimados</Label>
          <Input
            {...form.field('estimatedMinutes')}
            type="number"
            min={0}
            step={5}
            inputMode="numeric"
            defaultValue={task?.estimatedMinutes ?? ''}
          />
          <FieldError {...form.errorProps('estimatedMinutes')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('startDate')}>Inicio</Label>
          <Input {...form.field('startDate')} type="date" defaultValue={task?.startDate ?? ''} />
          <FieldError {...form.errorProps('startDate')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('endDate')}>Fin</Label>
          <Input {...form.field('endDate')} type="date" defaultValue={task?.endDate ?? ''} />
          <FieldError {...form.errorProps('endDate')} />
        </div>

        {/* De dónde viene (HU-47): del catálogo de Configuración, con su detalle */}
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('originId')}>Origen</Label>
          <NativeSelect {...form.field('originId')} defaultValue={task?.origin?.id ?? ''}>
            <option value="">Sin origen</option>
            {originChoices.map((origin) => (
              <option key={origin.id} value={origin.id}>
                {origin.name}
                {origin.archived ? ' (archivado)' : ''}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('originId')} />
        </div>
        <div className="grid gap-2 sm:col-span-1 lg:col-span-3">
          <Label htmlFor={form.idOf('originDetail')}>Detalle del origen</Label>
          <Input
            {...form.field('originDetail')}
            defaultValue={task?.originDetail ?? ''}
            maxLength={300}
            placeholder="Por ejemplo: Ticket #4521 de mesa de ayuda"
          />
          <FieldError {...form.errorProps('originDetail')} />
        </div>

        <FormActions submitLabel={submitLabel} isPending={isPending} error={error}>
          {children}
        </FormActions>
      </fieldset>
    </form>
  );
}
