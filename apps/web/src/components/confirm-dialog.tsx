import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfirmDialogProps {
  /** Botón que abre la ventana */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Si se indica, hay que escribirlo tal cual para habilitar el botón (borrado definitivo) */
  typeToConfirm?: string;
  onConfirm: () => void;
}

/** Pide confirmación antes de una acción destructiva (dar de baja, borrar definitivamente) */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const confirmed = typeToConfirm === undefined || typed.trim() === typeToConfirm.trim();

  return (
    <Dialog onOpenChange={() => setTyped('')}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {typeToConfirm !== undefined && (
          <div className="grid gap-2">
            <Label htmlFor={inputId}>
              Escribe <strong>{typeToConfirm}</strong> para confirmar
            </Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" disabled={!confirmed} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
