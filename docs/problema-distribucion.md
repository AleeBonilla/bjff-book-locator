# Problema de distribución de la colección

## Objetivo

Este documento describe la limitación que impide asignar la colección a la
estructura física mediante bloques de tamaño fijo.

No define el algoritmo completo. Establece el problema, sus consecuencias y las
condiciones que debe respetar cualquier solución.

## Problema

El sistema dispone de:

- una colección ordenada por código de clasificación;
- una secuencia ordenada de ubicaciones físicas con rol `POSITION`.

Debe decidir qué parte de la colección corresponde a cada posición. Una primera
aproximación consiste en dividir los registros en grupos iguales, por ejemplo,
25 registros por anaquel.

Ese reparto presupone que:

1. todos los anaqueles tienen la misma capacidad;
2. todos los libros ocupan el mismo espacio;
3. cada registro del catálogo corresponde a un libro presente físicamente;
4. llenar una posición al máximo es conveniente.

Estas condiciones no se cumplen de forma estable en una biblioteca real.

## Fuentes de variación

### Estructura física

Las posiciones pueden tener dimensiones y restricciones diferentes:

- anaqueles de distinto ancho;
- espacio ocupado por soportes, señalización u otros objetos;
- muebles con formas y jerarquías heterogéneas;
- posiciones deshabilitadas o reservadas.

Dos estructuras creadas con la misma plantilla también pueden contener
cantidades distintas de caras, estanterías o anaqueles.

### Colección

Los registros tampoco consumen espacio de manera uniforme:

- los libros tienen grosores y formatos diferentes;
- varios registros pueden compartir el mismo código de clasificación;
- algunos libros pueden estar prestados, en revisión o temporalmente ausentes;
- el catálogo no confirma la presencia física del ejemplar.

### Operación

Una distribución necesita margen para:

- crecimiento de la colección;
- devoluciones y recolocación;
- correcciones posteriores;
- mantener juntos, cuando sea posible, los registros que comparten un código.

## Limitación del reparto fijo

Dividir la colección en bloques iguales es útil para una demostración, pero no
es una regla válida para producción.

Si una posición admite menos que el bloque establecido, el resultado se
desplaza desde ese punto. El error se acumula en todas las posiciones
posteriores. Si admite más, se desperdicia espacio y también se alteran las
fronteras esperadas.

El tamaño fijo puede utilizarse como valor predeterminado cuando no existe
información mejor, pero no debe estar incorporado como supuesto permanente del
modelo ni del algoritmo.

## Respuesta adoptada

La solución combina estimación algorítmica con conocimiento aportado por el
personal.

### Orden físico

Todas las `POSITION` habilitadas reciben una secuencia global. La distribución
recorre esa secuencia sin depender de que todas las ramas tengan la misma forma
jerárquica.

### Configuración flexible

Cada posición puede obtener:

- una capacidad aproximada en `BOOKS`;
- una medida proporcional en `CENTIMETERS`;
- un peso relativo en `WEIGHT`;
- un `target_fill_ratio`;
- una política `allow_overflow`.

La configuración puede heredarse desde un `CONTAINER` y ajustarse en posiciones
específicas. Así se define una regla general y solo se registran las
excepciones conocidas.

### Límites conocidos

Un anchor registra que una posición comienza en un código conocido. Estos
límites provienen del conocimiento físico y no se mueven para satisfacer una
capacidad estimada.

La estrategia `HYBRID` usa anchors parciales y distribuye algorítmicamente los
segmentos desconocidos.

### Versionado

Cada corrida conserva:

- la colección utilizada;
- las posiciones y su orden;
- la configuración efectiva;
- los anchors;
- los rangos y placements calculados.

Los cambios posteriores generan otra corrida. Una distribución publicada no se
reescribe.

## Alcance de la aproximación

La salida siempre representa una ubicación aproximada.

Un registro individual recibe una sola `POSITION` por corrida. Sin embargo,
varios registros con el mismo código pueden ocupar posiciones consecutivas
cuando el grupo no cabe completo en una sola.

Una coincidencia exacta en el catálogo permite mostrar todas esas posiciones,
pero no confirma que cada ejemplar esté físicamente presente.

## Resoluciones y aspectos pendientes

La especificación 004 cerró los requisitos necesarios para la primera versión:

- admite `BOOKS`, `CENTIMETERS` y `WEIGHT` según el dato disponible;
- trata `capacity_value` como objetivo aproximado o peso, no como límite físico
  certificado;
- redondea hacia abajo los objetivos fraccionarios en `BOOKS`;
- divide un grupo únicamente entre posiciones consecutivas cuando no cabe completo y
  no se permite overflow;
- exige una carga y una corrida nuevas cuando cambia la colección;
- permite publicar con registros sin asignar solo después de advertirlo y obtener una
  confirmación explícita.

Permanecen fuera del alcance inicial y deberán definirse antes de incorporarlos:

- qué revisión física se realizará y quién podrá registrarla;
- cómo se tratarán códigos ubicados intencionalmente en posiciones no consecutivas.

Estos límites no invalidan la separación actual entre estructura, configuración y
resultados.
