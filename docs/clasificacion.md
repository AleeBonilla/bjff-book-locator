# Códigos de clasificación: estructura y orden

## Alcance

Este documento define cómo interpretar, normalizar y ordenar los códigos de
clasificación de la colección BJFF.

El formato combina:

- un número de clase de la Clasificación Decimal Dewey (DDC);
- un segmento Cutter o número de libro;
- elementos locales opcionales: prefijo de país e indicador de edición DDC.

Ejemplo:

```text
CR863 S248m2 23
│ │   │       └─ edición de DDC usada en la catalogación
│ │   └───────── Cutter y marca de obra
│ └───────────── número de clase DDC
└─────────────── prefijo local de país
```

## Número de clase DDC

La DDC usa números arábigos de al menos tres dígitos. El punto se coloca después
del tercer dígito y los dígitos siguientes aumentan la especificidad:

```text
620
620.1
620.106
620.1064
```

El orden se determina por el valor del número de clase. Los dígitos posteriores
al punto se leen de izquierda a derecha como una fracción decimal:

```text
004.0151 < 004.1
658 < 658.001
```

OCLC establece que la DDC no usa números de menos de tres dígitos y que el punto
aparece después del tercero. También define la longitud de la notación como una
expresión de jerarquía.

## Cutter y marca de obra

El Cutter ordena nombres u obras dentro de un mismo número de clase. Su forma
habitual en esta colección es:

```text
S248m2
││  │└─ extensión numérica opcional
││  └── marca de obra
│└───── cifras Cutter
└────── letra o letras iniciales
```

El Cutter se reconoce por su forma —una o varias letras seguidas de al menos un
dígito—, no por su posición. Si el código trae varios segmentos después del número
DDC, el Cutter es el primero que tiene esa forma.

La colección contiene tres variaciones de escritura con una sola lectura posible, que
se normalizan en silencio:

```text
C8374- lge      espacio junto al guion       -> C8374lge
C146 p          marca de obra separada       -> C146p
C659ci C659ci   segmento repetido literal    -> C659ci
```

La comparación se realiza en este orden:

1. letra o letras iniciales, alfabéticamente;
2. cifras Cutter, como fracción decimal;
3. marca de obra y extensiones, de izquierda a derecha.

Ejemplos:

```text
A238 < B415
S248 < S25
H477a11 < H477a12
```

Library of Congress define el Cutter como una letra seguida de cifras y señala
que se lee y ordena como número decimal. La marca de obra y sus extensiones son
convenciones observadas en esta colección; no forman parte del número de clase
DDC.

## Prefijo local de país

Algunos códigos de literatura incluyen un prefijo alfabético antes del número
de clase. Es una convención de la colección, no parte de la DDC.

| Prefijo | País | Prefijo | País |
|---|---|---|---|
| `A` | Argentina | `C` | Colombia |
| `Ch` | Chile | `CR` | Costa Rica |
| `Cu` | Cuba | `ES` | El Salvador |
| `G` | Guatemala | `M` | México |
| `N` | Nicaragua | `P` | Panamá |
| `Pe` | Perú | `U` | Uruguay |
| `V` | Venezuela |  |  |

Los códigos sin prefijo se ordenan primero. Los códigos con prefijo se agrupan
después, por prefijo alfabético y sin distinguir mayúsculas de minúsculas.
Dentro de cada prefijo se aplican las reglas DDC y Cutter.

```text
999 ... < A863 ... < C863 ... < Ch863 ... < CR863 ...
```

`Cu` y `CU` deben tratarse como el mismo prefijo.

## Indicador de edición DDC

Un número separado al final, normalmente `23`, identifica la edición de DDC
utilizada para asignar el número de clase:

```text
658 H477a11 23
```

Es metadato de catalogación y no determina la ubicación. Para ordenar o comparar
puntos de ubicación, debe excluirse:

```text
658 H477a11
658 H477a11 23
```

Ambas formas generan la misma clave de ubicación.

## Normalización

Antes de comparar códigos:

1. recortar espacios al inicio y al final;
2. separar el prefijo, el número DDC, el Cutter y el indicador de edición;
3. unificar mayúsculas y minúsculas para la comparación;
4. ignorar guiones dentro del segmento Cutter;
5. normalizar el prefijo `CU` como `Cu`;
6. retirar el indicador de edición DDC de la clave de ubicación;
7. enviar los códigos vacíos al final.

Los guiones y el uso de mayúsculas varían en el CSV sin modificar la secuencia
observada:

```text
O-686-i = O686i
S492Fs7 = S492fs7
```

No debe usarse el texto original como una clave ASCII directa. La puntuación,
las mayúsculas y los espacios irregulares producirían un orden distinto.

## Orden de comparación

La clave de ubicación se compara por componentes:

1. presencia de prefijo: sin prefijo antes que con prefijo;
2. prefijo de país normalizado;
3. número de clase DDC;
4. letra o letras iniciales del Cutter;
5. cifras Cutter como decimal;
6. marca de obra y extensiones;
7. código original como desempate técnico, si fuera necesario.

Los registros sin código de clasificación no tienen una ubicación calculable y
se colocan al final.

## Valores no canónicos

La colección contiene puntos, comas y espacios adicionales dentro de algunos
números DDC. No forman parte de la notación DDC canónica.

El sistema siempre conserva el valor original. Que además lo señale para revisión
catalográfica depende de si la normalización es determinista:

- si el valor admite **una sola lectura**, se normaliza en silencio;
- si admite **más de una**, se normaliza con la mejor lectura posible y se señala,
  porque hace falta que alguien decida.

La revisión catalográfica es para lo que exige una decisión humana, no para todo lo
que se aparta de la forma canónica.

### Agrupamiento de dígitos

Los números DDC largos se escriben en bloques para poder leerlos. La colección usa
como separador tanto el espacio como el punto:

```text
303.440 972 862 021
303.440.972.862.021
```

Ambas formas son el mismo número, `303.440972862021`. El separador se retira y los
bloques se concatenan. Es determinista: se normaliza en silencio.

Un espacio inmediatamente posterior al punto decimal, sin dígito intermedio, es un
error de captura con una sola lectura posible, y recibe el mismo trato.

```text
613.208.32  -> 613.20832
341.485 2   -> 341.4852
658. 8      -> 658.8
352,85      -> 352.85
```

### Valores que sí exigen revisión

```text
8693.7 M378a     número de clase con más de tres dígitos antes del punto
371.4 M M423t    segmento alfabético que no se explica como Cutter ni marca de obra
```

El primero no tiene lectura única: la DDC sitúa el punto tras el tercer dígito, así
que el valor está mal formado y solo la catalogación puede decidir cuál era. El
segundo tiene un token suelto antes del Cutter que no corresponde a ninguna
convención conocida.

## Fuentes

- [OCLC, Introduction to the Dewey Decimal Classification](https://www.oclc.org/content/dam/oclc/webdewey/help/introduction1.pdf)
- [OCLC, Dewey Decimal Classification glossary](https://help.oclc.org/Librarian_Toolbox/OCLC_glossaries/Dewey_Decimal_Classification_glossary)
- [Library of Congress, Classification and Shelflisting Manual: Glossary](https://www.loc.gov/aba/publications/FreeCSM/glossary.pdf)
- [Library of Congress, Filing Rules, G 100](https://www.loc.gov/aba/publications/FreeCSM/G100.pdf)
- [Library of Congress, preguntas frecuentes del Programa Dewey](https://www.loc.gov/aba/dewey/faq.html)
