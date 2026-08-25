# Clave comparable para persistencia, indexación y consultas

| Propiedad | Valor |
|---|---|
| Estado | Especificación técnica de diseño; sin implementación en este repositorio |
| Versión | 1.0.0 |
| Identificador | `CK` |
| Ámbito | Codificación binaria `ck1`, persistencia, orden y consultas por rango |
| Autoridad | Este documento, limitado por `CO` 1.0.0 y el perfil `base-1` de `NORM` |
| Revisar cuando | Cambie la precedencia, la normalización, el repertorio de bytes o la política de componentes adicionales |
| Fuente normativa del orden | [`classification-ordering.md`](classification-ordering.md) 1.0.0 |
| Entrada requerida | [`normalization.md`](normalization.md), perfil `base-1` |

## 1. Propósito y alcance

La codificación transforma una representación normalizada en una clave binaria para:

- índices B-tree;
- operaciones `ORDER BY`;
- paginación por cursor;
- búsquedas por rango y por prefijo lógico;
- comparación sin volver a analizar la signatura original.

La clave comparable es un artefacto derivado. No sustituye la signatura original ni la representación normalizada.

## 2. Propiedad fundamental

Para dos representaciones válidas `A` y `B`, generadas con las mismas versiones de reglas y perfiles:

```text
compare_bibliographic(A, B) < 0
              ⇔
compare_unsigned_bytes(key(A), key(B)) < 0
```

**CK-001.** La comparación de claves debe ser binaria, byte a byte y con bytes interpretados sin signo. No debe depender de la configuración regional, de una *collation* textual ni de la codificación de la signatura original.

**CK-002.** Solo se genera una clave para una representación con `status = "ok"` (`NORM-001`).

**CK-003.** Una misma representación, perfil y versión debe producir siempre los mismos bytes.

## 3. Decisiones de diseño

La codificación `ck1` usa cinco campos en la misma precedencia que `CO-001`:

1. prefijo;
2. DDC;
3. Cutter;
4. marca de obra;
5. componentes adicionales.

La edición DDC estructurada no se codifica porque no participa en el orden físico (`CO-061`). Un sufijo no identificado sí aparece en los componentes adicionales (`CO-062`).

La versión de clave no se antepone a los bytes comparables: su prefijo dominaría el orden bibliográfico si una columna mezclara versiones. La versión se guarda en un campo independiente y las claves de versiones distintas nunca se comparan entre sí.

## 4. Alfabeto y bytes reservados

Los valores normalizados por `base-1` usan bytes ASCII alfanuméricos:

```text
0–9 = 0x30–0x39
A–Z = 0x41–0x5A
```

Se reservan:

| Byte | Uso |
|---|---|
| `0x00` | ausencia, fin de cadena o fin de lista, según el contexto |
| `0x01` | presencia de un componente opcional |

Como todos los bytes de contenido son mayores que `0x01`, un terminador se ordena antes que cualquier continuación válida. Esta propiedad hace que una secuencia corta se ordene antes que su extensión.

## 5. Codificación `ck1`

En el pseudocódigo, `ASCII(x)` representa los bytes ASCII de una cadena canónica y `||` representa concatenación.

### 5.1 Texto terminado

```text
TEXT(x) = ASCII(x) || 0x00
```

Esto conserva el orden lexicográfico de las unidades canónicas y ordena una cadena prefijo antes que su extensión:

```text
TEXT("C") < TEXT("CH") < TEXT("CR")
```

### 5.2 Componente opcional

```text
OPTIONAL_NONE       = 0x00
OPTIONAL_SOME(body) = 0x01 || body
```

Así, ausencia `<` presencia (`CO-002`).

### 5.3 Prefijo

```text
PREFIX(null) = 0x00
PREFIX(p)    = 0x01 || TEXT(p)
```

### 5.4 DDC

```text
DDC(d) = ASCII(d.class_digits) || 0x00
      || ASCII(d.fractional_digits) || 0x00
```

`class_digits` siempre ocupa tres bytes. La parte fraccionaria vacía termina inmediatamente, por lo que `620 < 620.1`. La comparación dígito a dígito también produce `004.0151 < 004.1` y `620.1 < 620.106` (`CO-020`, `CO-021`).

### 5.5 Cutter

```text
CUTTER(null) = 0x00
CUTTER(c)    = 0x01 || TEXT(c.letters) || TEXT(c.digits)
```

La secuencia de cifras se mantiene como texto canónico, no como entero. Esto produce:

```text
"248" < "25"
"43"  < "434"
```

y, por tanto, `S248 < S25` y `E43 < E434` (`CO-032`, `CO-033`).

### 5.6 Lista de segmentos

