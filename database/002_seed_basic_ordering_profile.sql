-- Migración 0.0.2: se aplica después de 001 y registra el contrato interno de la V1.
-- Los usuarios no crean ni seleccionan este perfil al configurar un esquema.

BEGIN;

-- Perfil base que une las versiones vigentes de ordenamiento, normalización y clave.
INSERT INTO ordering_profiles (
  name,
  description,
  ordering_spec_version,
  normalization_profile,
  comparable_key_version,
  enabled
)
VALUES (
  'ddc-base-v1',
  'Contrato interno V1 para signaturas basadas en DDC.',
  '1.0.0',
  'base-1',
  1,
  TRUE
);

COMMIT;
