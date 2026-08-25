# Ordenamiento de signaturas bibliográficas basadas en DDC

| Propiedad | Valor |
|---|---|
| Estado | Especificación normativa; dos decisiones permanecen bajo validación |
| Versión | 1.0.0 |
| Identificador | `CO` |
| Ámbito | Precedencia y equivalencia de signaturas basadas en DDC |
| Autoridad | Este documento define el orden adoptado; las fuentes de la sección 14 sustentan las reglas bibliográficas |
| Revisar cuando | Cambie una convención institucional, una decisión `CO-OPEN-*` o una fuente normativa aplicable |
| Documentos relacionados | [`normalization.md`](normalization.md), [`comparable_key.md`](comparable_key.md) |

## 1. Propósito y alcance

El sistema ordena signaturas construidas a partir de:

1. un prefijo local opcional;
2. un número de clase de la Clasificación Decimal Dewey (DDC);
3. un Cutter o número de libro opcional;
4. una marca de obra y sus extensiones opcionales;
5. otros componentes reconocidos explícitamente por la institución.

La DDC determina la estructura y el orden del número de clase. Los prefijos, Cutter, marcas de obra y extensiones son convenciones complementarias que pueden depender de la institución. Esta especificación define el orden de signaturas basadas en DDC; no se limita a las reglas oficiales de la DDC.

El análisis del texto de entrada se define en [`normalization.md`](normalization.md). El almacenamiento y la indexación se definen en [`comparable_key.md`](comparable_key.md).

## 2. Lenguaje normativo

Los términos **DEBE**, **NO DEBE**, **DEBERÍA**, **NO DEBERÍA** y **PUEDE** expresan requisitos, recomendaciones y posibilidades de esta especificación.

Cada regla normativa tiene un identificador estable con prefijo `CO-`. Los otros documentos citan estos identificadores para conservar trazabilidad sin duplicar las reglas.

## 3. Estructura conceptual

Una signatura puede representarse conceptualmente así:

```text
[PREFIJO] [DDC] [CUTTER][MARCA_DE_OBRA] [COMPONENTES_ADICIONALES]
```

Ejemplos:

```text
658 H477a11
CR 863 B268-i-2
004.0151 S248
658 H477a11 23
```

El sistema DEBE identificar los componentes antes de compararlos. La signatura completa NO DEBE compararse directamente como una cadena ASCII o según la intercalación predeterminada de una base de datos.

## 4. Precedencia de comparación

**CO-001.** Dos signaturas se comparan, en este orden, por:

1. presencia de prefijo local;
2. valor del prefijo local;
3. número de clase DDC;
4. presencia de Cutter;
5. parte alfabética del Cutter;
6. cifras del Cutter;
7. presencia y contenido de la marca de obra;
8. componentes adicionales reconocidos.

La comparación termina en el primer componente que determina una diferencia.

**CO-002.** Cuando un componente opcional se alcanza después de que todos los componentes anteriores resultaron equivalentes, la ausencia del componente se ordena antes que su presencia.

**CO-003.** Dos signaturas cuyos componentes comparables son equivalentes ocupan la misma posición bibliográfica. Si una interfaz necesita un orden estable entre sus registros, PUEDE aplicar después un desempate externo —por ejemplo, un identificador de registro— que no forma parte de la clave bibliográfica.

## 5. Prefijo local

El prefijo es una convención institucional; no forma parte de la notación DDC.

**CO-010.** Una signatura sin prefijo se ordena antes que cualquier signatura con prefijo, con independencia de sus restantes componentes.

```text
999 ... < A863 ...
```

**CO-011.** Cuando ambas signaturas tienen prefijo, se comparan alfabéticamente, carácter por carácter y sin distinguir mayúsculas de minúsculas.

```text
A863 ... < C863 ... < Ch863 ... < CR863 ...
cr863 ... = CR863 ...
```

**CO-012.** Las equivalencias de letras modificadas o signos diacríticos deben definirse mediante el perfil institucional de normalización. La versión base sigue el alfabeto inglés `A–Z` y las equivalencias documentadas en LC G 100.