```text
SEGMENT_LIST(null or []) = 0x00
SEGMENT_LIST(items)      = 0x01
                         || TEXT(items[0])
                         || ...
                         || TEXT(items[n-1])
                         || 0x00
```

El `0x00` adicional marca el final de la lista. Una frontera de segmento se ordena antes que la continuación alfanumérica del segmento, conforme a la regla provisional `CO-052`.

La marca de obra se codifica directamente como una lista de segmentos:

```text
WORKMARK(w) = SEGMENT_LIST(w.segments)
```

### 5.7 Componentes adicionales

Cada componente adicional debe haber sido convertido por el perfil a una cadena canónica que incluya cualquier discriminador de tipo necesario. El perfil `base-1` usa `U` para un componente no clasificado:

```text
{ "kind": "unclassified", "value": "23" }: "U23"
```

Después:

```text
ADDITIONAL(a) = SEGMENT_LIST(canonicalize_each(a))
```

Un perfil que agregue tipos debe asignar sus discriminadores en el orden normativo deseado y versionar tanto la normalización como la clave.

### 5.8 Clave completa

```text
CK1(n) = PREFIX(n.prefix)
      || DDC(n.ddc)
      || CUTTER(n.cutter)
      || WORKMARK(n.workmark)
      || ADDITIONAL(n.additional_components)
```

## 6. Ejemplo de codificación

Para:

```text
CR 658.001 H477a11
```

la representación relevante es:

```json
{
  "prefix": "CR",
  "ddc": { "class_digits": "658", "fractional_digits": "001" },
  "cutter": { "letters": "H", "digits": "477" },
  "workmark": { "segments": ["A11"] },
  "additional_components": []
}
```

La clave `ck1` en hexadecimal, con espacios explicativos, es:

```text
01 43 52 00                         # prefijo CR
36 35 38 00 30 30 31 00            # DDC 658.001
01 48 00 34 37 37 00                # Cutter H477
01 41 31 31 00 00                   # marca [A11]
00                                  # sin componentes adicionales
```

Los comentarios y espacios no forman parte de la clave almacenada.

## 7. Justificación de preservación del orden

| Regla | Mecanismo de `ck1` |
|---|---|
| Sin prefijo antes que con prefijo | `0x00 < 0x01` en el primer campo. |
| Prefijos alfabéticos y prefijo corto primero | ASCII canónico seguido por terminador bajo. |
| DDC de tres dígitos | Bloque fijo de tres bytes. |
| Subdivisiones DDC | Dígitos en orden y terminador antes de una extensión. |
| Cutter: letras antes que cifras | Campos separados en esa precedencia. |
| Cifras Cutter como fracción | Secuencia de dígitos sin conversión entera. |
| Marca después del Cutter | Posición del campo en la concatenación. |
| Fronteras de guion conservadas | Terminador de segmento antes de una continuación alfanumérica. |
| Ausencia antes que presencia | Marcadores `0x00` y `0x01`. |

La preservación del orden depende del repertorio `base-1`. Incluir UTF-8 arbitrario sin una tabla de unidades de orden invalidaría la demostración.

## 8. Persistencia recomendada

La persistencia separa:

| Dato | Finalidad |
|---|---|
| `call_number_raw` | Entrada original, auditoría y presentación. |
| `call_number_normalized` | Componentes semánticos y diagnóstico. |
| `comparable_key` | Orden e índices. |
| `comparable_key_version` | Compatibilidad y migraciones. |
| `normalization_profile` | Reproducibilidad. |

**CK-020.** `comparable_key` debe utilizar un tipo binario (`BYTEA`, `VARBINARY`, `BLOB` o equivalente), no un texto sujeto a *collation*.

**CK-021.** La clave es derivada y debe poder regenerarse desde la representación normalizada. La aplicación no debe aceptar bytes arbitrarios proporcionados por clientes como autoridad.

**CK-022.** La escritura de la representación normalizada, la versión y la clave debe ser atómica para evitar combinaciones incoherentes.

### Ejemplo ilustrativo en PostgreSQL

```sql
CREATE TABLE holdings (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    call_number_raw         text NOT NULL,
    call_number_normalized  jsonb NOT NULL,
    normalization_profile   text NOT NULL,
    comparable_key_version  smallint NOT NULL,
    comparable_key          bytea NOT NULL,
    CHECK (comparable_key_version = 1)
);

CREATE INDEX holdings_comparable_key_idx
    ON holdings (comparable_key, id);
```

El `id` ofrece un desempate estable para registros bibliográficamente equivalentes sin modificar `comparable_key` (`CO-003`).

## 9. `ORDER BY` y paginación

Orden básico:

```sql
SELECT *
FROM holdings
WHERE comparable_key_version = 1
ORDER BY comparable_key, id;
```

Paginación por cursor, usando la última pareja vista:

