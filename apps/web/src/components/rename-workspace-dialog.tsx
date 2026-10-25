import { createWorkspaceRequestSchema, type WorkspaceSummary } from '@gestion/shared';
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
import { useRenameWorkspace } from '@/lib/workspaces';

/** Ventana para renombrar el espacio (solo el Admin). El nombre es una etiqueta: el ID no cambia */
export function RenameWorkspaceDialog({
  workspace,
  trigger,
}: {
  workspace: WorkspaceSummary;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rename = useRenameWorkspace(workspace.id);
  const form = useSchemaForm(createWorkspaceRequestSchema, ['name'], (data) =>
    rename.mutate(data, {
      onSuccess: (updated) => {
        setOpen(false);
        toast.success(`Ahora se llama "${updated.name}"`);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) rename.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar espacio de trabajo</DialogTitle>
          <DialogDescription>
            Cambia solo el nombre que se muestra. Proyectos, miembros, permisos y las conexiones con
            otras aplicaciones siguen funcionando igual.
          </DialogDescription>
        </DialogHeader>
        {/* key: al abrir de nuevo, el campo muestra el nombre vigente */}
        <form key={workspace.name} onSubmit={form.onSubmit} noValidate>
          <fieldset disabled={rename.isPending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input
                {...form.field('name')}
                defaultValue={workspace.name}
                maxLength={80}
                autoFocus
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <FormActions
              submitLabel="Guardar nombre"
              isPending={rename.isPending}
              error={rename.error?.message}
            />
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
