# Parsing y representación normalizada de signaturas basadas en DDC

| Propiedad | Valor |
|---|---|
| Estado | Especificación técnica implementada en [`packages/call-number`](../packages/call-number) |
| Versión | 1.0.0 |
| Identificador | `NORM` |
| Ámbito | Parsing y representación normalizada del perfil `base-1` |
| Autoridad | Este documento, limitado por las reglas `CO-*` vigentes |
| Revisar cuando | Cambie la gramática, el plegado de caracteres, el origen de metadatos o una regla `CO-*` relacionada |
| Fuente normativa del orden | [`classification-ordering.md`](classification-ordering.md) 1.0.0 |
| Consumidor principal | [`comparable_key.md`](comparable_key.md) |

## 1. Propósito y límites

El normalizador interpreta una signatura textual y la representa mediante componentes normalizados. El resultado conserva significado y fronteras lógicas; no es una clave de base de datos.

Quedan fuera de alcance:

- reglas bibliográficas de precedencia, definidas en [`classification-ordering.md`](classification-ordering.md);
- persistencia, tipos de columna, índices, `ORDER BY` y rangos, definidos en [`comparable_key.md`](comparable_key.md);
- inferencias bibliográficas basadas únicamente en la apariencia de un sufijo.

## 2. Contrato de entrada y salida

El normalizador recibe:

1. la signatura textual;
2. un `normalization_profile` institucional;
3. metadatos estructurados opcionales, como una edición DDC identificada por el sistema de origen.

Devuelve:

- una representación normalizada;
- un estado `ok`, `ambiguous` o `invalid`;
- una lista ordenada de incidencias y advertencias.

**NORM-001.** Solo una salida con estado `ok` puede convertirse directamente en una clave comparable.

**NORM-002.** El proceso debe ser determinista e idempotente: normalizar dos veces la misma representación no cambia sus componentes.

**NORM-003.** La normalización no debe atribuir significado a información no identificada por la gramática o por metadatos confiables.

## 3. Modelo normalizado

La versión 1 usa el siguiente modelo lógico. La sintaxis JSON es ilustrativa; no impone un lenguaje de programación ni un formato de persistencia.

```json
{
  "schema_version": 1,
  "normalization_profile": "base-1",
  "status": "ok",
  "prefix": "CR",
  "ddc": {
    "class_digits": "863",
    "fractional_digits": "",
    "canonical": "863"
  },
  "cutter": {
    "letters": "B",
    "digits": "268"
  },
  "workmark": {
    "segments": ["I", "2"]
  },
  "ddc_edition": null,
  "additional_components": [],
  "issues": []
}
```

### 3.1 Invariantes del modelo

**NORM-010.** `schema_version` identifica la forma del modelo, no la versión de la clave comparable.

**NORM-011.** `prefix` es `null` o una cadena canónica no vacía.

**NORM-012.** `ddc.class_digits` contiene exactamente tres dígitos. `ddc.fractional_digits` contiene cero o más dígitos sin el punto. `ddc.canonical` se deriva de ambos valores y no constituye una fuente independiente.

**NORM-013.** `cutter` es `null` o contiene letras canónicas seguidas por una secuencia no vacía de dígitos. Los ceros no se agregan ni eliminan.

**NORM-014.** `workmark` es `null` o contiene una lista no vacía de segmentos alfanuméricos canónicos. Las fronteras creadas por guiones se conservan como fronteras entre elementos de `segments`.

**NORM-015.** `ddc_edition` solo se completa con metadatos estructurados o una garantía inequívoca del sistema de origen; nunca se infiere de un número final aislado (`CO-060`, `CO-061`).

**NORM-016.** `additional_components` conserva, en orden, cualquier sufijo reconocido por el perfil o retenido conservadoramente sin interpretación bibliográfica.

## 4. Perfil base de caracteres

**NORM-020.** Antes del parsing se eliminan únicamente espacios exteriores y se normalizan los saltos y secuencias de espacio horizontal a un separador lógico. No se eliminan signos dentro de un componente.

**NORM-021.** Las letras se comparan sin distinción de mayúsculas y minúsculas; por ello, prefijo, Cutter y marca de obra se expresan en mayúsculas canónicas.

