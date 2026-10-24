# Sprint 1 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-10-26 → 2026-11-06** (2 semanas) |
| Capacidad | 5–10 h/semana (PO + Claude Code) |
| Compromiso | **24 puntos** (referencia: 21; TEC-03 es el candidato a moverse si hace falta) |

## Objetivo del sprint

> **"Un usuario puede iniciar sesión y crear su espacio de trabajo de forma segura."**

Al final del sprint el Admin inicial se crea con un comando, entra por la pantalla de login, crea un workspace y cierra sesión, todo con sesiones seguras y cumpliendo RNF-01.

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | TEC-01 | Modelo de datos + Prisma (ADR-0002 primero) | 8 |
| 2 | TEC-02 | Seguridad HTTP + HTTPS en producción | 3 |
| 3 | TEC-07 | Comando para crear el primer Admin | 2 |
| 4 | HU-02 | Iniciar y cerrar sesión segura | 5 |
| 5 | TEC-03 | Base del frontend | 3 |
| 6 | HU-03 | Crear workspace | 3 |
| | | **Total** | **24** |

Detalle y criterios de aceptación: [backlog.md](../backlog.md).

## Plan de trabajo (una rama y un PR por elemento)

1. **ADR-0002 · modelo de datos**: diagrama de entidades y decisiones; lo aprueba el PO antes de programar.
2. TEC-01 → 3. TEC-02 → 4. TEC-07 → 5. HU-02 (API) → 6. TEC-03 → 7. HU-02 (web) → 8. HU-03.

## Dependencias nuevas que habrá que aprobar

Cada una se propondrá en su PR, con el porqué. Solo se instalará con la aprobación del PO.

| Elemento | Dependencia | ¿En el ADR? |
|---|---|---|
| TEC-01 | `prisma`, `@prisma/client` | ✅ Prisma |
| TEC-02 | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` | ✅ helmet, CORS, rate limiting |
| HU-02 | `argon2` (✅ probado en Windows), `@fastify/cookie` | ✅ Argon2 y sesiones con cookie (plugin de soporte) |
| TEC-03 | `@tanstack/react-query`, shadcn/ui y sus dependencias | ✅ |
| TEC-03 | `@tanstack/react-router` | ✅ Decidido en [ADR-0003](../adr/ADR-0003-enrutador-web.md) |

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| **Smart App Control bloquea binarios nativos** (como pasó con Vite 8). Argon2 y Prisma usan binarios nativos. | Media | Alta | Probar cada binario en local **antes** de adoptarlo; alternativas: Argon2 en WASM, motor de Prisma sin binario nativo. |
| Curva de aprendizaje de sesiones y seguridad | Alta | Media | Explicación paso a paso en cada PR. |
| 24 pts > 21 de referencia | Media | Baja | TEC-03 puede pasar al Sprint 2 sin afectar el objetivo de la API. |

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-23 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar avance y bloqueos |
| Revisión (_review_) | 2026-11-06 | Demostración del objetivo funcionando |
| Retrospectiva | 2026-11-06 | Qué salió bien, qué mejorar, qué probar en el Sprint 2 |

## Resultado (cierre: 2026-10-24)

- Puntos completados: **24 / 24**
- Objetivo cumplido: ☑ Sí ☐ No. El PO lo comprobó en el navegador: setup:admin → login → crear workspace → cerrar sesión.
- Terminado antes de la fecha planeada de inicio (2026-10-26), así que el Sprint 2 se adelanta.

### Revisión

| ID | Elemento | Pts | PR |
|---|---|---|---|
| TEC-01 | Modelo de datos + Prisma | 8 | #6 |
| TEC-02 | Seguridad HTTP | 3 | #7 |
| TEC-07 | Primer Admin (`setup:admin`) | 2 | #8 |
| HU-02 | Iniciar y cerrar sesión | 5 | #9 (API), #10 (web) |
| TEC-03 | Base del frontend | 3 | #10 |
| HU-03 | Crear workspace | 3 | #11 |

- 53 pruebas en verde y CI en verde en todos los PR.
- Pendiente de la Definición de Terminado: "funciona en el entorno desplegado", que llega con TEC-04 (Sprint 3).
- El PR #1 de Dependabot (`@types/node` 26) queda obsoleto, porque ahora se ignoran esos majors. Se cierra sin fusionar.

### Retrospectiva

**Salió bien**

- Una rama y un PR por elemento: cambios pequeños y fáciles de revisar.
- Los binarios nativos (Argon2, Prisma) se probaron antes de adoptarlos, y no hubo bloqueos de Smart App Control.
- El PO decidió rápido: el nombre del workspace, el tiempo de inactividad y el enrutador. Se sintió acompañado en todo momento.

**A mejorar**

- Los puntos no sirvieron para medir el calendario: se completaron 24 puntos en 2 días.
- Hubo confusión en GitHub: el botón deshabilitado, PRs ya fusionados y PRs aún no creados.
- Los PR se fusionaron en 1 o 2 minutos, sin tiempo para probarlos.
- La curva de aprendizaje del stack es alta para el PO.

**Acuerdos para el Sprint 2 (aceptados por el PO)**

1. El sprint se mide por objetivo e historias terminadas, no por calendario; si se termina antes, se adelanta el siguiente.
2. Claude crea el PR y entrega el enlace directo (con `gh` si el PO aprueba instalarlo).
3. Cada PR incluye una sección **"Cómo probarlo"** de 3 o 4 pasos, y el PO prueba antes de fusionar.
4. Material de estudio: guía de la arquitectura con una ruta de lectura (fuera del repositorio).
