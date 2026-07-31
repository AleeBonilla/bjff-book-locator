# Especificación: Carga administrativa inicial de la colección

**Feature Branch**: `001-collection-import`

**Created**: 2026-07-30

**Status**: Draft

**Input**: Permitir que una persona administradora autorizada inicie sesión, importe
una colección desde un CSV compatible y obtenga un resultado verificable de la carga,
con los registros válidos preparados para futuras distribuciones.

## Contexto y fuentes

Esta especificación desarrolla la etapa 5 de [`docs/flujo.md`](../../docs/flujo.md)
y se apoya en:

- [`docs/clasificacion.md`](../../docs/clasificacion.md) — reglas normativas de
  interpretación, normalización y orden de los códigos de clasificación;
- [`docs/decisiones.md`](../../docs/decisiones.md) — decisiones 24, 25 y 27;
- [`docs/db.md`](../../docs/db.md) — modelo de persistencia y sus garantías.

Los escenarios reproducibles usan `bjff-collection-example.csv`, el único archivo
de colección publicable. `bjff-collection.csv` y `docs/dataset.md` son material
privado de la BJFF: no se consultaron para redactar esta especificación y ningún
dato real aparece en ella.

## Clarifications

### Session 2026-07-30

- Q: ¿Cómo experimenta la persona administradora una importación de 10 000 filas? → A:
  Síncrona; recibe el resultado en la misma acción. El objetivo de SC-006 se ajustó a
  30 segundos para que la espera sea razonable.
- Q: ¿Cómo sale el sistema de una carga que quedó en `PENDING` porque su procesamiento
  se interrumpió? → A: No necesita salir. Ninguna carga bloquea a otra y solo `DONE`
  expone registros, así que una `PENDING` huérfana es inerte.
- Q: ¿Debe marcarse para revisión el agrupamiento Dewey por bloques de dígitos? → A:
  No. Revisado el catálogo real, el mismo código aparece agrupado con espacios y con
  puntos, así que ambas formas son notación válida y no un error. El criterio pasa a
  ser el de FR-017a: se marca lo que admite más de una lectura, no lo que se aparta de
  la forma canónica. De 33 filas marcadas quedan 2.
- Q: ¿Basta con mostrar la fila y el motivo de cada problema? → A: No; hace falta el
  código de clasificación original, porque sin él no se entiende qué corregir.
- Q: ¿Puede la persona administradora eliminar u ocultar una carga de colección en esta
  funcionalidad? → A: No; las cargas se conservan como historial.
- Q: ¿Qué debe dejar registrado el sistema sobre una importación que corre sin
  supervisión? → A: Inicio, fin y resultado, correlacionables por carga.
- Q: ¿Debe el sistema acotar el tamaño del archivo que acepta para importar? → A: Sí,
  límite configurable de tamaño y de filas, rechazado antes de procesar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso administrativo autenticado (Priority: P1)

Una persona administradora abre el panel, se identifica con sus credenciales y
obtiene acceso a las funciones de administración. Al terminar, cierra la sesión y
deja de tener acceso.

**Why this priority**: ninguna otra función de esta especificación es alcanzable sin
una sesión válida. Es la puerta de entrada y el límite entre lo público y lo
administrativo.

**Independent Test**: se verifica en su totalidad iniciando sesión con credenciales
válidas, comprobando el acceso al panel, cerrando la sesión y comprobando que el
acceso se pierde. No requiere ninguna importación.

**Acceptance Scenarios**:

1. **Given** una cuenta ADMIN habilitada, **When** la persona envía credenciales
   correctas, **Then** obtiene una sesión activa y accede al panel administrativo.
2. **Given** una cuenta ADMIN habilitada, **When** la persona envía credenciales
   incorrectas, **Then** el acceso se rechaza con un mensaje que no revela si el
   error estuvo en el identificador o en la contraseña.
3. **Given** una cuenta deshabilitada, **When** la persona envía credenciales
   correctas, **Then** el acceso se rechaza.
4. **Given** una sesión activa, **When** la persona cierra la sesión, **Then** la
   sesión queda invalidada y las funciones administrativas dejan de ser accesibles.
5. **Given** ninguna sesión activa, **When** se intenta acceder a cualquier función
   administrativa, **Then** el acceso se rechaza sin exponer datos de la colección.
6. **Given** un acceso exitoso, **When** finaliza la autenticación, **Then** se
   registra el instante del último acceso de esa cuenta.

---

### User Story 2 - Importar una colección desde un CSV compatible (Priority: P1)

Una persona autenticada selecciona un archivo CSV de colección y solicita su
importación. El sistema procesa el archivo como una unidad y deja una carga con un
estado final y sus registros disponibles para futuras distribuciones.

**Why this priority**: es el objetivo de la funcionalidad. Con las historias 1 y 2 el
sistema ya cumple su propósito mínimo: existe una colección importada y verificable.

