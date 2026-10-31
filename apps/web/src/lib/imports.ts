import { importPreviewSchema, type ImportRequest } from '@gestion/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { todayIso } from './dates';

/** Vista previa de una carga (HU-14): no escribe nada */
export function usePreviewImport(workspaceId: string) {
  return useMutation({
    mutationFn: (data: ImportRequest) =>
      apiFetch(`/workspaces/${workspaceId}/import/preview`, {
        method: 'POST',
        body: data,
        schema: importPreviewSchema,
      }),
  });
}

/** Aplica la carga; después se refresca todo lo del espacio (contenedores, catálogos, personas) */
export function useApplyImport(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportRequest) =>
      apiFetch(`/workspaces/${workspaceId}/import/apply?today=${todayIso()}`, {
        method: 'POST',
        body: data,
        schema: importPreviewSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
