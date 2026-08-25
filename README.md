# BJFF Book Locator

BJFF Book Locator relaciona signaturas bibliográficas basadas en DDC con ubicaciones físicas y mapas SVG de la Biblioteca José Figueres Ferrer del Tecnológico de Costa Rica.

## Estado del proyecto

El repositorio contiene la estructura ejecutable inicial del monorepo, las especificaciones funcionales y el esquema PostgreSQL V1. La aplicación expone por ahora una pantalla base y un endpoint de salud; el flujo funcional todavía debe implementarse.

## Tecnologías

| Área | Tecnología |
|---|---|
| Lenguaje | [TypeScript](https://www.typescriptlang.org/) |
| Monorepo | [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/) |
| Frontend | [React](https://react.dev/) y [Vite](https://vite.dev/) |
| Backend | [Node.js](https://nodejs.org/) y [Express](https://expressjs.com/) |
| Base de datos | [PostgreSQL](https://www.postgresql.org/) mediante [Docker Compose](https://docs.docker.com/compose/) |
| Pruebas | [Vitest](https://vitest.dev/), Testing Library y Supertest |

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| [`apps/web`](apps/web) | Aplicación React, configuración Vite y pruebas de componentes. |
| [`apps/api`](apps/api) | API Express, acceso a PostgreSQL y pruebas HTTP. |
| [`package.json`](package.json) | Workspaces y comandos compartidos de npm. |
| [`docker-compose.yml`](docker-compose.yml) | PostgreSQL local, volumen persistente y migraciones de inicialización. |
| [`docs/README.md`](docs/README.md) | Índice canónico y orden de lectura de la documentación. |
| [`docs/classification-ordering.md`](docs/classification-ordering.md) | Reglas normativas de comparación de signaturas. |
| [`docs/normalization.md`](docs/normalization.md) | Parsing, modelo normalizado y estados de validación. |
| [`docs/comparable_key.md`](docs/comparable_key.md) | Codificación `ck1`, persistencia y consultas por clave. |
| [`docs/database/database-v1.md`](docs/database/database-v1.md) | Semántica, relaciones y operaciones del modelo de datos V1. |
| [`docs/workflows/application-workflow-v1.md`](docs/workflows/application-workflow-v1.md) | Flujo canónico de configuración, publicación y búsqueda. |
| [`database/001_initial_schema.sql`](database/001_initial_schema.sql) | DDL, restricciones, índices, funciones y triggers de PostgreSQL. |
| [`database/002_seed_basic_ordering_profile.sql`](database/002_seed_basic_ordering_profile.sql) | Perfil interno de ordenamiento utilizado por los esquemas V1. |
| [`AGENTS.md`](AGENTS.md) | Reglas operativas para agentes y colaboradores. |

## Preparar el entorno local

Requisitos:

- Node.js 22.12 o posterior;
- npm 10 o posterior;
- Docker con Docker Compose.

Desde la raíz del repositorio, en PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run dev
```

Cambie `POSTGRES_PASSWORD` y la contraseña incluida en `DATABASE_URL` por el mismo valor local antes de levantar PostgreSQL. `.env` no se versiona.

Servicios de desarrollo:

- frontend: `http://localhost:5173`;
- API: `http://localhost:3000`;
- salud de la API: `http://localhost:3000/api/health`;
- PostgreSQL: `localhost:5432`, salvo que `.env` indique otro puerto.

`npm run dev` mantiene frontend y backend activos en la misma terminal. Vite reenvía las solicitudes `/api` hacia Express durante el desarrollo.

## Base de datos local

`npm run db:up` crea el contenedor definido en `.env`. En un volumen vacío, la imagen oficial de PostgreSQL ejecuta en orden los archivos de [`database`](database):

1. `001_initial_schema.sql` crea tipos, tablas, índices, funciones y triggers;
2. `002_seed_basic_ordering_profile.sql` inserta `ddc-base-v1`.

Comandos disponibles:

| Comando | Acción |
|---|---|
| `npm run db:status` | Muestra el estado del servicio. |
| `npm run db:logs` | Sigue los logs de PostgreSQL. |
| `npm run db:down` | Detiene y elimina el contenedor; conserva el volumen. |
| `npm run db:reset` | Elimina también el volumen y vuelve a requerir la inicialización. |

`npm run db:reset` destruye todos los datos locales de PostgreSQL.

## Verificación

```powershell
npm run check
```

El comando comprueba documentación, tipos, pruebas y builds de producción. También puede ejecutar cada parte por separado con `npm run check:docs`, `npm run typecheck`, `npm test` y `npm run build`.

## Decisiones pendientes

Las reglas sobre guiones en marcas de obra y la identificación de una edición DDC siguen abiertas. No deben resolverse por inferencia durante la implementación; consulte [Decisiones abiertas](docs/classification-ordering.md#13-decisiones-abiertas).

Estas decisiones no bloquean la implementación inicial: `CO` y `NORM` ya definen el comportamiento conservador de la V1. Una decisión institucional posterior puede requerir una nueva versión del perfil y regenerar claves.

## Mantenimiento

Cambie la documentación junto con la especificación, migración o implementación que modifica. Si agrega, mueve o reemplaza un documento, actualice también [`docs/README.md`](docs/README.md). Una migración aplicada en un entorno compartido no se edita: agregue la siguiente migración numerada.
