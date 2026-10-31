import { detailFieldKindSchema, type DetailField, type DetailFieldKind } from '@gestion/shared';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  TextCursorInput,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  DETAIL_FIELD_KINDS,
  parseOptions,
  useCreateDetailField,
  useMoveDetailField,
  useUpdateDetailField,
} from '@/lib/detail-fields';

/** Dueño de los campos: un tipo de contenedor o un tipo de tarea */
export type FieldOwner = { projectTypeId: string } | { taskTypeId: string };

function ownsField(owner: FieldOwner, field: DetailField) {
  return 'projectTypeId' in owner
    ? field.projectTypeId === owner.projectTypeId
    : field.taskTypeId === owner.taskTypeId;
}

/**
 * Campos de detalle de un tipo (HU-23, ADR-0004 §3): agregar, renombrar, obligatorio, agregar
 * opciones, ordenar y archivar. La clase no cambia y las opciones no se quitan, para que ningún
 * valor guardado quede inválido. Ejemplo: Incidencia → "Severidad" (lista, obligatoria).
 */
export function DetailFieldsDialog({
  workspaceId,
  owner,
  ownerName,
  fields,
}: {
  workspaceId: string;
  owner: FieldOwner;
  ownerName: string;
  /** Todos los del espacio; se muestran los de este tipo */
  fields: DetailField[];
}) {
  const own = fields.filter((field) => ownsField(owner, field));
  const active = own.filter((field) => !field.archived);
  const archived = own.filter((field) => field.archived);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Campos de detalle que pide este tipo">
          <TextCursorInput aria-hidden />
          Campos ({active.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campos de "{ownerName}"</DialogTitle>
          <DialogDescription>
            Aparecen en la sección Detalle del formulario cuando se elige este tipo. La clase de un
            campo no cambia y las opciones de una lista solo se agregan; si necesitas otra cosa,
            archiva el campo (sus valores se conservan) y crea otro.
          </DialogDescription>
        </DialogHeader>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este tipo todavía no pide campos.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {active.map((field, index) => (
              <FieldRow
                key={field.id}
                workspaceId={workspaceId}
                field={field}
                first={index === 0}
                last={index === active.length - 1}
              />
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Archivados ({archived.length})
            </summary>
            <ul className="mt-2 divide-y rounded-md border">
              {archived.map((field) => (
                <FieldRow key={field.id} workspaceId={workspaceId} field={field} first last />
              ))}
            </ul>
          </details>
        )}
        <NewFieldForm workspaceId={workspaceId} owner={owner} />
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  workspaceId,
  field,
  first,
  last,
}: {
  workspaceId: string;
  field: DetailField;
  first: boolean;
  last: boolean;
}) {
  const update = useUpdateDetailField(workspaceId);
  const move = useMoveDetailField(workspaceId);
  const [editing, setEditing] = useState(false);

  function save(changes: Parameters<typeof update.mutate>[0], message: string) {
    update.mutate(changes, {
      onSuccess: () => {
        toast.success(message);
        setEditing(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  if (editing) {
    return (
      <li className="px-3 py-2">
        <EditFieldForm
          field={field}
          isPending={update.isPending}
          onCancel={() => setEditing(false)}
          onSave={(changes) =>
            save({ fieldId: field.id, ...changes }, `Se guardó "${changes.name ?? field.name}"`)
          }
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {field.name}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {DETAIL_FIELD_KINDS[field.kind]}
          {field.required ? ' · obligatorio' : ' · opcional'}
          {field.kind === 'OPTIONS' && ` · ${field.options.join(', ')}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {!field.archived && (
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Subir ${field.name}`}
              disabled={first || move.isPending}
              onClick={() => move.mutate({ fieldId: field.id, direction: 'up' })}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Bajar ${field.name}`}
              disabled={last || move.isPending}
              onClick={() => move.mutate({ fieldId: field.id, direction: 'down' })}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Editar
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() =>
            save(
              { fieldId: field.id, archived: !field.archived },
              field.archived ? `"${field.name}" se reactivó` : `"${field.name}" se archivó`,
            )
          }
        >
          {field.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {field.archived ? 'Reactivar' : 'Archivar'}
        </Button>
      </div>
    </li>
  );
}

/** Renombrar, obligatorio y, en una lista, agregar opciones (las que ya tiene no se quitan) */
function EditFieldForm({
  field,
  isPending,
  onCancel,
  onSave,
}: {
  field: DetailField;
  isPending: boolean;
  onCancel: () => void;
  onSave: (changes: { name?: string; required?: boolean; options?: string[] }) => void;
}) {
  const [name, setName] = useState(field.name);
  const [required, setRequired] = useState(field.required);
  const [added, setAdded] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const extra = parseOptions(added);
    onSave({
      ...(name.trim() !== field.name && { name: name.trim() }),
      ...(required !== field.required && { required }),
      ...(extra.length > 0 && { options: [...field.options, ...extra] }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <fieldset disabled={isPending} className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Nombre del campo"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoFocus
            className="h-8 w-60"
          />
          <span className="text-xs text-muted-foreground">{DETAIL_FIELD_KINDS[field.kind]}</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="size-4 accent-primary"
            />
            Obligatorio
          </label>
        </div>
        {field.kind === 'OPTIONS' && (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Opciones: {field.options.join(', ')}</p>
            <Textarea
              aria-label="Opciones nuevas, una por renglón"
              placeholder="Opciones nuevas, una por renglón"
              rows={2}
              value={added}
              onChange={(event) => setAdded(event.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function NewFieldForm({ workspaceId, owner }: { workspaceId: string; owner: FieldOwner }) {
  const create = useCreateDetailField(workspaceId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DetailFieldKind>('SHORT_TEXT');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate(
      {
        ...owner,
        name,
        kind,
        required,
        options: kind === 'OPTIONS' ? parseOptions(options) : [],
      },
      {
        onSuccess: () => {
          toast.success(`Se agregó "${name.trim()}"`);
          setName('');
          setRequired(false);
          setOptions('');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-dashed p-3">
      <fieldset disabled={create.isPending} className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-field-name">Campo nuevo</Label>
          <Input
            id="new-field-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Por ejemplo: Severidad"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-field-kind">Clase</Label>
          <NativeSelect
            id="new-field-kind"
            value={kind}
            onChange={(event) => setKind(detailFieldKindSchema.parse(event.target.value))}
          >
            {detailFieldKindSchema.options.map((value) => (
              <option key={value} value={value}>
                {DETAIL_FIELD_KINDS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {kind === 'OPTIONS' && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="new-field-options">Opciones, una por renglón</Label>
            <Textarea
              id="new-field-options"
              rows={4}
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              placeholder={'Crítica\nAlta\nMedia\nBaja'}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
            className="size-4 accent-primary"
          />
          Obligatorio
        </label>
        <div className="flex items-center justify-end gap-2 sm:col-span-2">
          {create.error && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {create.error.message}
            </p>
          )}
          <Button type="submit" size="sm">
            <Plus aria-hidden />
            Agregar campo
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