**Independent Test**: se verifica importando `bjff-collection-example.csv` y
comprobando que la carga termina en `DONE`, que existen 47 registros asociados y que
cada uno conserva su código original y su número de fila de origen.

**Acceptance Scenarios**:

1. **Given** una sesión activa y un archivo compatible, **When** se solicita la
   importación, **Then** el sistema la procesa y devuelve el estado final y los
   contadores en la misma acción.
2. **Given** un archivo compatible, **When** el procesamiento termina sin errores
   bloqueantes, **Then** la carga queda en `DONE` y sus registros disponibles.
3. **Given** dos importaciones solicitadas al mismo tiempo, **When** ambas se
   procesan, **Then** producen cargas independientes y ninguna altera el resultado de
   la otra.
4. **Given** una carga terminada, **When** se consultan sus registros, **Then** cada
   uno conserva el código de clasificación original tal como venía en el archivo.
5. **Given** una carga terminada, **When** se consulta cualquier registro, **Then**
   conserva el número de fila del archivo de origen.
6. **Given** un archivo con códigos de barras repetidos, **When** se importa,
   **Then** todos los registros se incorporan sin rechazar ninguno por esa causa.
7. **Given** una carga existente, **When** se importa otro archivo, **Then** se crea
   una carga independiente y la anterior no se modifica.
8. **Given** una importación en curso, **When** ocurre un fallo que impide
   completarla, **Then** la carga termina en `ERROR` y ninguno de sus registros queda
   disponible para uso posterior.
9. **Given** el archivo de origen, **When** termina la importación, **Then** el
   archivo no ha sido modificado.

---

### User Story 3 - Normalización determinista del código de clasificación (Priority: P2)

El sistema deriva de cada código de clasificación una clave comparable que permite
ordenarlo y compararlo de forma estable, sin alterar el valor original.

**Why this priority**: sin clave comparable los registros se importan pero no quedan
preparados para distribuirse. Es lo que convierte una carga en material utilizable.

**Independent Test**: se verifica importando el archivo de ejemplo dos veces y
comparando las claves obtenidas, y comprobando los pares de equivalencia y de orden
documentados en `docs/clasificacion.md`.

**Acceptance Scenarios**:

1. **Given** el mismo archivo, **When** se importa dos veces, **Then** cada fila
   produce exactamente la misma clave comparable en ambas cargas.
2. **Given** los códigos `658 H477A11` y `658 H477A11 23`, **When** se normalizan,
   **Then** producen la misma clave comparable, porque el indicador de edición DDC no
   determina la ubicación.
3. **Given** los códigos `004.0151 A111a` y `004.1 B222b`, **When** se ordenan por su
   clave, **Then** el primero precede al segundo.
4. **Given** los códigos `863 S248m` y `863 S25m`, **When** se ordenan por su clave,
   **Then** el primero precede al segundo, porque las cifras Cutter se comparan como
   fracción decimal.
5. **Given** el código `863 S-925t3`, **When** se normaliza, **Then** el guion del
   segmento Cutter se ignora y no altera el orden.
6. **Given** códigos con y sin prefijo de país, **When** se ordenan por su clave,
   **Then** los códigos sin prefijo preceden a todos los códigos con prefijo, y estos
   se agrupan por prefijo alfabético sin distinguir mayúsculas.
7. **Given** los prefijos `Cu` y `CU`, **When** se normalizan, **Then** se tratan como
   el mismo prefijo.
8. **Given** un código con coma decimal como `352,85 C333c`, **When** se normaliza,
   **Then** la coma se interpreta como punto decimal y la fila NO se marca, porque la
   lectura es única.
9. **Given** los códigos `303.440 972 862 021 G216c` y `303.440.972.862.021 G216c`,
   **When** se normalizan, **Then** producen la misma clave y ninguno se marca:
   espacios y puntos son dos escrituras del mismo agrupamiento de dígitos.
10. **Given** una fila sin código de clasificación, **When** se normaliza, **Then** no
    se produce clave comparable y el registro queda excluido de la distribución
    automática, sin ser rechazado.
11. **Given** cualquier código normalizado, **When** se almacena su clave, **Then**
    la clave es estrictamente menor que el valor reservado `~`.

---

### User Story 4 - Validación del formato antes de incorporar registros (Priority: P2)

El sistema comprueba que el archivo es un CSV de colección compatible antes de
incorporar cualquier registro, y rechaza el archivo completo cuando no lo es.

**Why this priority**: protege la integridad de las cargas. Un archivo incompatible
detectado tarde produce una colección inservible y difícil de diagnosticar.

**Independent Test**: se verifica presentando archivos deliberadamente incompatibles
—sin encabezado, sin columnas requeridas, con codificación distinta— y comprobando
que ninguno produce registros.

