# BJFF Book Locator

BJFF Book Locator relaciona signaturas bibliográficas basadas en DDC con ubicaciones físicas y mapas SVG de la Biblioteca José Figueres Ferrer del Tecnológico de Costa Rica.

## Estado del proyecto

El repositorio contiene las especificaciones de ordenamiento, normalización, codificación y flujo, además del esquema PostgreSQL V1. No contiene una aplicación ejecutable, dependencias de aplicación, pruebas automatizadas ni configuración de despliegue. Las migraciones SQL son la autoridad sobre la estructura y los datos iniciales implementados.

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| [`docs/README.md`](docs/README.md) | Índice canónico y orden de lectura de la documentación. |
| [`docs/classification-ordering.md`](docs/classification-ordering.md) | Reglas normativas de comparación de signaturas. |
| [`docs/normalization.md`](docs/normalization.md) | Parsing, modelo normalizado y estados de validación. |
| [`docs/comparable_key.md`](docs/comparable_key.md) | Codificación `ck1`, persistencia y consultas por clave. |
| [`docs/database/database-v1.md`](docs/database/database-v1.md) | Semántica, relaciones y operaciones del modelo de datos V1. |
| [`docs/workflows/application-workflow-v1.md`](docs/workflows/application-workflow-v1.md) | Flujo canónico de configuración, publicación y búsqueda. |
| [`database/001_initial_schema.sql`](database/001_initial_schema.sql) | DDL, restricciones, índices, funciones y triggers de PostgreSQL. |
| [`database/002_seed_basic_ordering_profile.sql`](database/002_seed_basic_ordering_profile.sql) | Perfil interno de ordenamiento utilizado por los esquemas V1. |
| [`AGENTS.md`](AGENTS.md) | Reglas operativas para agentes y colaboradores. |

## Aplicar las migraciones iniciales

Requisitos:

- PostgreSQL 14 o posterior;
- `psql` disponible en la terminal;
- una base de datos vacía;
- `DATABASE_URL` apuntando a esa base.

Desde la raíz del repositorio, en PowerShell:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f .\database\001_initial_schema.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f .\database\002_seed_basic_ordering_profile.sql
```

La primera migración crea tipos, tablas, índices, funciones y triggers. La segunda inserta `ddc-base-v1`, el perfil interno que la aplicación asigna a los esquemas sin solicitar una selección al usuario. Cada archivo se ejecuta en su propia transacción. En esta etapa, la recuperación esperada es descartar la base de datos de prueba y crear otra vacía.

## Verificar la documentación

```powershell
pwsh -NoProfile -File .\scripts\check-docs.ps1
```

La comprobación falla si un documento Markdown requerido está vacío, si un enlace relativo apunta a una ruta inexistente o si la documentación contiene el carácter de flecha derecha prohibido.

## Decisiones pendientes

Las reglas sobre guiones en marcas de obra y la identificación de una edición DDC siguen abiertas. No deben resolverse por inferencia durante la implementación; consulte [Decisiones abiertas](docs/classification-ordering.md#13-decisiones-abiertas).

Estas decisiones no bloquean la implementación inicial: `CO` y `NORM` ya definen el comportamiento conservador de la V1. Una decisión institucional posterior puede requerir una nueva versión del perfil y regenerar claves.

## Mantenimiento

Cambie la documentación junto con la especificación, migración o implementación que modifica. Si agrega, mueve o reemplaza un documento, actualice también [`docs/README.md`](docs/README.md). Una migración aplicada en un entorno compartido no se edita: agregue la siguiente migración numerada.
