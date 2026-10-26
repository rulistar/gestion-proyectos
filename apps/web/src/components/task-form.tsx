import {
  statusNeedsReason,
  taskInputSchema,
  type Member,
  type Task,
  type TaskInput,
  type TaskStatus,
  type TaskTypeRef,
} from '@gestion/shared';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { TASK_STATUSES } from '@/lib/tasks';
import { useSchemaForm } from '@/lib/use-schema-form';

const FIELDS = [
  'title',
  'typeId',
  'status',
  'estimatedMinutes',
  'assigneeId',
  'startDate',
  'endDate',
  'statusReason',
] as const;

interface TaskFormProps {
  /** Valores iniciales al editar; sin ellos el formulario está vacío (crear) */
  task?: Task;
  members: Member[];
  /** Tipos que admite el contenedor (HU-22); el primero es el de por omisión al crear */
  types: TaskTypeRef[];
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
  members,
  types,
  submitLabel,
  isPending,
  error,
  children,
  onSubmit,
}: TaskFormProps) {
  const form = useSchemaForm(taskInputSchema, FIELDS, onSubmit);
  // El motivo solo se pide (y se muestra) en Pausada y Cancelada (HU-24)
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING');

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
          <Label htmlFor={form.idOf('title')}>Título</Label>
          <Input {...form.field('title')} defaultValue={task?.title} maxLength={200} />
          <FieldError {...form.errorProps('title')} />
        </div>
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
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('assigneeId')}>Responsable</Label>
          <NativeSelect {...form.field('assigneeId')} defaultValue={task?.assigneeId ?? ''}>
            <option value="">Sin asignar</option>
            {/* Se puede conservar al responsable que ya no es miembro, o reasignar (HU-25) */}
            {task?.assigneeId && !task.assigneeIsMember && (
              <option value={task.assigneeId}>{task.assigneeName} (ya no es miembro)</option>
            )}
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('assigneeId')} />
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

        <FormActions submitLabel={submitLabel} isPending={isPending} error={error}>
          {children}
        </FormActions>
      </fieldset>
    </form>
  );
}
