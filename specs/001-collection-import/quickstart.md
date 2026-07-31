# Puesta en marcha y validación

**Fecha**: 2026-07-30 | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/rest-api.md](contracts/rest-api.md)

Guía para levantar la funcionalidad y comprobar que cumple lo especificado. No
contiene código de implementación.

## Requisitos previos

- Node.js 20 o superior
- Docker con Compose
- Puertos libres: `5432` (PostgreSQL), `3000` (API), `5173` (frontend)

## 1. Base de datos

```bash
docker compose up -d db
```

Al crear el volumen por primera vez se aplican en orden `database/01_schema.sql`,
`02_functions_triggers.sql` y `03_views.sql`. Cada uno supone que el anterior terminó
correctamente.

Después, `docker/initdb/99_setup.sh` crea dos cosas más, que no pertenecen a la línea
base sino al entorno de desarrollo:

- el rol de aplicación `bjff_app`, con privilegios mínimos (principio VI);
- la base **`bjff_test`**, con la misma línea base aplicada, para las pruebas.

Comprobar que las cuatro tablas de esta funcionalidad existen:

```bash
docker compose exec db psql -U bjff -d bjff -c "\dt users|collection_loads|collection_load_errors|books"
```

Para volver a empezar desde cero, hay que borrar el volumen; de lo contrario los
scripts de inicialización no se vuelven a ejecutar:

```bash
docker compose down -v
```

## 2. Configuración

```bash
cp .env.example .env
```

`.env` no se versiona. Contiene las cadenas de conexión, el secreto de sesión y los
límites de `FR-013a`. Ningún valor real debe llegar al repositorio.

Son dos conexiones distintas y deben seguir siéndolo:

| Variable | Base | Uso |
|---|---|---|
| `DATABASE_URL` | `bjff` | La aplicación, con el rol de privilegios mínimos |
| `TEST_DATABASE_URL` | `bjff_test` | Las pruebas, que vacían tablas antes de cada caso |

## 3. Dependencias

```bash
npm install
```

## 4. Cuenta administrativa

No existe registro público de cuentas (**FR-005**). La primera se crea con el script de
aprovisionamiento, que lee las credenciales del entorno y nunca las imprime:

```bash
npm run seed:admin --workspace apps/api
```

## 5. Ejecución

```bash
npm run dev
```

Levanta la API en `http://localhost:3000` y el frontend en `http://localhost:5173`.

## Validación

### Pruebas automatizadas

```bash
npm test
```

Las pruebas de integración corren contra **`bjff_test`**, una base separada de la de
desarrollo: vacían las tablas antes de cada caso, así que compartir base borraría las
cargas y la cuenta administrativa. El arnés aborta si `TEST_DATABASE_URL` no apunta a
una base cuyo nombre termine en `_test`.

Estado verificado el 2026-07-30: **147 pruebas en 18 archivos, todas en verde**,
incluidas las de [`002-load-management`](../002-load-management/spec.md).

Cobertura exigida por el principio V de la constitución:

| Módulo clave | Dónde |
|---|---|
| Normalización y orden de códigos de clasificación | `packages/classification` |
| Importación completa, contadores y atomicidad | `apps/api` |

### Escenario de referencia

`bjff-collection-example.csv` es el archivo de prueba. `bjff-collection.csv` y
`docs/dataset.md` son material privado y no se usan en pruebas ni se copian a ningún
artefacto generado.

Importar el archivo de ejemplo debe producir exactamente (**SC-002**):

| Contador | Valor |
|---|---:|
| Filas leídas | 47 |
| Importadas | 47 |
| Rechazadas | 0 |
| Sin clave comparable | 1 |
| Marcadas para revisión | 5 |

Repetir la importación debe dar los mismos cinco contadores y las mismas claves
comparables (**SC-003**).

### Comprobaciones manuales

