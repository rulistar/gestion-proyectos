import {
  mergePersonResultSchema,
  personListSchema,
  personSchema,
  personUsageSchema,
  type CreatePersonInput,
  type Person,
  type UpdatePersonInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Personas que se pueden elegir: las activas y, al editar, la que ya tenía aunque esté archivada */
export function selectablePeople(people: Person[], currentId: string | null | undefined) {
  return people.filter((person) => !person.archived || person.id === currentId);
}

const peoplePath = (workspaceId: string) => `/workspaces/${workspaceId}/people`;

export const peopleQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'people'],
    queryFn: () => apiFetch(peoplePath(workspaceId), { schema: personListSchema }),
  });

/** Dónde aparece una persona (HU-45); se pide al abrir la ventana */
export const personUsageQueryOptions = (workspaceId: string, personId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'people', personId, 'usage'],
    queryFn: () =>
      apiFetch(`${peoplePath(workspaceId)}/${personId}/usage`, { schema: personUsageSchema }),
  });

/** El nombre de una persona aparece en miembros, tareas y proyectos: se refresca el espacio */
export function useCreatePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonInput) =>
      apiFetch(peoplePath(workspaceId), { method: 'POST', body: data, schema: personSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useUpdatePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, ...data }: UpdatePersonInput & { personId: string }) =>
      apiFetch(`${peoplePath(workspaceId)}/${personId}`, {
        method: 'PATCH',
        body: data,
        schema: personListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

/** Borrar definitivamente (HU-44): solo una persona archivada y sin uso */
export function useDeletePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) =>
      apiFetch(`${peoplePath(workspaceId)}/${personId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

/** Fusionar una persona duplicada en otra (HU-51): sus tareas y proyectos cambian de persona */
export function useMergePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, intoId }: { personId: string; intoId: string }) =>
      apiFetch(`${peoplePath(workspaceId)}/${personId}/merge`, {
        method: 'POST',
        body: { intoId },
        schema: mergePersonResultSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
