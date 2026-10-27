import { createPersonSchema } from '@gestion/shared';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreatePerson } from '@/lib/people';

/**
 * Alta rápida de una persona del catálogo desde un formulario (HU-35, ADR-0005 §5). No es un
 * <form> porque vive dentro de otro: se envía con el botón o con Enter.
 */
export function QuickAddPerson({ workspaceId }: { workspaceId: string }) {
  const create = useCreatePerson(workspaceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    const parsed = createPersonSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (person) => {
        toast.success(`Se agregó "${person.name}": ya puedes elegirla`);
        setName('');
        setError(undefined);
        setOpen(false);
      },
      onError: (failure) => setError(failure.message),
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden />
        Agregar persona al catálogo
      </Button>
    );
  }

  return (
    <div className="grid gap-1">
      {/* Si no cabe, los botones bajan de renglón en vez de encimarse */}
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1"
          aria-label="Nombre de la persona nueva"
          placeholder="Nombre de la persona"
          value={name}
          maxLength={120}
          autoFocus
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // Enter agregaría la tarea entera: aquí solo agrega a la persona
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button type="button" size="sm" disabled={create.isPending} onClick={submit}>
          Agregar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
