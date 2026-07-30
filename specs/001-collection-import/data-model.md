# Modelo de datos: Carga administrativa inicial de la colección

**Fecha**: 2026-07-30 | **Spec**: [spec.md](spec.md)

Esta funcionalidad **no introduce tablas nuevas**. Usa cuatro de las que ya define
`database/01_schema.sql`, que es la fuente de verdad de la estructura implementada.
Este documento explica qué parte del modelo toca, qué garantiza el motor y qué debe
hacer cumplir el servicio.

Para la referencia completa del modelo, ver [`docs/db.md`](../../docs/db.md).

## Alcance sobre el esquema

| Tabla | Uso en esta funcionalidad |
|---|---|
| `users` | Autenticar y atribuir la carga |
| `collection_loads` | Unidad de importación y sus contadores |
| `collection_load_errors` | Problemas por fila |
| `books` | Registros importados y su clave comparable |

El resto del esquema —plantillas, esquemas físicos, ubicaciones, corridas, anchors,
rangos y asignaciones— se crea con la línea base pero ninguna funcionalidad de esta
especificación lo lee ni lo escribe.

## `users`

Campos utilizados: `user_id`, `username`, `email`, `password_hash`, `full_name`,
`role`, `enabled`, `last_login_at`.

| Regla | Origen | Dónde se hace cumplir |
|---|---|---|
| `username` y `email` únicos | FR-001 | Motor (`UNIQUE`) |
| Solo se autentica una cuenta con `enabled = true` | FR-002 | Servicio |
| `password_hash` nunca guarda la contraseña original | FR-007 | Servicio |
| `last_login_at` se actualiza tras un acceso exitoso | FR-006 | Servicio |
| `role` es `ADMIN` | FR-005 | Motor (tipo enumerado) |

La cuenta se crea mediante el script de aprovisionamiento; la aplicación no ofrece
registro (FR-005).

## `collection_loads`

Campos utilizados: `collection_load_id`, `title`, `filename`, `status`, `rows_read`,
`rows_imported`, `rows_without_key`, `rows_flagged`, `rows_rejected`, `created_by`,
`created_at`.

### Estados

```text
PENDING ──> DONE
        └─> ERROR
```

- `PENDING` es transitorio: existe mientras la importación se procesa.
- `DONE` es el único estado que expone registros para uso posterior (**FR-028a**).
- `ERROR` documenta un intento fallido y no expone registros.
- Una carga que quede en `PENDING` por una interrupción abrupta es inerte: no expone
  registros ni impide importaciones posteriores. No requiere recuperación.

### Contadores

| Campo | Significado | Regla |
|---|---|---|
| `rows_read` | Filas de datos leídas | Excluye encabezado, fila vacía y pie (FR-033) |
| `rows_imported` | Filas convertidas en `books` | — |
| `rows_without_key` | Importadas sin `comparable_key` | Subconjunto de `rows_imported` (FR-024) |
| `rows_flagged` | Importadas marcadas para revisión | Subconjunto de `rows_imported` (FR-018, FR-025) |
| `rows_rejected` | Filas no convertidas en registro | FR-039 |

Invariante de FR-037, verificable al cerrar la carga:

```text
rows_imported + rows_rejected = rows_read
```

`rows_without_key` y `rows_flagged` no entran en esa suma: cuentan cualidades de filas
ya contadas en `rows_imported`. Una misma fila puede aparecer en ambos.

Las cargas se conservan como historial salvo que alguien las elimine de forma
explícita. La eliminación la incorporó
[`002-load-management`](../002-load-management/spec.md) y arrastra los registros y los
problemas de la carga por las llaves foráneas en cascada del esquema.

## `collection_load_errors`

Campos utilizados: `collection_load_error_id`, `collection_load_id`, `row_number`,
`severity`, `reason`, `raw_content`.

| Regla | Origen | Dónde se hace cumplir |
|---|---|---|
| `row_number` positivo, referido al archivo | FR-038 | Motor (`CHECK`) + servicio |
| `severity` distingue `REVIEW` de `REJECTED` | FR-038 | Motor (tipo enumerado) |
| `reason` es comprensible para el personal | FR-038 | Servicio |
| `raw_content` solo accesible con sesión activa | FR-044 | Servicio |