## 6. Número de clase DDC

**CO-020.** El número DDC se ordena según su secuencia notacional. Los tres primeros dígitos se comparan como un bloque de anchura fija; los dígitos posteriores al punto se comparan de izquierda a derecha como subdivisiones sucesivas.

```text
004.0151 < 004.1
620 < 620.1
620.1 < 620.106
658 < 658.001
```

El punto que sigue al tercer dígito es una ayuda de lectura, no un punto decimal en sentido matemático. La analogía con una fracción decimal es válida para implementar el orden, pero no redefine la naturaleza de la notación DDC.

**CO-021.** Si una secuencia DDC válida es prefijo notacional de otra, la más corta se ordena primero.

**CO-022.** El número DDC se compara independientemente de los demás componentes. No se debe permitir que espacios, letras o puntuación de otras partes alteren este orden.

## 7. Cutter o número de libro

Estas reglas corresponden a la convención Cutter/LC adoptada por el sistema; no son una regla intrínseca de la DDC.

**CO-030.** El Cutter solo se compara cuando los números DDC son equivalentes.

**CO-031.** La parte alfabética del Cutter se compara primero, alfabéticamente y sin distinguir mayúsculas de minúsculas.

```text
A238 < B415
H477 < S248
```

**CO-032.** Las cifras Cutter se comparan dígito por dígito como una fracción decimal, no como un número entero.

```text
S248 < S25
```

porque `.248 < .25`.

**CO-033.** Cuando la secuencia de cifras de un Cutter es prefijo de otra, la secuencia más corta se ordena primero.

```text
E43 < E434
K19 < K199
```

La marca de obra de la primera signatura no debe compararse hasta haber resuelto por completo el Cutter. Por ello:

```text
E43c < E434h
K19m < K199p
```

## 8. Marca de obra y extensiones

**CO-040.** La marca de obra se compara únicamente cuando DDC y Cutter son equivalentes.

**CO-041.** Su contenido se compara de izquierda a derecha, carácter por carácter y sin distinguir mayúsculas de minúsculas.

```text
C112c < C112l
H477a11 < H477a12
```

**CO-042.** Los segmentos adicionales de una marca de obra se comparan en el orden en que aparecen. Si una secuencia completa de segmentos es prefijo de otra, la más corta se ordena primero.

## 9. Guiones y puntuación en la marca de obra

Estado: regla provisional con reserva bibliográfica.

LC G 100 establece, para entradas de *filing*, que las palabras conectadas por guion se tratan como palabras separadas. También indica que, salvo el ampersand, los símbolos no tienen valor propio de intercalación. La estructura local de una marca como `B268-i-2`, sin embargo, no equivale necesariamente a una expresión ordinaria formada por palabras.

**CO-050.** En el perfil provisional, el guion no posee valor de orden propio, pero conserva una frontera lógica entre los segmentos que delimita.

**CO-051.** El sistema NO DEBE eliminar el guion y concatenar automáticamente sus lados. En particular, esta especificación no declara equivalentes las formas siguientes:

```text
B268-i-2
B268i2
B268 i 2
```

**CO-052.** Mientras la convención institucional no se valide de forma definitiva, los segmentos separados por guion se comparan como una secuencia: cada segmento se compara carácter por carácter y una frontera de segmento se ordena antes que la continuación alfanumérica del mismo segmento.

La regla preserva la información y puede sustituirse en una versión posterior sin modificar las reglas DDC o Cutter.

## 10. Indicador de edición DDC

Estado: identificación pendiente de validación en los datos de origen.

**CO-060.** Un número situado al final de una signatura NO DEBE interpretarse automáticamente como indicador de edición DDC.

```text
658 H477a11 23
```

La forma por sí sola no demuestra que `23` signifique «DDC 23»; también podría representar volumen, parte, año u otro dato local.

**CO-061.** Un valor PUEDE excluirse del orden físico únicamente cuando una fuente estructurada o una regla de origen inequívoca lo identifica como metadato de edición DDC.

En ese caso, y solo en ese caso:

