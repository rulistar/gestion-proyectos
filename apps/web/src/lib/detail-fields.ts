import {
  detailFieldListSchema,
  type CreateDetailFieldInput,
  type DetailFieldKind,
  type MoveDetailFieldInput,
  type UpdateDetailFieldInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

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