**Acceptance Scenarios**:

1. **Given** un archivo sin las columnas requeridas, **When** se solicita la
   importación, **Then** el archivo se rechaza, se explica qué columna falta y no se
   incorpora ningún registro.
2. **Given** un archivo que no puede leerse como UTF-8, **When** se solicita la
   importación, **Then** el archivo se rechaza y no se incorpora ningún registro.
3. **Given** un archivo con marca de orden de bytes (BOM) al inicio, **When** se lee,
   **Then** la marca se descarta y la primera columna se reconoce con normalidad.
4. **Given** un archivo que contiene solo el encabezado, **When** se importa,
   **Then** la carga termina en `DONE` con cero registros y sin problemas
   registrados.
5. **Given** un archivo vacío, **When** se solicita la importación, **Then** se
   rechaza como incompatible.
6. **Given** un archivo que supera el tamaño o el número de filas admitidos, **When**
   se solicita la importación, **Then** se rechaza antes de procesarlo, se indica qué
   límite se excedió y no se crea ninguna carga.
7. **Given** una fila con un número de campos distinto al del encabezado, **When** se
   procesa, **Then** esa fila se marca `REJECTED`, se registra su problema y el resto
   del archivo continúa procesándose.
8. **Given** un campo entrecomillado que contiene el delimitador, **When** se
   procesa, **Then** su contenido se lee completo sin dividirse.

---

### User Story 5 - Tratamiento de la fila vacía y del pie de control (Priority: P3)

El sistema reconoce la fila vacía y el pie `TOTAL;n` que cierran el archivo, los
excluye de los registros y usa el pie como control de integridad.

**Why this priority**: sin este tratamiento la colección incorpora dos filas
inválidas y el conteo de control se pierde. Es una corrección acotada pero necesaria
para que los contadores sean confiables.

**Independent Test**: se verifica importando el archivo de ejemplo y comprobando que
produce 47 registros —no 49— y que ninguno corresponde a la fila vacía ni al pie.

**Acceptance Scenarios**:

1. **Given** el archivo de ejemplo, **When** se importa, **Then** la fila vacía final
   se ignora y no genera un registro ni un problema.
2. **Given** el archivo de ejemplo, **When** se importa, **Then** el pie `TOTAL;47`
   se ignora como dato y no genera un registro.
3. **Given** el pie `TOTAL;47`, **When** se comparan las filas de datos leídas,
   **Then** el valor declarado coincide con las 47 filas procesadas.
4. **Given** un archivo cuyo pie declara un conteo distinto al de las filas leídas,
   **When** se importa, **Then** la carga termina en `ERROR`, se informan el conteo
   declarado y el observado, y ningún registro queda disponible.
5. **Given** un archivo sin pie de control, **When** se importa, **Then** la carga se
   procesa con normalidad y se registra que no había conteo declarado que verificar.
6. **Given** una fila intermedia completamente vacía, **When** se procesa, **Then**
   se ignora igual que la fila vacía final.

---

### User Story 6 - Registro y conteo del resultado de la carga (Priority: P3)

El sistema clasifica cada fila procesada y mantiene contadores que explican qué pasó
con el archivo completo.

**Why this priority**: es lo que convierte una importación en un resultado
verificable. Sin contadores, la persona administradora no puede afirmar que la carga
está completa.

**Independent Test**: se verifica importando el archivo de ejemplo y comprobando que
los contadores son estables entre ejecuciones y que su suma es coherente con las
filas leídas.

**Acceptance Scenarios**:

1. **Given** una carga terminada, **When** se consultan sus contadores, **Then**
   informa filas leídas, importadas, sin clave comparable, marcadas para revisión y
   rechazadas.
2. **Given** una carga terminada, **When** se comparan sus contadores, **Then** las
   filas importadas más las rechazadas equivalen a las filas leídas.
3. **Given** una fila importable cuyo código no produce clave comparable, **When**
   termina la carga, **Then** cuenta como importada y también como fila sin clave
   comparable.
4. **Given** una fila cuyo código es ambiguo o no canónico, **When** termina la
   carga, **Then** cuenta como importada y también como fila marcada para revisión.
5. **Given** una fila ilegible, **When** termina la carga, **Then** cuenta como
   rechazada y no genera un registro de colección.
6. **Given** el mismo archivo importado dos veces, **When** se comparan las cargas,
   **Then** los cinco contadores son idénticos.

---

### User Story 7 - Consulta del resumen y de los problemas de la carga (Priority: P3)

La persona administradora consulta el resultado de una importación, revisa sus
contadores y localiza cada problema por número de fila.

**Why this priority**: cierra el ciclo. Una carga verificable exige poder inspeccionar
lo que el sistema decidió y corregir el archivo de origen cuando corresponda.

