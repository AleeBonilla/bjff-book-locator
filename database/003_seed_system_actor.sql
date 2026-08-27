-- Registra el actor técnico usado mientras la autenticación administrativa no existe.
BEGIN;

INSERT INTO users (
  username,
  email,
  password_hash,
  full_name,
  enabled
)
VALUES (
  'system-v1',
  'system-v1@invalid.local',
  'LOGIN_DISABLED',
  'Actor técnico V1',
  false
)
ON CONFLICT DO NOTHING;

COMMIT;
