# ADR-0007: Despliegue gratuito en Render + Neon

- **Estado:** Aceptado (2026-10-29)
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** TEC-04 pide la aplicación en una URL pública con HTTPS, con presupuesto de $0, para usarla con el equipo sin depender de la PC del PO. Hay que elegir dónde corre la aplicación (API + web) y dónde vive PostgreSQL.

## Opciones comparadas (condiciones vigentes al 2026-10-29)

| Servicio | Para | Capa gratuita | Contras |
|---|---|---|---|
| **Render Free** | Aplicación | 750 h al mes, HTTPS y dominio propio incluidos, despliegue desde GitHub | Se duerme tras 15 min sin tráfico; la siguiente visita tarda ~1 min. 512 MB de RAM. |
| Render Postgres Free | BD | 1 GB | **Se borra a los 30 días** (14 de gracia para pagar). Sin respaldos. Descartado. |
| **Neon Free** | BD | Permanente, sin tarjeta. 1 GB por proyecto, 100 CU-h al mes | Se suspende a los 5 min sin uso (despierta en menos de 1 s). Restauración a cualquier punto de las últimas 6 h y 1 instantánea manual. |
| Supabase Free | BD | 500 MB, 2 proyectos | Se pausa tras 1 semana sin uso (se reactiva a mano). Sin respaldos automáticos. |
| Fly.io | Aplicación | Ya no tiene capa gratuita: prueba de 2 h o 7 días | Requiere tarjeta después de la prueba. Descartado. |
| Koyeb | Aplicación | Ya no ofrece servicio web gratuito (solo una BD de 5 h) | Descartado. |

## Decisión

1. **Aplicación en Render Free** (región Virginia) y **base de datos en Neon Free** (AWS us-east-1, la misma zona). La configuración vive en [`render.yaml`](../../render.yaml) (Blueprint).
2. **Un solo servicio**: la API también sirve la web compilada con `@fastify/static` (plugin oficial de Fastify, aprobado por el PO). Web y API comparten URL, así que:
   - la cookie de sesión sigue siendo `HttpOnly` + `Secure` + `SameSite` del mismo sitio;
   - CORS queda restringido a esa misma URL;
   - hay un solo servicio que despierta.

   Las rutas de la web (`/w/…`, `/login`) devuelven `index.html`; lo que empieza con `/api` y no existe da 404 en JSON. Los archivos con hash (`/assets/…`) se guardan en caché un año; `index.html`, nunca.
3. **Despliegue desde `main` solo con CI en verde** (`autoDeployTrigger: checksPass`).
4. **Migraciones en el build** (`prisma migrate deploy`), porque el plan gratuito no tiene comando previo al despliegue. Si una migración falla, el build falla y sigue corriendo la versión anterior.
5. **Secretos solo en Render** (`DATABASE_URL` y `CORS_ORIGINS` con `sync: false`), nunca en el repositorio.
6. **El primer Admin** se crea desde la PC del PO con `pnpm setup:admin` apuntando a la BD de Neon (el plan gratuito de Render no tiene consola).
7. **Respaldos**: Neon Free solo guarda 6 h de historia, así que el PO saca un respaldo con `pg_dump` (imagen de PostgreSQL 17 en Docker) antes de cada sprint y antes de migraciones grandes. Detalle en [docs/despliegue.md](../despliegue.md).

## Consecuencias

- **Primera visita lenta**: tras 15 min sin uso, la app tarda ~1 min en despertar. Aceptable para un equipo pequeño; el plan de pago más barato de Render lo quita.
- **Límites a vigilar**: 1 GB en Neon (sobra para años de tareas) y 100 CU-h al mes (con la suspensión a los 5 min alcanza para uso de oficina).
- Si en el futuro la web se separa (CDN), habría que revisar las cookies (`SameSite`) y CORS.