**Independent Test**: se verifica importando el archivo de ejemplo y comprobando que
cada problema listado indica su fila de origen, su severidad y un motivo comprensible.

**Acceptance Scenarios**:

1. **Given** una sesión activa, **When** se consulta una carga, **Then** se muestran
   su identificación, su nombre de archivo, su estado, su fecha y sus contadores.
2. **Given** una carga con problemas, **When** se consulta su detalle, **Then** cada
   problema indica número de fila, severidad, motivo y el código de clasificación
   original que lo provocó.
3. **Given** un problema registrado, **When** se consulta, **Then** distingue con
   claridad una fila revisable de una fila rechazada.
4. **Given** una carga en `ERROR`, **When** se consulta, **Then** se muestra el motivo
   general del fallo.
5. **Given** varias cargas, **When** se consulta el listado, **Then** pueden
   distinguirse entre sí y ordenarse por fecha de creación.
6. **Given** ninguna sesión activa, **When** se intenta consultar una carga o sus
   problemas, **Then** el acceso se rechaza.

---

### Edge Cases

**Estructura del archivo**

- Archivo cuyo encabezado tiene las columnas requeridas en distinto orden: se procesa
  con normalidad; las columnas se reconocen por nombre, no por posición.
- Archivo con columnas adicionales desconocidas: se procesa y las columnas
  adicionales se ignoran.
- Archivo cuyo pie declara un conteo distinto al de las filas leídas: la carga termina
  en `ERROR` y no queda ningún registro disponible (**FR-032**).
- Archivo con filas después del pie de control: las filas posteriores se registran
  como problema y no se incorporan.
- Archivo con espacios de relleno alrededor de los valores: se recortan antes de
  interpretarlos.
- Archivo que excede el tamaño o el número de filas admitidos: se rechaza antes de
  procesarlo y no llega a crearse una carga (**FR-013a**).

**Códigos de clasificación**

- Doce registros que comparten el mismo código, distinguidos solo por su etiqueta de
  ejemplar: producen doce registros distintos con la misma clave comparable.
- Código con agrupamiento de dígitos, sea con espacios como `378.728 6` y
  `303.440 972 862 021`, o con puntos como `658.401.2` y `303.440.972.862.021`: los
  separadores se retiran, el valor original se conserva y la fila NO se marca
  (**FR-018**).
- Código con un espacio inmediatamente después del punto decimal, como `658. 8`: se
  normaliza y no se marca; solo admite una lectura (**FR-018**).
- Código con más de tres dígitos antes del punto, como `8693.7`: se normaliza con la
  mejor lectura posible y sí se marca, porque la DDC sitúa el punto tras el tercer
  dígito y el valor está mal formado (**FR-018a**).
- Código con espacio junto a un guion del Cutter, con la marca de obra separada como
  `C146 p`, o con el Cutter repetido de forma literal: se normaliza y no se marca
  (**FR-025a**).
- Código con un token previo al Cutter, como `371.4 M M423t`: el Cutter se identifica
  por su forma, así que la clave se deriva de `M423t`, y la fila se marca porque el
  token suelto no se explica (**FR-025**, **FR-025b**).
- Código con más de un segmento sobrante tras el Cutter, como `658 W721 A6 XYZ`: se
  importa con la mejor clave posible y se marca (**FR-025b**).
- Código con un prefijo alfabético no documentado: se importa, se ordena entre los
  códigos con prefijo y se marca para revisión (**FR-025c**).
- Código presente pero compuesto solo por separadores o espacios: se trata como
  código ausente y no produce clave comparable.

**Operación**

- Interrupción del proceso a mitad de la importación: la carga termina en `ERROR` y
  ninguno de sus registros queda disponible.
- Proceso que muere sin poder marcar la carga: esta permanece en `PENDING`, inerte. No
  expone registros y no impide importaciones posteriores (**FR-028a**, **FR-029**), de
  modo que no hace falta ningún mecanismo de recuperación.
- Dos importaciones solicitadas al mismo tiempo: se procesan como cargas
  independientes (**FR-029**). El mismo archivo enviado dos veces produce dos cargas
  distintas, ambas válidas y conservadas como historial.
- Archivo cuyo nombre coincide con el de una carga anterior: se acepta; las cargas se
  distinguen por su identificación, no por el nombre del archivo.
- Fila con año `0`: se importa sin año y no se marca, porque `0` es el marcador de
  ausencia del sistema de origen (**FR-011a**).
- Fila con año no numérico o fuera del intervalo admitido: se importa sin año y se
  marca para revisión (**FR-011b**).
- Fila cuyo campo entrecomillado contiene el delimitador: sus columnas posteriores
  deben seguir alineadas; un reparto por carácter las desplazaría (**FR-008b**).
- Columna presente en el encabezado pero vacía en todas las filas: no impide la
  importación ni genera problemas.

## Requirements *(mandatory)*