```sql
SELECT *
FROM holdings
WHERE comparable_key_version = 1
  AND (comparable_key, id) > (:last_key, :last_id)
ORDER BY comparable_key, id
LIMIT :page_size;
```

La sintaxis de comparación por tupla depende del motor; cuando no exista, debe expandirse a una condición equivalente.

## 10. Búsquedas por rango

Una búsqueda por prefijo binario usa un intervalo semiabierto:

```text
[logical_prefix, byte_successor(logical_prefix))
```

`byte_successor` incrementa el último byte distinto de `0xFF` y elimina todo lo que le siga. Si no existe tal byte, el límite superior es abierto.

```sql
SELECT *
FROM holdings
WHERE comparable_key >= :lower_bound
  AND comparable_key <  :upper_bound
ORDER BY comparable_key, id;
```

**CK-030.** Los límites deben construirse mediante el mismo codificador `ck1`; no se deben fabricar concatenando texto SQL.

**CK-031.** Debido a que el prefijo local precede al DDC, «todos los números bajo 658 sin importar el prefijo» no constituye un único intervalo contiguo en esta clave. Debe consultarse un intervalo por prefijo o crearse un índice secundario cuya precedencia sea DDC-primer campo.

**CK-032.** Un rango de descendientes DDC sí es contiguo dentro de un prefijo local fijo y debe acotarse usando el prefijo binario producido hasta la secuencia DDC correspondiente.

## 11. Versionado y migraciones

Debe crearse una nueva versión de clave cuando cambie cualquiera de estos elementos:

- precedencia o equivalencia de `classification-ordering.md`;
- segmentación o plegado de caracteres de `normalization.md`;
- repertorio de bytes o formato de `ck1`;
- política provisional de guiones;
- participación de componentes adicionales.

**CK-040.** Claves de versiones distintas no se comparan ni comparten un índice de orden activo.

Procedimiento de migración:

1. añadir `comparable_key_v2` y su versión, sin reemplazar aún `v1`;
2. regenerar por lotes desde la representación normalizada;
3. verificar propiedades y casos de regresión;
4. crear el índice nuevo;
5. cambiar lecturas y escrituras de forma coordinada;
6. retirar `v1` únicamente después del periodo de reversión acordado.

## 12. Validación y pruebas

### 12.1 Casos obligatorios

El codificador debe reproducir todos los casos `CO-T01`–`CO-T12` aplicables y, además:

```text
key("B268-i-2") ≠ key("B268i2")
```

Una edición DDC identificada estructuralmente no cambia la clave; un `23` final no identificado sí la cambia al convertirse en componente adicional.

### 12.2 Pruebas de propiedades

Para un corpus representativo, se debe verificar:

1. **determinismo:** `key(n) = key(n)` entre ejecuciones;
2. **orden preservado:** el signo de la comparación semántica coincide con el signo de la comparación binaria;
3. **antisimetría:** si `key(A) < key(B)`, entonces no `key(B) < key(A)`;
4. **transitividad:** `A < B` y `B < C` implican `A < C`;
5. **equivalencia:** variantes normalizadas como mayúsculas/minúsculas producen la misma clave;
6. **separación de versiones:** ninguna consulta activa mezcla versiones;
7. **round-trip diagnóstico:** cada clave puede asociarse inequívocamente con la representación y versión que la generaron, aunque la clave no necesite ser reversible por sí sola.

## 13. Trazabilidad

| Requisito de clave | Dependencia |
|---|---|
| `CK-001` | `CO-001`–`CO-003` |
| Codificación de prefijo | `CO-010`–`CO-012`; `NORM-011`, `NORM-021`–`NORM-023` |
| Codificación DDC | `CO-020`–`CO-022`; `NORM-012` |
| Codificación Cutter | `CO-030`–`CO-033`; `NORM-013`, `NORM-040`–`NORM-041` |
| Codificación de marca | `CO-040`–`CO-052`; `NORM-014`, `NORM-050`–`NORM-053` |
| Edición y adicionales | `CO-060`–`CO-071`; `NORM-015`, `NORM-016`, `NORM-060`–`NORM-062` |
| Regeneración y versión | `NORM-002`, decisiones abiertas `CO-OPEN-01` y `CO-OPEN-02` |

## 14. Criterios de conformidad

Una implementación es conforme con `CK` 1.0.0 si:

1. implementa exactamente la codificación `ck1` para el perfil `base-1`;
2. compara y almacena la clave como bytes sin signo;
3. demuestra la propiedad fundamental con los casos normativos y pruebas de propiedades;
4. rechaza representaciones ambiguas o inválidas;
5. no mezcla versiones en operaciones de orden o rango;
6. mantiene la clave como dato derivado y regenerable.
