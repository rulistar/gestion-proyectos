import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';

/** Se muestra cuando una ruta no puede cargar sus datos (por ejemplo, un 404 de la API) */
export function ErrorPage({ error }: ErrorComponentProps) {
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <Card className="mx-auto mt-8 max-w-md">
      <CardHeader>
        <CardTitle>{notFound ? 'No encontrado' : 'Algo salió mal'}</CardTitle>
        <CardDescription>
          {notFound
            ? 'No existe o no tienes acceso.'
            : 'No se pudo cargar la página. Intenta de nuevo en un momento.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link to="/" className="text-sm font-medium hover:underline">
          Volver al inicio
        </Link>
      </CardContent>
    </Card>
  );
}