### Acceso y sesión

- **FR-001**: El sistema DEBE permitir que una persona con una cuenta ADMIN
  habilitada obtenga una sesión presentando credenciales válidas.
- **FR-002**: El sistema DEBE rechazar el acceso cuando las credenciales son
  inválidas o la cuenta está deshabilitada, con un mensaje que no revele cuál de los
  dos datos falló ni si la cuenta existe.
- **FR-003**: El sistema DEBE permitir cerrar la sesión e invalidarla de inmediato.
- **FR-004**: El sistema DEBE exigir una sesión activa para iniciar una importación y
  para consultar cargas, registros y problemas.
- **FR-005**: El sistema NO DEBE ofrecer registro público de cuentas, recuperación de
  contraseña, bloqueo por reintentos ni conteo de intentos fallidos.
- **FR-006**: El sistema DEBE registrar el instante del último acceso exitoso de cada
  cuenta.
- **FR-007**: El sistema DEBE almacenar las contraseñas únicamente como hash y NO
  DEBE conservar ni registrar la contraseña original.

### Contrato del archivo

- **FR-008**: El sistema DEBE aceptar archivos CSV codificados en UTF-8, con
  delimitador `;`, comillas dobles para los campos que contienen el delimitador y una
  fila de encabezado inicial.
- **FR-008a**: El sistema DEBE aceptar indistintamente finales de línea CRLF y LF.
- **FR-008b**: El sistema DEBE interpretar el archivo con un lector CSV que respete el
  entrecomillado. NO DEBE dividir las filas por el carácter delimitador, porque los
  campos entrecomillados pueden contenerlo y ese reparto desplazaría las columnas
  posteriores.
- **FR-009**: El sistema DEBE descartar la marca de orden de bytes (BOM) inicial si
  está presente.
- **FR-010**: El sistema DEBE requerir al menos las columnas `codBarras` y
  `Clasificacion`, reconocidas por nombre e independientes de su posición.
- **FR-011**: El sistema DEBE incorporar, cuando estén presentes, los datos
  bibliográficos de autor, título, ISBN, año y etiqueta de ejemplar.
- **FR-011a**: El sistema DEBE interpretar el valor `0` en la columna de año como
  ausencia de año, no como un dato inválido: el registro se importa sin año y NO se
  marca para revisión. El sistema de origen usa `0` como marcador de ausencia.
- **FR-011b**: El sistema DEBE importar sin año, y marcar para revisión, todo registro
  cuyo año no sea `0`, no sea numérico o quede fuera del intervalo admitido.
- **FR-011c**: El sistema DEBE tratar el ISBN como texto y NO DEBE interpretarlo como
  número ni normalizar su contenido.
- **FR-012**: El sistema DEBE ignorar las columnas no reconocidas sin rechazar el
  archivo.
- **FR-013**: El sistema DEBE rechazar el archivo completo, antes de incorporar
  cualquier registro, cuando no es legible como UTF-8, carece de encabezado o carece
  de una columna requerida.
- **FR-013a**: El sistema DEBE rechazar, antes de procesarlo, todo archivo que supere
  el tamaño máximo o el número máximo de filas configurados, indicando cuál de los dos
  límites se excedió.
- **FR-013b**: Los límites de FR-013a DEBEN ser holgados respecto del volumen previsto
  en SC-006, de modo que una colección legítima nunca se rechace por esa causa.
- **FR-014**: El sistema DEBE recortar los espacios de relleno de cada valor antes de
  interpretarlo.
- **FR-015**: El sistema NO DEBE modificar el archivo de origen.

### Normalización de códigos de clasificación

- **FR-016**: El sistema DEBE conservar el código de clasificación original de cada
  fila, sin alteraciones.
- **FR-017**: El sistema DEBE derivar una clave comparable aplicando, en orden, las
  reglas de `docs/clasificacion.md`: conversión de coma decimal en punto; separación
  de prefijo, número DDC, Cutter e indicador de edición; retiro de separadores
  internos no canónicos del número DDC; normalización de espacios y guiones del
  Cutter; retiro del indicador de edición DDC únicamente cuando existe Cutter; y
  conversión a mayúsculas.
- **FR-017a**: El sistema DEBE marcar para revisión catalográfica únicamente los
  valores cuya normalización admita **más de una lectura**. Un valor no canónico con
  una sola lectura posible se normaliza en silencio, conservando siempre el original.
  La revisión es para lo que exige una decisión humana, no para todo lo que se aparta
  de la forma canónica.
- **FR-018**: El sistema DEBE normalizar en silencio, por tener una sola lectura, los
  siguientes valores del número DDC:
  - coma como separador decimal;
  - agrupamiento de dígitos separados por espacios, como `303.440 972 862 021`;
  - agrupamiento de dígitos separados por puntos, como `303.440.972.862.021`, que es
    la misma notación con otro separador;
  - espacio inmediatamente posterior al punto decimal, como `658. 8`.
