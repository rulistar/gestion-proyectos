import {
  detailFieldListSchema,
  type CreateDetailFieldInput,
  type DetailField,
  type DetailValues,
  type DetailFieldKind,
  type MoveDetailFieldInput,
  type UpdateDetailFieldInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { formatDate } from './dates';

/** Nombre de cada clase de campo (ADR-0004 §3) */
export const DETAIL_FIELD_KINDS: Record<DetailFieldKind, string> = {
  SHORT_TEXT: 'Texto corto',
  LONG_TEXT: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  OPTIONS: 'Lista de opciones',
  BOOLEAN: 'Sí / No',
};

const fieldsKey = (workspaceId: string) => ['workspaces', workspaceId, 'detail-fields'];

/** Campos de detalle del espacio (HU-23), de todos los tipos */
export const detailFieldsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: fieldsKey(workspaceId),
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/detail-fields`, { schema: detailFieldListSchema }),
  });

/** Cada cambio devuelve la lista completa: se guarda tal cual en la caché */
function useFieldMutation<V>(workspaceId: string, request: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (fields) => queryClient.setQueryData(fieldsKey(workspaceId), fields),
  });
}

export function useCreateDetailField(workspaceId: string) {
  return useFieldMutation(workspaceId, (data: CreateDetailFieldInput) =>
    apiFetch(`/workspaces/${workspaceId}/detail-fields`, {
      method: 'POST',
      body: data,
      schema: detailFieldListSchema,
    }),
  );
}

export function useUpdateDetailField(workspaceId: string) {
  return useFieldMutation(
    workspaceId,
    ({ fieldId, ...data }: UpdateDetailFieldInput & { fieldId: string }) =>
      apiFetch(`/workspaces/${workspaceId}/detail-fields/${fieldId}`, {
        method: 'PATCH',
        body: data,
        schema: detailFieldListSchema,
      }),
  );
}

export function useMoveDetailField(workspaceId: string) {
  return useFieldMutation(
    workspaceId,
    ({ fieldId, ...data }: MoveDetailFieldInput & { fieldId: string }) =>
      apiFetch(`/workspaces/${workspaceId}/detail-fields/${fieldId}/move`, {
        method: 'POST',
        body: data,
        schema: detailFieldListSchema,
      }),
  );
}

/** Una opción por renglón; se quitan los vacíos */
export function parseOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Los inputs de la sección Detalle se llaman `detail:<id del campo>` */
export const DETAIL_INPUT_PREFIX = 'detail:';

/** Campos activos de un tipo, en su orden (la API ya los manda ordenados) */
export function fieldsOfType(
  fields: readonly DetailField[],
  owner: { projectTypeId: string } | { taskTypeId: string | undefined },
): DetailField[] {
  return fields.filter(
    (field) =>
      !field.archived &&
      ('projectTypeId' in owner
        ? field.projectTypeId === owner.projectTypeId
        : field.taskTypeId === owner.taskTypeId),
  );
}

/** Lee los valores de la sección Detalle del formulario; vacío = null (vacía el campo) */
export function readDetails(
  form: HTMLFormElement,
  fields: readonly DetailField[],
): Record<string, string | null> {
  const data = new FormData(form);
  return Object.fromEntries(
    fields.map((field) => {
      const value = data.get(`${DETAIL_INPUT_PREFIX}${field.id}`);
      return [field.id, typeof value === 'string' && value.trim() !== '' ? value : null];
    }),
  );
}

/** Un valor como se lee: Sí/No, fecha en español, número con separadores; sin valor, "—" */
export function formatDetailValue(field: DetailField, values: DetailValues): string {
  const value = values[field.id];
  if (value === undefined || value === '') return '—';
  if (field.kind === 'BOOLEAN') return value === true ? 'Sí' : 'No';
  if (field.kind === 'DATE' && typeof value === 'string') return formatDate(value);
  if (field.kind === 'NUMBER' && typeof value === 'number') return value.toLocaleString('es-MX');
  return String(value);
}