`raw_content` conserva el contenido original de la fila para diagnóstico. Es el campo
más sensible de esta funcionalidad: puede contener datos de la colección privada, así
que nunca sale en respuestas sin sesión ni en registros de operación (FR-043).

## `books`

Campos utilizados: `book_id`, `collection_load_id`, `source_row_number`,
`source_barcode`, `classification_raw`, `comparable_key`, `isbn`, `title`, `author`,
`copy_label`, `year`.

### Correspondencia con las columnas del archivo

| Columna del CSV | Campo | Nota |
|---|---|---|
| `codBarras` | `source_barcode` | Requerida; no única (FR-031) |
| `Clasificacion` | `classification_raw` | Requerida como columna; su valor puede estar vacío |
| — | `comparable_key` | Derivada, nunca leída del archivo |
| `Autor` | `author` | Opcional |
| `Titulo` | `title` | Opcional |
| `isbn` | `isbn` | Texto, sin normalizar (FR-011c) |
| `Año` | `year` | `0` significa ausencia (FR-011a) |
| `Z30_DESCRIPTION` | `copy_label` | Opcional |
| — | `source_row_number` | Número de fila del archivo (FR-030) |

Las columnas restantes del archivo se ignoran (FR-012).

### Reglas

| Regla | Origen | Dónde se hace cumplir |
|---|---|---|
| `(collection_load_id, source_row_number)` único | FR-030 | Motor (índice único) |
| `source_barcode` indexado pero no único | FR-031 | Motor |
| `year` entre 1400 y 2200, o nulo | FR-011a, FR-011b | Motor (`CHECK`) + servicio |
| `comparable_key < '~'` | FR-022 | Motor (`CHECK`) |
| `comparable_key` nula si no hay código | FR-024 | Servicio |
| `classification_raw` conserva el valor original | FR-016 | Servicio |
| Comparación por `COLLATE "C"` | FR-023 | Motor (definición de columna) |

## Clave comparable

No es una entidad persistida aparte: es el valor derivado que se guarda en
`books.comparable_key`. Su construcción es el módulo clave de esta funcionalidad
(principio V de la constitución) y vive en `packages/classification`.

### Componentes de la clave

Orden de comparación definido en [`docs/clasificacion.md`](../../docs/clasificacion.md)
y exigido por FR-019 a FR-023:

1. presencia de prefijo: sin prefijo antes que con prefijo;
2. prefijo de país normalizado;
3. número de clase DDC;
4. letras iniciales del Cutter;
5. cifras Cutter como decimal;
6. marca de obra y extensiones.

La clave debe ordenarse correctamente bajo comparación binaria `COLLATE "C"`, sin
depender de la configuración regional del motor.

### Marcas de revisión

La derivación produce, además de la clave, cero o más motivos de revisión:

| Motivo | Requisito |
|---|---|
| Valor no canónico en el número DDC: coma decimal, más de un punto, más de tres dígitos antes del punto, o cualquier espacio interno | FR-018 |
| Segmento alfabético adicional no interpretable o Cutter repetido | FR-025 |
| Espacio adyacente a un guion del Cutter | FR-025a |
| Prefijo alfabético no documentado | FR-025b |
| Año no numérico o fuera del intervalo admitido | FR-011b |

Una fila con al menos un motivo cuenta una vez en `rows_flagged` y genera un registro
en `collection_load_errors` con severidad `REVIEW`. Un motivo nunca impide importar la
fila.

## Reglas que el motor no garantiza

Estas quedan a cargo del servicio y deben tener prueba automatizada:

- coherencia de los cinco contadores con las filas procesadas (FR-036, FR-037);
- atomicidad de los registros: `DONE` con todos, o ninguno disponible (FR-028);
- que solo una carga en `DONE` exponga registros (FR-028a);
- correspondencia entre el pie `TOTAL;n` y las filas leídas (FR-032);
- determinismo de la clave comparable entre ejecuciones (FR-023);
- normalización del prefijo `CU` como `Cu` (FR-020);
- equivalencia de códigos que solo difieren en el indicador de edición DDC (FR-021).