- **FR-018a**: El sistema DEBE marcar para revisión el número DDC con más de tres
  dígitos antes del punto, como `8693.7`. La DDC sitúa el punto tras el tercer dígito,
  así que el valor está mal formado y no tiene lectura única.
- **FR-018b**: El sistema DEBE marcar para revisión el número DDC cuyos bloques
  posteriores al primer punto no sean todos numéricos, porque entonces no puede
  interpretarse como agrupamiento.
- **FR-019**: El sistema DEBE ordenar los códigos sin prefijo de país antes que
  cualquier código con prefijo, y agrupar los prefijos alfabéticamente sin distinguir
  mayúsculas de minúsculas.
- **FR-020**: El sistema DEBE tratar `CU` y `Cu` como el mismo prefijo.
- **FR-021**: El sistema DEBE producir la misma clave comparable para dos códigos que
  solo difieran en el indicador de edición DDC.
- **FR-022**: El sistema DEBE producir claves estrictamente menores que el valor
  reservado `~`.
- **FR-023**: El sistema DEBE producir la misma clave comparable para la misma entrada
  en todas las ejecuciones, sin depender de la configuración regional del entorno.
- **FR-024**: El sistema DEBE registrar sin clave comparable, y sin rechazarla, toda
  fila cuyo código esté ausente o compuesto solo por espacios y separadores.
- **FR-025**: El sistema DEBE identificar el segmento Cutter por su forma —una o varias
  letras seguidas de al menos un dígito—, no por su posición. Cuando hay varios
  segmentos tras el número DDC, el Cutter es el primero con esa forma.
- **FR-025a**: El sistema DEBE normalizar en silencio, por tener una sola lectura, las
  siguientes variaciones de escritura del Cutter:
  - espacio adyacente a un guion, como `C8374- lge`;
  - marca de obra separada por un espacio cuando es el último segmento, como `C146 p`;
  - segmento repetido de forma literal, como `C659ci C659ci`.
- **FR-025b**: El sistema DEBE marcar para revisión, e importar con la mejor clave
  derivable, toda fila con un segmento que no se explique por FR-025a: un token previo
  al Cutter, o más de un segmento sobrante después de él.
- **FR-025c**: El sistema DEBE derivar una clave para un prefijo alfabético no
  incluido en la tabla de prefijos documentada, ordenarlo alfabéticamente entre los
  códigos con prefijo y marcar la fila para revisión.

### Procesamiento de la carga

- **FR-026**: El sistema DEBE tratar cada importación como una unidad con estado
  `PENDING`, `DONE` o `ERROR`.
- **FR-026a**: El sistema DEBE procesar la importación de forma síncrona: la persona
  administradora recibe el estado final y los contadores en la misma acción con la que
  la solicitó, sin tener que volver a consultar la carga.
- **FR-026b**: El sistema DEBE registrar el estado final de la carga incluso cuando la
  importación falla, de modo que un fallo quede documentado y no desaparezca junto con
  los registros descartados.
- **FR-027**: El sistema DEBE crear cada importación como una carga independiente que
  no modifica las cargas anteriores ni sus registros.
- **FR-028**: El sistema DEBE garantizar que una importación fallida termine en
  `ERROR` y que ninguno de sus registros quede disponible para uso posterior.
- **FR-028a**: Únicamente una carga en `DONE` expone registros para uso posterior. Una
  carga en `PENDING` o en `ERROR` no los expone, incluida la que quede en `PENDING`
  porque una interrupción abrupta impidió cerrarla; esa carga permanece como
  constancia del intento y no requiere ninguna recuperación.
- **FR-029**: El sistema NO DEBE condicionar el inicio de una importación al estado de
  otra. Dos importaciones simultáneas producen cargas independientes, conforme a
  FR-027, y ninguna puede corromper el resultado de la otra.
- **FR-030**: El sistema DEBE conservar en cada registro el número de fila del archivo
  de origen.
- **FR-031**: El sistema DEBE aceptar códigos de barras repetidos dentro de una misma
  carga sin rechazar registros por esa causa.
- **FR-032**: El sistema DEBE comparar el conteo declarado en el pie `TOTAL;n` con las
  filas de datos leídas y, ante una discrepancia, terminar la carga en `ERROR` sin
  dejar ningún registro disponible, indicando el conteo declarado y el observado. Una
  discrepancia sugiere un archivo truncado o corrupto, y una colección incompleta no
  debe llegar a distribuirse.
- **FR-033**: El sistema DEBE excluir de los registros la fila vacía y el pie de
  control, sin contarlos como filas de datos ni como problemas.
- **FR-034**: El sistema DEBE procesar con normalidad un archivo sin pie de control y
  dejar constancia de que no existía conteo declarado que verificar.
