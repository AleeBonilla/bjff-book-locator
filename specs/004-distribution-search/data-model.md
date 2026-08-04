# Modelo de datos: Distribución y búsqueda pública

**Fecha**: 2026-08-03 | **Spec**: [spec.md](spec.md)

Este modelo usa las entidades ya presentes en la línea base. La implementación solo
agrega `revision` a `distribution_runs` mediante una migración hacia adelante.

## Enumeraciones existentes

```text
process_status: PENDING | DONE | ERROR
distribution_strategy: CAPACITY | WEIGHTED | ANCHORED | HYBRID | MANUAL
capacity_unit: BOOKS | CENTIMETERS | WEIGHT
range_source: AUTO | ANCHORED | MANUAL
scheme_status: DRAFT | DEFINED | DISTRIBUTED
```

## Entidades persistidas

### `distribution_runs`

Cabecera versionada de un cálculo.

| Campo                          | Uso en 004                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| `distribution_run_id`          | Identidad de la corrida.                                           |
| `scheme_id`                    | `scheme` fijo durante toda la vida de la corrida.                  |
| `collection_load_id`           | Carga fija durante toda la vida de la corrida.                     |
| `based_on_distribution_run_id` | Linaje opcional dentro del mismo `scheme`.                         |
| `strategy`                     | Estrategia fija después de crear la corrida.                       |
| `parameters`                   | Opciones futuras específicas; 004 no duplica aquí campos estables. |
| `status`                       | `PENDING`, `DONE` o `ERROR`.                                       |
| defaults                       | Último nivel de precedencia de configuración.                      |
| contadores                     | Libros considerados, posiciones y no asignados.                    |
| publicación                    | `is_published` y `published_at`.                                   |
| diagnóstico                    | `error_message` sin material privado.                              |
| auditoría                      | Creador y fechas existentes.                                       |
| `revision`                     | Nuevo entero positivo para concurrencia optimista. Inicia en 1.    |

Reglas adicionales del servicio:

- solo usa cargas `DONE` y schemes habilitados en `DEFINED` o `DISTRIBUTED`;
- el linaje no puede crear ciclos ni cruzar schemes;
- una corrida publicada es inmutable salvo su selección como versión pública;
- toda mutación exige `expectedRevision` y aumenta `revision` una vez al confirmar;
- `PENDING` rechaza otras mutaciones mediante lock sin espera;
- un cálculo correcto deja el scheme en `DISTRIBUTED`.

### `distribution_position_inputs`

Snapshot de las `POSITION` utilizables y de su configuración efectiva.

`resolution` usa esta forma JSON estable:

```json
{
  "capacity": { "source": "LOCATION|ANCESTOR|TEMPLATE|RUN", "sourceId": 123 },
  "targetFillRatio": { "source": "LOCATION|ANCESTOR|TEMPLATE|RUN", "sourceId": 123 },
  "allowOverflow": { "source": "LOCATION|ANCESTOR|TEMPLATE|RUN", "sourceId": 123 }
}
```

`sourceId` es el identificador del nivel concreto y es `null` para `RUN`. Capacidad y
unidad comparten una sola entrada de resolución.

Reglas:

- existe exactamente una fila por `POSITION` incluida;
- `position_sequence` reproduce el `leaf_sequence` vigente al congelar;
- las posiciones avanzan de 1 a N sin duplicados;
- cada campo resuelto conserva valor y origen;
- un recálculo con reconstrucción sustituye el snapshot completo.

### `distribution_anchors`

Entrada de `ANCHORED` o `HYBRID`. `boundary_code` conserva la escritura administrativa
y `boundary_key` se deriva con `@bjff/classification`.

Reglas:

- referencia una posición del snapshot;
- existe como máximo uno por posición;
- no se admite en la primera posición cuando no agrega un límite real;
- posiciones y claves avanzan estrictamente en el mismo orden;
- no existe en `CAPACITY`, `WEIGHTED` o `MANUAL`;
- `ANCHORED` lo exige para toda posición posterior a la primera.

