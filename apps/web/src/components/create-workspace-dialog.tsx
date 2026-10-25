import { createWorkspaceRequestSchema } from '@gestion/shared';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FieldError } from '@/components/field-error';
import { FormActions } from '@/components/form-actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchemaForm } from '@/lib/use-schema-form';
import { useCreateWorkspace } from '@/lib/workspaces';

/** Ventana para crear un espacio de trabajo (HU-03); al crearlo, lleva a él */
export function CreateWorkspaceDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const createWorkspace = useCreateWorkspace();
  const navigate = useNavigate();
  const form = useSchemaForm(createWorkspaceRequestSchema, ['name'], (data) =>
    createWorkspace.mutate(data, {
      onSuccess: (workspace) => {
        setOpen(false);
        toast.success(`Espacio "${workspace.name}" creado`);
        void navigate({ to: '/w/$workspaceId', params: { workspaceId: workspace.id } });
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) createWorkspace.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo espacio de trabajo</DialogTitle>
          <DialogDescription>Quedarás como Admin del espacio que crees.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={createWorkspace.isPending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input
                {...form.field('name')}
                maxLength={80}
                placeholder="Por ejemplo: Equipo de cursos"
                autoFocus
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <FormActions
              submitLabel="Crear espacio"
              isPending={createWorkspace.isPending}
              error={createWorkspace.error?.message}
            />
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