- **FR-035**: El sistema DEBE registrar como problema, sin incorporarlas, las filas
  que aparezcan después del pie de control.

### Resultado y consulta

- **FR-036**: El sistema DEBE mantener por carga los contadores de filas leídas,
  importadas, sin clave comparable, marcadas para revisión y rechazadas.
- **FR-037**: El sistema DEBE garantizar que las filas importadas más las rechazadas
  equivalgan a las filas leídas.
- **FR-038**: El sistema DEBE registrar cada problema con su número de fila, su
  severidad —revisable o rechazada— y un motivo comprensible para el personal.
- **FR-038a**: El sistema DEBE mostrar, junto a cada problema de una fila importada, el
  código de clasificación original que lo provocó. Sin el código, el motivo no permite
  entender qué hay que corregir ni decidir si la marca es correcta.
- **FR-039**: El sistema DEBE marcar como rechazada únicamente la fila que no puede
  leerse como registro válido, y continuar procesando el resto del archivo.
- **FR-040**: El sistema DEBE permitir consultar el resumen de una carga, su listado
  de problemas y el motivo general del fallo cuando terminó en `ERROR`.
- **FR-041**: El sistema DEBE permitir distinguir y ordenar las cargas por su fecha de
  creación.
- **FR-041a**: ~~El sistema DEBE conservar toda carga creada, incluidas las que
  terminaron en `ERROR`, y NO DEBE ofrecer eliminarlas ni ocultarlas desde el panel.~~
  **Derogado por FR-001 de [`002-load-management`](../002-load-management/spec.md).**
  El historial sigue siendo el valor por omisión, pero la persona administradora puede
  eliminar una carga de forma explícita y confirmada.

### Privacidad y seguridad

- **FR-042**: El sistema NO DEBE exponer contenido de la colección en respuestas
  accesibles sin sesión activa.
- **FR-043**: El sistema NO DEBE incluir contenido de filas de la colección,
  credenciales ni identificadores de sesión en los registros de operación normal.
- **FR-043a**: El sistema DEBE registrar de forma estructurada el inicio, el fin y el
  desenlace de cada importación, incluidas las que terminan por fallo.
- **FR-043b**: Los registros de FR-043a DEBEN poder correlacionarse entre sí mediante
  el identificador de la carga, de modo que el recorrido completo de una importación
  se reconstruya sin consultar la base de datos.
- **FR-043c**: Los registros de FR-043a DEBEN respetar FR-043: contienen
  identificadores, conteos y desenlaces, nunca contenido de filas de la colección.
- **FR-044**: El sistema DEBE restringir a la sesión administrativa el contenido
  original de fila conservado para diagnosticar un problema.
- **FR-045**: El sistema DEBE validar en el servidor todo dato recibido antes de
  utilizarlo, con independencia de las validaciones de la interfaz.

### Key Entities

- **Cuenta administrativa**: persona autorizada para operar el panel. Tiene
  identificador de acceso, correo, nombre visible, rol ADMIN, estado de habilitación y
  registro del último acceso.
- **Sesión**: acceso vigente de una cuenta. Se crea al autenticarse y se invalida al
  cerrarse.
- **Carga de colección**: importación completa de un archivo. Tiene título, nombre de
  archivo de origen, estado, contadores, autoría y fecha. Es la unidad de versionado
  de la colección.
- **Registro de colección**: fila importada del archivo. Conserva su número de fila de
  origen, su código de barras, su código de clasificación original, su clave
  comparable cuando existe, y los datos bibliográficos disponibles. Pertenece a una
  sola carga.
- **Problema de carga**: incidencia detectada en una fila. Tiene número de fila,
  severidad, motivo y, opcionalmente, el contenido original para diagnóstico.
- **Clave comparable**: representación normalizada y ordenable de un código de
  clasificación. Es derivada, nunca introducida manualmente, y puede no existir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ninguna función administrativa —iniciar una importación, consultar
  cargas, registros o problemas— es accesible sin sesión activa: 0 accesos concedidos
  en las pruebas de acceso no autenticado.
- **SC-002**: La importación de `bjff-collection-example.csv` produce exactamente 47
  filas leídas, 47 registros importados, 0 filas rechazadas, 1 fila sin clave
  comparable y 5 filas marcadas para revisión. Las 5 corresponden a: una con clase de
  más de tres dígitos, dos con un segmento que no se explica como Cutter ni marca de
  obra, una con prefijo no documentado y una con año fuera del intervalo admitido.
  Todo lo demás —coma decimal, agrupamiento con espacios o con puntos, espacio pegado
  al punto, espacio junto a un guion, marca de obra separada y Cutter repetido— se
  normaliza en silencio por tener una sola lectura.
- **SC-003**: La importación repetida del mismo archivo produce contadores idénticos
  y claves comparables idénticas en el 100% de los registros.