### `distribution_ranges`

Resultado resumido y, en `MANUAL`, validación exitosa de la propuesta completa.

Reglas:

- intervalos semiabiertos `[start, end)`;
- cobertura continua desde `''` hasta `~`;
- secuencia estricta, sin huecos ni solapamientos;
- una posición de continuación de una clave dividida puede no tener rango;
- fuera de `MANUAL` no se editan directamente;
- `reviewed_by`, `reviewed_at` y `review_notes` son metadatos opcionales y no
  confirman presencia física.

### `book_placements`

Resultado por registro.

Reglas:

- un `book_id` aparece como máximo una vez por corrida;
- el libro pertenece a la carga de la corrida;
- la ubicación pertenece al snapshot;
- registros con la misma clave pueden ocupar varias posiciones consecutivas;
- los registros sin clave y los que no pueden colocarse no tienen fila.

### `location_paths`

Vista existente usada para respuestas administrativas y públicas. La respuesta
pública toma `path` y, si existe, `map_element_id`, pero no expone el árbol editable.

## Datos derivados no persistidos

Las incidencias se calculan al consultar la vista previa:

- **posiciones vacías**: snapshot sin placements;
- **sobrecargas**: asignaciones que superan el objetivo efectivo admitido;
- **claves divididas**: una misma clave con placements en más de una posición;
- **no asignados**: `book_count - cantidad de placements`, consistente con
  `unassigned_count`;
- **diferencias**: comparación de contadores, fronteras y ubicaciones contra otra
  corrida del mismo `scheme`.

No se crea una tabla de incidencias porque todas son proyecciones reproducibles.

## Entradas de comando no persistidas por separado

- Los defaults se guardan en la cabecera al confirmar el comando.
- Los anchors sustituyen el conjunto completo dentro del recálculo.
- Los rangos manuales propuestos viajan en el comando. Solo se guardan en
  `distribution_ranges` si la cobertura es válida y se derivan todos los placements.
- Un fallo de recálculo conserva el último conjunto válido. La interfaz mantiene la
  propuesta fallida para permitir su corrección sin presentarla como resultado.

## Transiciones

### Primer cálculo

```text
creación -> PENDING -> DONE
                    -> ERROR
```

`ERROR` conserva cabecera y diagnóstico, pero ningún resultado parcial.

### Recálculo no publicado

```text
DONE(revisión N) -> PENDING -> DONE(revisión N+1)
                   fallo      -> DONE(revisión N) sin cambios
```

La transición a `PENDING` ocurre dentro de la transacción y no se confirma si falla.
Una corrida inicial `ERROR` también puede recibir un nuevo comando completo; si termina
correctamente pasa a `DONE` e incrementa su revisión. Si vuelve a fallar, conserva
`ERROR`, actualiza el diagnóstico, incrementa su revisión y no deja resultados
parciales. En este caso no existe una vista previa válida que deba restaurarse.

### Publicación

```text
DONE no publicada -> DONE publicada, revisión N+1
DONE publicada anterior -> DONE no publicada, revisión propia +1
scheme objetivo -> DISTRIBUTED y activo
scheme activo anterior -> inactivo
```

Todos los cambios se confirman juntos. Una corrida anterior `DONE` puede volver a
publicarse sin cambiar snapshot ni resultados.

## Migración requerida

La implementación creará un archivo SQL ordenado en `database/migrations/` que:

1. agrega `revision INTEGER NOT NULL DEFAULT 1`;
2. agrega un check positivo con nombre estable;
3. no elimina ni transforma datos;
4. permite reversión eliminando primero el check y luego la columna;
5. actualiza `docs/db.md` en el mismo cambio.

El comando de migración usa `MIGRATION_DATABASE_URL`, correspondiente al propietario
del esquema. La aplicación continúa conectándose mediante `DATABASE_URL` con privilegios
mínimos. La suite aplica la migración a `TEST_DATABASE_URL` antes de integrar.
