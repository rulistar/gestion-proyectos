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

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 24
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
