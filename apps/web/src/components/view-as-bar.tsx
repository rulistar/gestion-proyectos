import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useCurrentUser } from '@/lib/auth';
import { setViewAs, useViewAs } from '@/lib/view-as';
import { membersQueryOptions } from '@/lib/workspaces';

/**
 * Combo "Ver como" de la barra superior (HU-56): solo para el Admin del espacio actual. Elegir a un
 * miembro muestra lo que esa persona ve; "Yo" vuelve a mi vista.
 */
export function ViewAsSelect() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const viewAs = useViewAs();
  const { workspaceId } = useParams({ strict: false });
  const mine = user.workspaces.find((w) => w.id === workspaceId);
  // Mi rol real (de /auth/me), no el de la persona que estoy viendo
  const isAdmin = mine?.role === 'ADMIN';
  const { data: members = [] } = useQuery({
    ...membersQueryOptions(workspaceId ?? ''),
    enabled: isAdmin,
  });

  // Al salir del espacio (otro espacio, Mi perfil...) termina la vista como otra persona
  useEffect(() => {
    if (viewAs && viewAs.workspaceId !== workspaceId) setViewAs(queryClient, null);
  }, [viewAs, workspaceId, queryClient]);

  if (!isAdmin || !workspaceId) return null;
  const others = members.filter((member) => member.userId !== user.id);
  if (others.length === 0) return null;

  function choose(userId: string) {
    const member = others.find((m) => m.userId === userId);
    setViewAs(
      queryClient,
      member ? { workspaceId: workspaceId!, userId, name: member.name } : null,
    );
    if (member)
      void navigate({ to: '/w/$workspaceId/mi-trabajo', params: { workspaceId: workspaceId! } });
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Eye aria-hidden className="size-4" />
      <span className="hidden lg:inline">Ver como</span>
      <NativeSelect
        aria-label="Ver como"
        value={viewAs?.userId ?? ''}
        onChange={(event) => choose(event.target.value)}
        className="h-8 max-w-44 text-sm"
      >
        <option value="">Yo ({user.name})</option>
        {others.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

/** Aviso fijo mientras veo como otra persona, con el botón para salir (HU-56) */
export function ViewAsBanner() {
  const viewAs = useViewAs();
  const queryClient = useQueryClient();
  if (!viewAs) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning px-3 py-1.5 text-sm text-warning-foreground"
    >
      <Eye aria-hidden className="size-4" />
      <span>
        Viendo como <strong>{viewAs.name}</strong> · solo lectura: no se guarda ningún cambio
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 bg-card"
        onClick={() => setViewAs(queryClient, null)}
      >
        Salir
      </Button>
    </div>
  );
}