- **SC-004**: El orden obtenido al ordenar los registros del archivo de ejemplo por su
  clave comparable coincide con el orden esperado según `docs/clasificacion.md` en el
  100% de los pares verificados, incluidos los pares de prefijo, de decimal DDC y de
  cifras Cutter.
- **SC-005**: Los códigos que solo difieren en el indicador de edición DDC producen la
  misma clave comparable en el 100% de los casos.
- **SC-006**: Una persona administradora obtiene el resultado completo de una
  importación de 10 000 filas en menos de 30 segundos desde que la solicita, sin
  abandonar la acción. Si el procesamiento no puede sostener ese objetivo, la decisión
  de procesar de forma síncrona debe reconsiderarse.
- **SC-007**: Toda importación fallida deja 0 registros disponibles para uso
  posterior.
- **SC-007a**: Tras la interrupción abrupta del procesamiento, el sistema acepta una
  importación nueva sin intervención manual sobre los datos y sin dejar registros
  utilizables de la anterior.
- **SC-008**: El 100% de los problemas registrados permite localizar la fila de origen
  en el archivo mediante su número de fila.
- **SC-009**: Ninguna respuesta accesible sin sesión ni ningún registro de operación
  normal contiene contenido de filas de la colección: 0 hallazgos en la revisión.
- **SC-009a**: El 100% de las importaciones, incluidas las fallidas, deja un registro
  de inicio y otro de desenlace correlacionables por el identificador de la carga.
- **SC-010**: Una persona administradora que recibe un archivo incompatible entiende
  qué impidió la importación sin abrir el archivo, a partir del motivo mostrado.

## Assumptions

- Las cuentas administrativas se aprovisionan fuera de la aplicación mediante una
  operación administrativa, dado que no existe registro público de cuentas y la
  gestión de cuentas está fuera de alcance.
- Existe al menos una cuenta ADMIN habilitada antes de usar esta funcionalidad.
- El archivo se entrega completo al iniciar la importación; no se contempla carga
  parcial, reanudable ni por fragmentos.
- La importación se ejecuta de forma secuencial: una sola carga activa a la vez, lo
  que evita definir concurrencia entre importaciones en esta versión.
- El formato de columnas del archivo de colección corresponde al que documenta
  `bjff-collection-example.csv`. Un cambio en el sistema de origen exigiría revisar el
  contrato definido en FR-008 a FR-012.
- El contrato de formato de FR-008 a FR-012 y las reglas de anomalía de FR-011a a
  FR-011b, FR-018 y FR-025a se contrastaron contra la exportación oficial vigente en
  un entorno autorizado. Los hechos observados están en `docs/dataset.md`, documento
  privado; esta especificación no reproduce su contenido.
- Los patrones de anomalía cubiertos son los observados en la exportación analizada.
  Una exportación futura podría introducir formas nuevas; FR-025 obliga a importarlas
  marcadas para revisión en lugar de rechazarlas.
- El objetivo de 10 000 filas de SC-006 es un requisito de capacidad para esta
  funcionalidad, no una descripción del contenido de ninguna colección real.
- La revisión catalográfica de las filas marcadas es un proceso humano posterior; esta
  funcionalidad solo las identifica y no define quién las corrige ni cuándo.
- Las filas marcadas para revisión permanecen disponibles para futuras distribuciones
  si tienen clave comparable; la marca es informativa y no excluye el registro.
- La duración y renovación de la sesión siguen prácticas estándar y no forman parte de
  las decisiones de esta especificación.
- Los valores concretos de los límites de tamaño y de filas de FR-013a se fijan durante
  la planificación. La especificación exige que existan, sean configurables y sean
  holgados; no fija sus cifras.
- El procesamiento síncrono de FR-026a se sostiene sobre el objetivo de SC-006. Es una
  decisión contingente: si el volumen creciera o el objetivo no se alcanzara, habría
  que revisarla antes que degradar la espera.
- `bjff-collection-example.csv` se extendió para cubrir cada regla de anomalía
  especificada. Las filas añadidas son sintéticas y siguen el estilo del archivo; no
  reproducen ningún dato de la colección real.

## Fuera de alcance

- Plantillas de estructura y modelado de ubicaciones.
- Schemes y su ciclo de vida.
- Configuración, cálculo, anchors y publicación de distribuciones.
- Búsqueda pública y mapas esquemáticos.
- Registro, bloqueo, recuperación y administración de cuentas.
- Corrección de los datos del archivo de origen desde el panel.
- ~~Eliminación, ocultamiento o archivado de cargas de colección.~~ La eliminación se
  incorporó en [`002-load-management`](../002-load-management/spec.md) al comprobar que
  sin ella el listado se vuelve inmanejable durante la puesta en marcha. El archivado y
  el ocultamiento siguen fuera de alcance.
