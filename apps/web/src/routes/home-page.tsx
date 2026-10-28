import { FolderKanban, Plus } from 'lucide-react';
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/auth';

/**
 * Inicio sin espacios de trabajo (quien sí tiene, va directo al primero: lo decide la ruta).
 * "Mi trabajo" reemplaza esta pantalla en HU-28b.
 */
export function HomePage() {
  const user = useCurrentUser();

  return (
    <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 text-center">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
      >
        <FolderKanban className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      {/* Solo el Admin del sistema crea espacios (HU-42); los demás esperan una invitación */}
      {user.isSystemAdmin ? (
        <>
          <p className="text-muted-foreground">
            Todavía no hay espacios de trabajo. Crea uno para empezar a organizar los proyectos.
          </p>
          <CreateWorkspaceDialog
            trigger={
              <Button size="lg">
                <Plus aria-hidden />
                Crear mi primer espacio
              </Button>
            }
          />
        </>
      ) : (
        <p className="text-muted-foreground">
          Todavía no participas en ningún espacio de trabajo. Pide a un Admin que te invite al suyo.
        </p>
      )}
    </div>
  );
}