```text
658 H477a11
658 H477a11 23
```

pueden ocupar la misma posición bibliográfica.

**CO-062.** Un sufijo no identificado se conserva como componente adicional y participa en la comparación después de la marca de obra.

## 11. Componentes adicionales

**CO-070.** Todo componente adicional que participe en el orden debe estar reconocido por un perfil institucional y tener reglas deterministas de comparación.

**CO-071.** En el perfil conservador, un sufijo no clasificado se compara después de la marca de obra, por segmentos y de izquierda a derecha. No se le atribuye significado bibliográfico por inferencia.

**CO-072.** Una entrada que no pueda segmentarse sin ambigüedad no debe recibir silenciosamente una interpretación inventada. Debe marcarse como ambigua o inválida según [`normalization.md`](normalization.md).

## 12. Casos normativos de referencia

| ID | Relación esperada | Regla principal |
|---|---|---|
| `CO-T01` | `004.0151 < 004.1` | `CO-020` |
| `CO-T02` | `620 < 620.1` | `CO-021` |
| `CO-T03` | `620.1 < 620.106` | `CO-021` |
| `CO-T04` | `658 < 658.001` | `CO-020` |
| `CO-T05` | `A238 < B415` | `CO-031` |
| `CO-T06` | `S248 < S25` | `CO-032` |
| `CO-T07` | `E43c < E434h` | `CO-033` |
| `CO-T08` | `K19m < K199p` | `CO-033` |
| `CO-T09` | `H477a11 < H477a12` | `CO-041` |
| `CO-T10` | `999 ... < A863 ...` | `CO-010` |
| `CO-T11` | `A863 ... < C863 ... < Ch863 ... < CR863 ...` | `CO-011` |
| `CO-T12` | `cr863 ... = CR863 ...` | `CO-011` |

Los casos con guiones y posibles indicadores de edición están sujetos a las reservas de las secciones 9 y 10.

## 13. Decisiones abiertas

| ID | Decisión pendiente | Impacto |
|---|---|---|
| `CO-OPEN-01` | Confirmar si la institución desea tratar el guion de la marca de obra como frontera, eliminarlo o aplicar otra convención local. | Normalización de marca de obra y versión de clave comparable. |
| `CO-OPEN-02` | Identificar qué fuentes o campos garantizan que un sufijo representa una edición DDC. | Exclusión segura de ese dato del orden físico. |

Resolver una decisión abierta exige una nueva versión de esta especificación, casos de regresión y, si cambia el orden, una nueva versión de la clave comparable.

## 14. Fuentes de referencia

- [OCLC — *Introduction to the Dewey Decimal Classification*](https://www.oclc.org/content/dam/oclc/webdewey/help/introduction1.pdf): estructura y jerarquía notacional de DDC; en especial, §§ 4.15–4.19.
- [Library of Congress — *Classification and Shelflisting Manual*, G 063: Cutter Numbers](https://www.loc.gov/aba/publications/FreeCSM/G063.pdf): uso y tratamiento decimal de los Cutter.
- [Library of Congress — *Classification and Shelflisting Manual*, G 100: Filing Rules](https://www.loc.gov/aba/publications/FreeCSM/G100.pdf): alfabeto, caracteres modificados, guiones, símbolos y reglas generales de *filing*.
- [Library of Congress — MARC 21, campo 082](https://www.loc.gov/marc/bibliographic/bd082.html): representación estructurada del número DDC y su edición.
- [Yale University Library — *Shelflisting Introduction*, sección «Class & cutter number»](https://web.library.yale.edu/book/export/html/817): referencia práctica complementaria sobre orden de clase y Cutter.

## 15. Conformidad

Una implementación es conforme con `CO` 1.0.0 si:

1. reproduce todos los casos no abiertos de la sección 12;
2. no infiere una edición DDC desde un sufijo no estructurado;
3. no colapsa silenciosamente fronteras marcadas por guiones;
4. separa el desempate técnico de la equivalencia bibliográfica;
5. puede vincular cada decisión de normalización y codificación con una regla `CO-`.