**NORM-022.** El perfil `base-1` utiliza unidades de orden `A–Z` y `0–9`. Las letras latinas modificadas se pliegan a sus equivalentes del alfabeto inglés conforme a LC G 100. Las equivalencias no triviales deben estar en una tabla versionada; como mínimo:

```text
Æ: AE    Œ: OE    Þ: TH    Ð/ð: D    ı: I
```

Los signos diacríticos de letras latinas reconocibles no generan una unidad de orden adicional. Un carácter sin equivalencia definida produce `UNSUPPORTED_CHARACTER` y estado `invalid`, salvo que un perfil institucional lo contemple explícitamente.

**NORM-023.** El proceso de plegado de caracteres se aplica después de segmentar. No puede borrar una frontera lógica ni convertir dos componentes en uno.

## 5. Gramática del perfil `base-1`

La gramática reconoce esta estructura:

```text
[PREFIX] DDD[.DIGITS] [CUTTER_LETTERS CUTTER_DIGITS [WORKMARK]] [TAIL...]
```

Se permiten tanto el prefijo separado como el prefijo adyacente al número DDC:

```text
CR 863 B268-i-2
CR863 B268-i-2
```

### 5.1 Detección de prefijo y DDC

**NORM-030.** El primer componente principal debe contener un número DDC de tres dígitos, con una parte fraccionaria opcional. Las formas aceptadas son:

```text
863
004.0151
CR863
CR 863
```

**NORM-031.** Solo las letras situadas inmediatamente antes del DDC, dentro del primer componente o en el componente alfabético inmediatamente anterior, se interpretan como prefijo.

**NORM-032.** El punto se admite únicamente después de los tres dígitos iniciales y debe ir seguido por al menos un dígito.

**NORM-033.** La DDC indica que un número no debería terminar en `0` a la derecha del punto. En modo estricto, esa entrada es `invalid`; un perfil de importación puede conservarla con `NONCANONICAL_DDC_TRAILING_ZERO`, sin retirar el cero ni declarar equivalencia automática con una forma más corta.

### 5.2 Detección de Cutter

**NORM-040.** Después del DDC, un componente que comience por una o más letras y continúe con uno o más dígitos se interpreta como Cutter.

```text
H477
B268-i-2
H477a11
```

En los dos últimos casos, el Cutter principal termina al finalizar la primera secuencia de dígitos: `B` + `268` y `H` + `477`. El resto pertenece a la marca de obra.

**NORM-041.** Las cifras Cutter se conservan como cadena. No se convierten a entero ni a número de punto flotante (`CO-032`, `CO-033`).

### 5.3 Detección de marca de obra

**NORM-050.** El contenido adyacente que sigue a las cifras Cutter se interpreta como marca de obra.

```text
H477a11:  ["A11"]
C112-l:   ["L"]
B268-i-2: ["I", "2"]
```

**NORM-051.** Un guion inicial entre Cutter y marca es notación de separación y no crea un segmento vacío. Los guiones internos crean fronteras entre segmentos (`CO-050`–`CO-052`).

**NORM-052.** Las fronteras no se colapsan:

```text
B268-i-2: ["I", "2"]
B268i2:   ["I2"]
```

son representaciones distintas.

**NORM-053.** Una marca separada del Cutter por espacios no se fusiona automáticamente. Si el perfil de origen no define esa forma, se conserva en `additional_components` y se emite `DETACHED_SUFFIX`, o se marca `ambiguous` cuando existan varias interpretaciones plausibles.

### 5.4 Sufijos y edición DDC

**NORM-060.** Un componente final numérico no se interpreta como edición DDC por su forma.

```text
658 H477a11 23
```

Sin metadatos adicionales, se normaliza como:

```json
{
  "ddc_edition": null,
  "additional_components": [
    { "kind": "unclassified", "value": "23" }
  ]
}
```

**NORM-061.** Si el sistema de origen proporciona de manera estructurada `ddc_edition = "23"`, ese valor se registra en el campo correspondiente y no se duplica en `additional_components`.

**NORM-062.** Si el texto incluye `23` y los metadatos también declaran edición `23`, el perfil de origen debe indicar si el texto es una proyección redundante de ese metadato. Sin esa garantía, el resultado es `ambiguous`; no se descarta el texto silenciosamente.

## 6. Estados e incidencias