| Qué verificar | Cómo | Resultado esperado | Requisito |
|---|---|---|---|
| Acceso obligatorio | Consultar cualquier recurso sin sesión | `401`, sin datos de la colección | FR-004, SC-001 |
| Mensaje de acceso | Usuario inexistente y contraseña incorrecta | Respuesta idéntica en ambos casos | FR-002 |
| Cierre de sesión | Cerrar y reintentar una consulta | `401` inmediato | FR-003 |
| Código original | Ver un registro con código no canónico | `classificationRaw` intacto | FR-016 |
| Agrupamiento de dígitos | Comparar `303.440 972 862 021` y `303.440.972.862.021` | Misma clave, ninguna marcada | FR-018 |
| Código en el problema | Abrir el detalle de una carga | Cada problema muestra su código de clasificación | FR-038a |
| Indicador de edición | Comparar `658 H477A11` y `658 H477A11 23` | Misma `comparableKey` | FR-021, SC-005 |
| Orden decimal DDC | Ordenar por clave | `004.0151` antes que `004.1` | FR-017, SC-004 |
| Cifras Cutter | Ordenar por clave | `863 S248m` antes que `863 S25m` | FR-017, SC-004 |
| Prefijos | Ordenar por clave | Sin prefijo antes que con prefijo | FR-019 |
| `Cu` y `CU` | Comparar ambas filas | Mismo prefijo normalizado | FR-020 |
| Año ausente | Fila con `Año` = `0` | `year` nulo y **sin** marca de revisión | FR-011a |
| Año inválido | Fila con año fuera del intervalo | `year` nulo **con** marca de revisión | FR-011b |
| Fila vacía y pie | Contar registros | 47, no 49 | FR-033 |
| Entrecomillado | Fila con `;` dentro de comillas | Columnas siguientes alineadas | FR-008b |
| Códigos de barras repetidos | Importar el ejemplo | Ninguna fila rechazada por duplicado | FR-031 |
| Tiempo de respuesta | `PERF=1 npx vitest run --project api test/integration/performance.spec.ts` | Menos de 30 segundos | SC-006 |

### Comprobaciones de fallo

| Qué verificar | Cómo | Resultado esperado | Requisito |
|---|---|---|---|
| Columna faltante | Archivo sin `Clasificacion` | `422 MISSING_REQUIRED_COLUMN`, ninguna carga creada | FR-013 |
| Codificación | Archivo que no es UTF-8 | `422 INVALID_ENCODING` | FR-013 |
| Tamaño | Archivo por encima del límite | `413 FILE_TOO_LARGE` | FR-013a |
| Pie incoherente | Alterar `TOTAL;47` a otro número | Carga en `ERROR`, 0 registros disponibles | FR-032 |
| Atomicidad | Interrumpir el proceso a mitad | Ningún registro disponible; se acepta una importación nueva | FR-028, SC-007a |

### Privacidad y registros

| Qué verificar | Resultado esperado | Requisito |
|---|---|---|
| Registros de una importación | Inicio y desenlace correlacionables por identificador de carga | FR-043a, FR-043b, SC-009a |
| Contenido de los registros | Sin filas de la colección, credenciales ni identificadores de sesión | FR-043, FR-043c |
| `rawContent` de un problema | Solo accesible con sesión activa | FR-044 |

## Notas de la primera versión

- La sesión vive en memoria del proceso: el backend corre como una sola instancia y al
  reiniciarlo hay que volver a entrar. Ver la decisión 3 de [research.md](research.md).
- La importación es síncrona y se sostiene sobre el objetivo de SC-006. Si dejara de
  cumplirse, la decisión a revisar es esa, no la espera.

## Medición de SC-006

Ejecutada el 2026-07-30 sobre PostgreSQL 16 en Docker, con un archivo sintético de
10 000 filas:

| Métrica | Valor |
|---|---:|
| Filas importadas | 10 000 |
| Tiempo total | **841 ms** |
| Objetivo | 30 000 ms |

El margen es de unas 35 veces, así que la decisión de procesar de forma síncrona queda
holgadamente respaldada.
