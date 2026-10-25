import { trashListSchema, type TrashKind } from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const trashPath = (workspaceId: string) => `/workspaces/${workspaceId}/trash`;

export const trashQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'trash'],
    queryFn: () => apiFetch(trashPath(workspaceId), { schema: trashListSchema }),
  });

interface TrashTarget {
  kind: TrashKind;
  id: string;
}

/** Restaurar o borrar cambia la papelera, los proyectos y su avance: se refresca el workspace */
function useTrashMutation(workspaceId: string, request: (target: TrashTarget) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useRestoreFromTrash(workspaceId: string) {
  return useTrashMutation(workspaceId, ({ kind, id }) =>
    apiFetch(`${trashPath(workspaceId)}/${kind}/${id}/restore`, { method: 'POST' }),
  );
}

/** Borrado definitivo: no se puede deshacer */
export function usePurgeFromTrash(workspaceId: string) {
  return useTrashMutation(workspaceId, ({ kind, id }) =>
    apiFetch(`${trashPath(workspaceId)}/${kind}/${id}`, { method: 'DELETE' }),
  );
}
