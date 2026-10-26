import {
  projectTypeListSchema,
  type CreateProjectTypeInput,
  type ProjectBehavior,
  type ProjectType,
  type UpdateProjectTypeInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Comportamientos (ADR-0004 §2), en el orden del menú */
export const BEHAVIOR_LABELS: Record<ProjectBehavior, { label: string; hint: string }> = {
  WITH_END: { label: 'Con fin', hint: 'Proyectos: avance, días restantes y vencido' },
  ONGOING: { label: 'Continuo', hint: 'Mantenimientos: abiertas, vencidas y hechas del mes' },
  ON_DEMAND: { label: 'Por demanda', hint: 'Actividades: pendientes y vencidas' },
};

/** Cada comportamiento tiene su sección en el menú (HU-21) */
export const SECTIONS: Record<
  ProjectBehavior,
  {
    title: string;
    newLabel: string;
    empty: string;
    to: '/w/$workspaceId' | '/w/$workspaceId/mantenimientos' | '/w/$workspaceId/actividades';
  }
> = {
  WITH_END: {
    title: 'Proyectos',
    newLabel: 'Nuevo proyecto',
    empty: 'Todavía no hay proyectos',
    to: '/w/$workspaceId',
  },
  ONGOING: {
    title: 'Mantenimientos',
    newLabel: 'Nuevo mantenimiento',
    empty: 'Todavía no hay mantenimientos',
    to: '/w/$workspaceId/mantenimientos',
  },
  ON_DEMAND: {
    title: 'Actividades',
    newLabel: 'Nuevo grupo de actividades',
    empty: 'Todavía no hay grupos de actividades',
    to: '/w/$workspaceId/actividades',
  },
};

const typesKey = (workspaceId: string) => ['workspaces', workspaceId, 'project-types'];

export const projectTypesQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: typesKey(workspaceId),
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/project-types`, { schema: projectTypeListSchema }),
  });

/** Tipos que se pueden elegir: los activos y, al editar, el que ya tiene aunque esté archivado */
export function selectableTypes(types: ProjectType[], currentId?: string) {
  return types.filter((type) => !type.archived || type.id === currentId);
}

/** Cambiar el catálogo cambia también cómo se muestran los proyectos: se refresca el espacio */
export function useCreateProjectType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectTypeInput) =>
      apiFetch(`/workspaces/${workspaceId}/project-types`, {
        method: 'POST',
        body: data,
        schema: projectTypeListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useUpdateProjectType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ typeId, ...data }: UpdateProjectTypeInput & { typeId: string }) =>
      apiFetch(`/workspaces/${workspaceId}/project-types/${typeId}`, {
        method: 'PATCH',
        body: data,
        schema: projectTypeListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
