# Migraciones

La **línea base** del esquema son los tres scripts de `database/`, aplicados en orden:

1. `01_schema.sql`
2. `02_functions_triggers.sql`
3. `03_views.sql`

En desarrollo se aplican solos al crear el volumen de PostgreSQL, según
`docker-compose.yml`.

## Cuándo usar una migración

Una vez que el esquema está aplicado en un entorno compartido, **todo cambio de
persistencia va aquí**, como archivo SQL numerado y aplicable hacia adelante. No se
edita la línea base como si nunca se hubiera aplicado (principio VII de la
constitución).

Cada migración debe:

- ser reproducible y tener un orden de aplicación explícito;
- actualizar `docs/db.md` en el mismo cambio;
- indicar qué dato se pierde y por qué es aceptable, si es destructiva.

## Cómo aplicarlas

```bash
npm run migrate -w apps/api -- up
```

Se aplican con el rol propietario del esquema, no con el rol de aplicación, que solo
tiene privilegios de lectura y escritura de datos.

## Estado

Vacío. La funcionalidad `001-collection-import` usa el esquema tal como está y no
requiere ninguna migración.
