# Guía del repositorio

## Alcance

Estas instrucciones se aplican a todo el repositorio. El proyecto está en una etapa de diseño: hay especificaciones Markdown y migraciones PostgreSQL, pero todavía no existe una aplicación ejecutable ni una suite de pruebas.

## Mapa operativo

- `docs/README.md`: índice canónico; consúltelo antes de crear o mover documentación.
- `docs/classification-ordering.md`: autoridad normativa para el orden bibliográfico adoptado (`CO`).
- `docs/normalization.md`: contrato de parsing y representación normalizada (`NORM`).
- `docs/comparable_key.md`: contrato de codificación binaria y compatibilidad (`CK`).
- `docs/database/database-v1.md`: semántica y procedimientos del modelo de datos V1.
- `docs/workflows/application-workflow-v1.md`: flujo funcional canónico de la aplicación V1.
- `database/001_initial_schema.sql`: autoridad sobre tablas, restricciones, índices, funciones y triggers implementados.
- `database/002_seed_basic_ordering_profile.sql`: dato inicial del perfil interno de ordenamiento V1.
- `scripts/check-docs.ps1`: verificación de archivos y enlaces Markdown locales.

## Fuentes de verdad

- Para estructura ejecutable de datos, prevalece `database/001_initial_schema.sql`; para el perfil inicial, prevalece `database/002_seed_basic_ordering_profile.sql`.
- Para orden bibliográfico intencional, prevalece la versión vigente de `classification-ordering.md`.
- La normalización debe rastrear reglas `CO-*`; la clave comparable debe rastrear reglas `CO-*` y `NORM-*`.
- El código futuro demuestra comportamiento observado, pero no reemplaza decisiones bibliográficas abiertas ni políticas institucionales sin validación.

## Restricciones del proyecto

- Conserve por separado la signatura original, la representación normalizada, la clave comparable y sus versiones.
- No compare claves generadas con contratos de ordenamiento incompatibles.
- No solicite al usuario crear ni seleccionar un `ordering_profile`; la V1 asigna internamente `ddc-base-v1`.
- No infiera una edición DDC a partir de un sufijo numérico aislado.
- No colapse silenciosamente las fronteras marcadas por guiones.
- No presente como implementado un comportamiento que solo aparece en una especificación.
- No edite una migración ya aplicada en un entorno compartido; cree `002_...sql`, `003_...sql` y así sucesivamente.
- No resuelva `CO-OPEN-01` ni `CO-OPEN-02` sin una decisión institucional explícita.

## Verificación

Ejecute desde la raíz:

```powershell
pwsh -NoProfile -File .\scripts\check-docs.ps1
```

No hay todavía comandos de compilación, lint o pruebas de aplicación. Para probar las migraciones, use una base PostgreSQL vacía y el procedimiento de [`README.md`](README.md#aplicar-las-migraciones-iniciales).

## Mantenimiento documental

Actualice `docs/README.md` cuando agregue, mueva, depreque o sustituya un documento. Mantenga una sola fuente canónica por regla y enlace a ella en lugar de copiarla.
