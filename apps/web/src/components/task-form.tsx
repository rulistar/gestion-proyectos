import { taskInputSchema, type Member, type Task, type TaskInput } from '@gestion/shared';
import type { ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { TASK_STATUSES, TASK_TYPES } from '@/lib/tasks';
import { useSchemaForm } from '@/lib/use-schema-form';

const FIELDS = [
  'title',
  'type',
  'status',
  'estimatedMinutes',
  'assigneeId',
  'startDate',
  'endDate',
] as const;

interface TaskFormProps {
  /** Valores iniciales al editar; sin ellos el formulario está vacío (crear) */
  task?: Task;
  members: Member[];
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
  submitLabel,
  isPending,
  error,
  children,
  onSubmit,
}: TaskFormProps) {
  const form = useSchemaForm(taskInputSchema, FIELDS, onSubmit);

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
          <Label htmlFor={form.idOf('title')}>Título</Label>
          <Input {...form.field('title')} defaultValue={task?.title} maxLength={200} />
          <FieldError {...form.errorProps('title')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('type')}>Tipo</Label>
          <NativeSelect {...form.field('type')} defaultValue={task?.type ?? 'TASK'}>
            {Object.entries(TASK_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('type')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('status')}>Estado</Label>
          <NativeSelect {...form.field('status')} defaultValue={task?.status ?? 'PENDING'}>
            {Object.entries(TASK_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError {...form.errorProps('status')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={form.idOf('assigneeId')}>Responsable</Label>
          <NativeSelect {...form.field('assigneeId')} defaultValue={task?.assigneeId ?? ''}>
            <option value="">Sin asignar</option>
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
