-- HU-53: plantillas nuevas. Miembro ve las tareas de los contenedores que ve; Lector, solo lo de
-- trabajo. Solo cambian las matrices que eran exactamente la plantilla anterior (los «ajustados»
-- se quedan igual); al resto se le agrega "workOnly": false.

-- Miembro: tareas "las mías" → "las que ve"
UPDATE "memberships"
SET "permissions" = jsonb_set("permissions"::jsonb, '{tasks,view}', '"VISIBLE"') || '{"workOnly": false}'
WHERE "role" = 'MEMBER' AND "permissions"::jsonb = '{
  "sections": {
    "WITH_END": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"},
    "ONGOING": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"},
    "ON_DEMAND": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"}
  },
  "tasks": {"view": "MINE", "create": true, "update": "MINE", "remove": "NONE"}
}'::jsonb;

UPDATE "invitation_grants"
SET "permissions" = jsonb_set("permissions"::jsonb, '{tasks,view}', '"VISIBLE"') || '{"workOnly": false}'
WHERE "role" = 'MEMBER' AND "permissions"::jsonb = '{
  "sections": {
    "WITH_END": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"},
    "ONGOING": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"},
    "ON_DEMAND": {"view": "OWN", "create": false, "update": "OWN", "remove": "NONE"}
  },
  "tasks": {"view": "MINE", "create": true, "update": "MINE", "remove": "NONE"}
}'::jsonb;

-- Lector: solo trabajo
UPDATE "memberships"
SET "permissions" = "permissions"::jsonb || '{"workOnly": true}'
WHERE "role" = 'VIEWER' AND "permissions"::jsonb = '{
  "sections": {
    "WITH_END": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ONGOING": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ON_DEMAND": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"}
  },
  "tasks": {"view": "VISIBLE", "create": false, "update": "NONE", "remove": "NONE"}
}'::jsonb;

UPDATE "invitation_grants"
SET "permissions" = "permissions"::jsonb || '{"workOnly": true}'
WHERE "role" = 'VIEWER' AND "permissions"::jsonb = '{
  "sections": {
    "WITH_END": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ONGOING": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ON_DEMAND": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"}
  },
  "tasks": {"view": "VISIBLE", "create": false, "update": "NONE", "remove": "NONE"}
}'::jsonb;

-- El resto (Admin y ajustados): sin «Solo trabajo», como hasta ahora
UPDATE "memberships"
SET "permissions" = "permissions"::jsonb || '{"workOnly": false}'
WHERE NOT ("permissions"::jsonb ? 'workOnly');

UPDATE "invitation_grants"
SET "permissions" = "permissions"::jsonb || '{"workOnly": false}'
WHERE NOT ("permissions"::jsonb ? 'workOnly');