| Estado | Significado | Puede generar clave comparable |
|---|---|---|
| `ok` | Todos los componentes tienen una interpretación única bajo el perfil. | Sí |
| `ambiguous` | Existen dos o más interpretaciones plausibles o falta una garantía de origen. | No, salvo resolución explícita |
| `invalid` | La entrada viola la gramática o contiene caracteres no admitidos. | No |

Incidencias mínimas:

| Código | Estado habitual | Descripción |
|---|---|---|
| `EMPTY_INPUT` | `invalid` | No hay contenido útil. |
| `MISSING_DDC` | `invalid` | No se localizó un DDC de tres dígitos. |
| `INVALID_DDC_SYNTAX` | `invalid` | Punto o dígitos en posición no válida. |
| `NONCANONICAL_DDC_TRAILING_ZERO` | Según perfil | El número termina en cero después del punto. |
| `INVALID_CUTTER` | `invalid` | Un candidato a Cutter no tiene letras o cifras válidas. |
| `EMPTY_WORKMARK_SEGMENT` | `invalid` | Hay guiones repetidos o una frontera sin contenido. |
| `DETACHED_SUFFIX` | Advertencia | El sufijo no se fusionó con la marca de obra. |
| `UNIDENTIFIED_TRAILING_NUMBER` | Advertencia | Se conservó un número final sin inferir edición DDC. |
| `UNSUPPORTED_CHARACTER` | `invalid` | El perfil no define una equivalencia de carácter. |
| `CONFLICTING_SOURCE_METADATA` | `ambiguous` | Texto y metadatos estructurados no concuerdan. |

## 7. Ejemplos completos

### 7.1 Signatura sin prefijo

Entrada:

```text
658 H477a11
```

Salida abreviada:

```json
{
  "prefix": null,
  "ddc": { "class_digits": "658", "fractional_digits": "", "canonical": "658" },
  "cutter": { "letters": "H", "digits": "477" },
  "workmark": { "segments": ["A11"] },
  "ddc_edition": null,
  "additional_components": [],
  "status": "ok"
}
```

### 7.2 Prefijo y guiones

Entrada:

```text
CR 863 B268-i-2
```

Salida abreviada:

```json
{
  "prefix": "CR",
  "ddc": { "class_digits": "863", "fractional_digits": "", "canonical": "863" },
  "cutter": { "letters": "B", "digits": "268" },
  "workmark": { "segments": ["I", "2"] },
  "ddc_edition": null,
  "additional_components": [],
  "status": "ok"
}
```

### 7.3 Sufijo no identificado

Entrada:

```text
658 H477a11 23
```

Salida abreviada:

```json
{
  "cutter": { "letters": "H", "digits": "477" },
  "workmark": { "segments": ["A11"] },
  "ddc_edition": null,
  "additional_components": [{ "kind": "unclassified", "value": "23" }],
  "issues": [{ "code": "UNIDENTIFIED_TRAILING_NUMBER" }],
  "status": "ok"
}
```

## 8. Trazabilidad

| Requisito de normalización | Regla bibliográfica de origen |
|---|---|
| `NORM-021`, `NORM-022` | `CO-011`, `CO-012`, `CO-031`, `CO-041` |
| `NORM-032`, `NORM-033` | `CO-020`, `CO-021` |
| `NORM-040`, `NORM-041` | `CO-030`–`CO-033` |
| `NORM-050`–`NORM-053` | `CO-040`–`CO-052` |
| `NORM-060`–`NORM-062` | `CO-060`–`CO-062` |

## 9. Pruebas de conformidad

El normalizador debe incluir, como mínimo:

1. un caso por ejemplo de la sección 7;
2. variantes de espacios y capitalización que produzcan la misma representación;
3. casos que demuestren que `B268-i-2` y `B268i2` conservan estructuras distintas;
4. un sufijo `23` con y sin metadato estructurado de edición;
5. cada código de incidencia de la sección 6;
6. una prueba de idempotencia por cada forma válida;
7. límites de tamaño definidos por la implementación para evitar entradas patológicas.

Una modificación de gramática, plegado de caracteres o segmentación requiere una nueva versión de `normalization_profile` y una evaluación de impacto sobre [`comparable_key.md`](comparable_key.md).
