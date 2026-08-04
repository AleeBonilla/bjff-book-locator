# Especificación: Distribución y búsqueda pública

**Feature Branch**: `004-distribution-search`

**Created**: 2026-08-03

**Status**: Draft

**Input**: Completar el flujo funcional mediante la creación, configuración, cálculo,
revisión y publicación de corridas de distribución, y permitir que el público consulte
la ubicación aproximada de un libro por su código de clasificación.

## Contexto y fuentes

Esta funcionalidad desarrolla las etapas 4 a 8 de
[`docs/flujo.md`](../../docs/flujo.md), sus secciones 8 a 17 y las invariantes de la
sección 18 que corresponden a distribución y búsqueda. Se apoya en:

- [`docs/decisiones.md`](../../docs/decisiones.md), especialmente las decisiones 8 a
  27 y 30;
- [`docs/problema-distribucion.md`](../../docs/problema-distribucion.md), para las
  limitaciones del reparto físico y el carácter aproximado del resultado;
- [`docs/db.md`](../../docs/db.md), para las entidades e invariantes ya acordadas;
- [`specs/001-collection-import/spec.md`](../001-collection-import/spec.md), para la
  carga y la normalización de códigos de clasificación;
- [`specs/003-structure-modeling/spec.md`](../003-structure-modeling/spec.md), para la
  estructura física, su orden y sus ajustes previos.

La funcionalidad comienza con una carga terminada y un `scheme` definido. Termina con
una distribución versionada que puede publicarse y con una búsqueda pública que solo
consulta la versión activa. No modifica la colección ni la estructura física.

## Clarifications

### Session 2026-08-03

- Q: ¿Cómo se convierte en entero un objetivo fraccionario expresado en `BOOKS`?
  Respuesta: se redondea siempre hacia abajo.
- Q: ¿Una corrida con registros sin asignar puede publicarse? Respuesta: sí, pero el
  sistema debe advertirlo y exigir una confirmación explícita adicional.
- Q: ¿Pueden cambiarse la carga o la estrategia de una corrida no publicada? Respuesta:
  no. Ambas quedan fijas al crearla; cualquier cambio exige otra corrida.
- Q: ¿Qué ocurre si falla el recálculo de una corrida con una vista previa válida?
  Respuesta: se revierte todo el intento y se conserva sin cambios la última vista
  previa válida.
- Q: ¿Las posiciones vacías, sobrecargas o claves divididas bloquean la publicación?
  Respuesta: no. Son advertencias revisables en una corrida `DONE`.
- Q: ¿Cómo se resuelven cambios concurrentes sobre una corrida? Respuesta: mientras se
  calcula se rechazan otros cambios; una vista desactualizada debe refrescarse antes de
  guardar.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Crear y calcular una corrida (Priority: P1)

Una persona administradora selecciona una estructura definida, una carga terminada y
una estrategia. El sistema valida las entradas, congela las posiciones y su
configuración efectiva, calcula la asignación y presenta un resultado reproducible.

**Why this priority**: Sin una corrida calculada no existe una distribución que revisar,
publicar o consultar.

**Independent Test**: Puede probarse creando una corrida sobre una carga y una
estructura válidas, y verificando que finalice con posiciones congeladas, asignaciones,
rangos, contadores e incidencias coherentes sin modificar sus fuentes.

**Acceptance Scenarios**:

1. **Given** un `scheme` habilitado y definido, una carga terminada y entradas válidas,
   **When** la persona administradora calcula una corrida, **Then** la corrida termina
   correctamente y conserva el orden y la configuración efectiva usados.
2. **Given** dos corridas con las mismas entradas congeladas, **When** ambas se
   calculan, **Then** producen las mismas fronteras, asignaciones y contadores.
3. **Given** una combinación incompatible de estrategia, unidades, anchors o rangos,
   **When** se solicita el cálculo, **Then** se rechaza antes de generar resultados y
   se explica qué entrada debe corregirse.
4. **Given** un fallo durante el cálculo, **When** finaliza el intento, **Then** la
   corrida queda en error y no conserva resultados parciales.

---

### User Story 2 - Publicar una distribución utilizable (Priority: P1)

Una persona administradora acepta la vista previa de una corrida terminada y la
publica. El `scheme` correspondiente queda distribuido y, cuando se activa, pasa a ser
la única estructura consultada por el público.

**Why this priority**: El valor público del sistema depende de cambiar de una versión
completa a otra sin exponer estados intermedios.

**Independent Test**: Puede probarse publicando una corrida terminada mientras existe
otra versión activa y verificando que toda consulta observe exclusivamente la versión
anterior o la nueva, nunca una mezcla.

**Acceptance Scenarios**:

1. **Given** una corrida terminada y revisada, **When** se publica y activa, **Then**
   queda como la única corrida publicada de su `scheme` y su `scheme` es el único
   activo.
2. **Given** una distribución activa anterior, **When** se publica una nueva versión,
   **Then** las consultas concurrentes continúan viendo la anterior hasta que el cambio
   completo está confirmado.
3. **Given** una corrida pendiente, fallida o con entradas inválidas, **When** se
   intenta publicar, **Then** no cambia ninguna versión pública.
4. **Given** una corrida terminada con registros sin asignar, **When** se intenta
   publicar, **Then** se muestra su cantidad y la publicación solo continúa después de
   una confirmación explícita adicional.

---

### User Story 3 - Buscar una ubicación aproximada (Priority: P1)

Una persona sin iniciar sesión escribe un código de clasificación y recibe la ruta de
una o varias posiciones aproximadas dentro de la biblioteca.

**Why this priority**: Es el resultado final orientado al público y el propósito
principal de Book Locator.

**Independent Test**: Puede probarse con una distribución publicada, consultando un
código presente en la carga y otro situado dentro de un rango sin coincidencia exacta.

**Acceptance Scenarios**:

1. **Given** un código con registros exactos en la carga publicada, **When** se busca,
   **Then** se muestran todas sus posiciones distintas sin duplicarlas y se indica que
   la ubicación es aproximada.
2. **Given** un código válido sin coincidencia exacta pero cubierto por un rango,
   **When** se busca, **Then** se muestra la posición aproximada de ese intervalo.
3. **Given** que no existe una distribución pública utilizable, **When** se realiza una
   búsqueda, **Then** se informa que la ubicación no está disponible sin exponer datos
   administrativos.
4. **Given** un código vacío, inválido o no ubicable, **When** se busca, **Then** no se
   inventa una ubicación y se ofrece un resultado comprensible.
5. **Given** una coincidencia exacta cuyos registros no tienen asignaciones, **When** se
   busca, **Then** se responde sin ubicación y no se utiliza el rango como alternativa.
6. **Given** un sistema externo con un código sin normalizar, **When** lo envía mediante
   el endpoint de apertura, **Then** el navegador recibe una redirección segura a la
   interfaz, el campo conserva el código y la búsqueda se ejecuta automáticamente una
   sola vez.

---

### User Story 4 - Revisar y recalcular un borrador (Priority: P2)

Una persona administradora revisa posiciones vacías o sobrecargadas, claves divididas,
registros sin asignar, anchors y rangos. Puede ajustar las entradas permitidas y
recalcular la misma corrida no publicada para obtener una nueva vista previa coherente.

**Why this priority**: El primer cálculo es una estimación y necesita incorporar el
conocimiento físico del personal antes de publicarse.

**Independent Test**: Puede probarse modificando un anchor de una corrida no publicada,
recalculándola y verificando que se sustituyan todos sus resultados sin alterar otras
corridas.

**Acceptance Scenarios**:

1. **Given** una corrida no publicada y terminada, **When** se cambia un anchor y se
   recalcula, **Then** se reconstruye la vista previa completa respetando la nueva
   frontera.
2. **Given** que cambió la configuración vigente, **When** la persona decide
   reconstruir las entradas y recalcular, **Then** la corrida conserva un nuevo
   snapshot explicando el origen de cada valor.
3. **Given** una corrida publicada, **When** se intenta cambiar una entrada, anchor o
   resultado, **Then** el sistema exige crear una corrida derivada.
4. **Given** una corrida no publicada con una vista previa válida, **When** falla un
   recálculo, **Then** se revierten sus cambios y la vista previa anterior permanece
   completa y utilizable.
5. **Given** una corrida inicial en `ERROR`, **When** se corrigen sus entradas editables
   y se reintenta con la revisión vigente, **Then** conserva `scheme`, carga y estrategia
   y termina en `DONE` o vuelve a `ERROR` sin resultados parciales.
6. **Given** una corrida en cálculo o una vista administrativa desactualizada, **When**
   otra persona intenta cambiarla, **Then** se rechaza la operación y se solicita
   refrescar antes de volver a intentarlo.

---

### User Story 5 - Aplicar estrategias y límites conocidos (Priority: P2)

Una persona administradora elige entre reparto por capacidad, ponderado, anclado,
híbrido o manual según la información física disponible. El sistema solicita solo las
entradas válidas para esa estrategia y nunca ignora una entrada incompatible.

**Why this priority**: Las condiciones físicas disponibles varían y una sola estrategia
no representa todos los casos documentados.

**Independent Test**: Puede probarse calculando una corrida mínima válida con cada
estrategia y rechazando al menos una combinación prohibida de cada una.

**Acceptance Scenarios**:

1. **Given** capacidades en libros sin anchors, **When** se usa `CAPACITY`, **Then** las
   posiciones se llenan en orden según su objetivo.
2. **Given** pesos o longitudes compatibles, **When** se usa `WEIGHTED`, **Then** la
   colección se reparte proporcionalmente.
3. **Given** un anchor para cada posición posterior a la primera, **When** se usa
   `ANCHORED`, **Then** esas fronteras determinan los rangos y no se desplazan.
4. **Given** anchors parciales y capacidades compatibles, **When** se usa `HYBRID`,
   **Then** cada tramo desconocido se calcula sin mover las fronteras conocidas.
5. **Given** una cobertura manual completa, **When** se usa `MANUAL`, **Then** se
   validan los intervalos y se derivan las asignaciones individuales.

---

### User Story 6 - Derivar, comparar y restaurar versiones (Priority: P3)

Una persona administradora crea una corrida a partir de otra, conserva su linaje,
compara los resultados y puede volver a publicar una versión anterior sin reescribir
su cálculo.

**Why this priority**: Permite corregir y mantener la distribución sin perder el
historial que explica cada cambio público.

**Independent Test**: Puede probarse derivando una corrida publicada, usando otra carga,
calculándola y alternando la publicación entre ambas mientras se conservan sus
resultados independientes.

**Acceptance Scenarios**:

1. **Given** una corrida existente, **When** se crea una derivada, **Then** se copian
   las entradas editables aplicables, se vuelve a resolver la configuración vigente y
   no se copian resultados calculados.
2. **Given** una corrida derivada terminada, **When** se compara con su base, **Then**
   se muestran diferencias de rangos, asignaciones, conteos e incidencias.
3. **Given** una corrida anterior terminada, **When** se vuelve a publicar, **Then** sus
   resultados permanecen intactos y sustituye de forma completa a la versión pública
   vigente.

### Edge Cases

- Un `scheme` definido pero deshabilitado, o que depende de una plantilla o rama
  deshabilitada, no puede iniciar una corrida nueva.
- Una carga en estado pendiente o fallido no puede utilizarse en una corrida.
- Una estructura sin posiciones utilizables se rechaza antes de congelar entradas.
- Capacidad y unidad siempre se resuelven juntas; no se combina una capacidad de un
  nivel con la unidad de otro.
- Un objetivo fraccionario en `BOOKS` siempre usa el entero inmediato inferior.
- Un anchor duplicado, vacío, fuera de la corrida o contrario al orden físico o de
  clasificación se rechaza.
- Un anchor no se mueve para corregir una sobrecarga.
- Un grupo con la misma clave puede dejar una posición parcialmente vacía si cabe
  completo en una posición posterior.
- Si un grupo no cabe completo en ninguna posición restante, se conserva unido con una
  advertencia cuando permite exceso; de lo contrario, se divide únicamente entre
  posiciones consecutivas.
- Los registros sin clave comparable no reciben una ubicación y se contabilizan como
  no asignados.
- Una posición de continuación puede contener asignaciones sin tener un rango propio.
- Un código ubicado exactamente en una frontera pertenece al rango que comienza en esa
  frontera.
- Una falla al recalcular revierte las nuevas entradas y conserva juntos el snapshot y
  los resultados de la última vista previa válida.
- Una corrida publicada conserva inmutables sus entradas y resultados aunque deje de
  ser la versión publicada.
- Una corrida en cálculo no acepta cambios ni otro cálculo simultáneo; una vista que
  quedó desactualizada no puede sobrescribir el estado más reciente.
- La ausencia de coincidencia exacta no impide buscar por rango; una coincidencia exacta
  sin asignaciones no cae al rango y produce un resultado sin ubicación.

## Requirements _(mandatory)_

### Functional Requirements

#### Acceso, selección y creación

- **FR-001**: El sistema DEBE exigir una sesión administrativa activa para crear,
  configurar, calcular, revisar, derivar y publicar corridas. La búsqueda pública NO
  DEBE exigir autenticación.
- **FR-002**: El sistema DEBE permitir seleccionar únicamente una carga en `DONE` y un
  `scheme` habilitado en `DEFINED` o `DISTRIBUTED` cuyas plantillas y locations
  necesarias también estén habilitadas.
- **FR-003**: El sistema DEBE crear cada corrida en `PENDING`, vinculada a un solo
  `scheme`, una sola carga, una estrategia, sus defaults y la persona que la inició. El
  `scheme`, la carga y la estrategia NO DEBEN cambiar durante la vida de esa corrida.
- **FR-004**: La estrategia predeterminada DEBE ser `HYBRID`, sin impedir que la persona
  elija explícitamente `CAPACITY`, `WEIGHTED`, `ANCHORED` o `MANUAL`.
- **FR-005**: Una corrida derivada DEBE referenciar una corrida base del mismo `scheme`;
  puede elegir otra carga terminada y NO DEBE crear ciclos ni autorreferencias en el
  linaje.

#### Configuración efectiva y snapshot

- **FR-006**: Para cada `POSITION` utilizable, el sistema DEBE resolver por campo, de
  mayor a menor precedencia: el ajuste de la propia posición, el ancestro más cercano
  que hereda, el nodo `POSITION` de la plantilla y el default de la corrida.
- **FR-007**: `capacity_value` y `capacity_unit` DEBEN resolverse como una unidad desde
  el mismo nivel. La capacidad DEBE ser positiva y `target_fill_ratio` DEBE estar en el
  intervalo `(0, 1]`.
- **FR-008**: El sistema DEBE congelar una sola entrada por cada `POSITION` habilitada,
  conservar su secuencia física global y excluir contenedores y ramas deshabilitadas.
- **FR-009**: Cada entrada congelada DEBE conservar el origen de la capacidad, unidad,
  objetivo de llenado y política de exceso efectivos.
- **FR-010**: Los cambios posteriores en plantillas, locations o ajustes NO DEBEN
  alterar un snapshot ya calculado. Una corrida no publicada solo adopta esos cambios
  mediante una reconstrucción y recálculo explícitos.

#### Contrato de estrategias

- **FR-011**: El sistema DEBE validar todas las entradas exigidas y prohibidas por la
  estrategia antes de generar rangos o asignaciones.
- **FR-012**: `CAPACITY` DEBE exigir capacidad `BOOKS` en todas las posiciones, prohibir
  anchors y distribuir según `capacity_value * target_fill_ratio`.
- **FR-013**: `WEIGHTED` DEBE exigir en todas las posiciones una misma unidad,
  `WEIGHT` o `CENTIMETERS`, prohibir anchors y repartir cada tramo según el peso
  efectivo relativo.
- **FR-014**: `ANCHORED` DEBE exigir un anchor para cada posición posterior a la
  primera, prohibir anchors parciales y tratar las capacidades como información que no
  desplaza fronteras.
- **FR-015**: `HYBRID` DEBE exigir capacidades compatibles, admitir anchors parciales o
  ningún anchor y calcular cada segmento desconocido de manera independiente.
- **FR-016**: `MANUAL` DEBE prohibir anchors, exigir una cobertura introducida por el
  personal que sea completa, ordenada, continua y sin solapamientos, y derivar de ella
  las asignaciones individuales.
- **FR-017**: El sistema NO DEBE ignorar silenciosamente anchors, capacidades, unidades
  ni rangos incompatibles con la estrategia elegida.
- **FR-018**: Un anchor DEBE significar que una posición comienza en el código indicado;
  debe pertenecer al snapshot, ser único por posición, contener una clave válida y
  avanzar en el mismo orden que las posiciones y los códigos de clasificación.
- **FR-019**: El sistema DEBE normalizar y comparar anchors, rangos, registros y
  consultas con las mismas reglas deterministas definidas para la importación.
- **FR-020**: Cuando `capacity_value * target_fill_ratio` no sea entero, el objetivo en
  `BOOKS` DEBE redondearse hacia abajo al entero inmediato inferior.

#### Cálculo y resultados

- **FR-021**: El sistema DEBE ordenar por clave comparable los registros de la carga,
  agrupar los que comparten clave y mantener ese orden durante toda la distribución.
  Los registros sin clave comparable DEBEN quedar sin asignar.
- **FR-022**: Los anchors DEBEN dividir la secuencia de posiciones y la colección en
  segmentos independientes, sin dejar segmentos que carezcan de posiciones.
- **FR-023**: El cálculo DEBE asignar los grupos en orden, evitar dividir una clave
  cuando sea posible y usar solo posiciones consecutivas cuando deba dividirla.
- **FR-024**: Si un grupo no cabe en el objetivo actual, el sistema DEBE intentar una
  posición posterior donde quepa completo. Si no existe, `allow_overflow = true` DEBE
  conservarlo unido y advertir el exceso; `false` DEBE permitir dividirlo entre
  posiciones consecutivas.
- **FR-025**: La capacidad y el objetivo de llenado representan valores aproximados, no
  un límite físico confirmado. El sistema DEBE registrar sobrecargas y libros que no
  pueda asignar sin presentar la estimación como inventario real.
- **FR-026**: Cada registro asignado DEBE tener exactamente una sola `POSITION` en la
  corrida. Distintos registros con la misma clave PUEDEN quedar en varias posiciones
  consecutivas.
- **FR-027**: Los rangos DEBEN usar inicio inclusivo y final exclusivo, cubrir desde la
  cadena vacía `''` como inicio global hasta `~`, avanzar en orden y no dejar huecos ni
  solapamientos.
- **FR-028**: Cuando una clave ocupe varias posiciones consecutivas, las asignaciones
  DEBEN conservar todas las posiciones; las posiciones de continuación PUEDEN carecer
  de rango propio.
- **FR-029**: Cada rango y asignación DEBE indicar si su origen es automático,
  condicionado por un anchor o manual.
- **FR-030**: La corrida DEBE informar al menos cantidad de registros considerados,
  posiciones utilizadas, registros sin asignar, posiciones vacías, posiciones
  sobrecargadas y claves divididas.
- **FR-031**: El cálculo y recálculo DEBEN ser atómicos. Una ejecución correcta termina
  en `DONE`. El primer cálculo fallido termina en `ERROR`, conserva un diagnóstico
  general y no deja resultados parciales. Un recálculo fallido DEBE revertir todo el
  intento y conservar sin cambios el estado, las entradas y los resultados de la
  última vista previa válida.
- **FR-031a**: Una corrida inicial en `ERROR` no publicada DEBE permitir un reintento con
  un comando completo y la revisión vigente, sin cambiar `scheme`, carga o estrategia.
  Un reintento exitoso DEBE pasar a `DONE`; uno fallido DEBE conservar `ERROR`, actualizar
  el diagnóstico y no dejar resultados parciales. Cada reintento terminado DEBE
  incrementar la revisión.
- **FR-032**: Un cálculo correcto sobre un `scheme DEFINED` DEBE cambiarlo a
  `DISTRIBUTED` sin modificar su estructura ni su secuencia física.

#### Revisión, recálculo y versionado

- **FR-033**: El panel DEBE mostrar registros sin asignar, posiciones vacías o
  sobrecargadas, claves divididas, anchors aplicados, rangos, diferencias frente a la
  corrida base y búsquedas de prueba.
- **FR-033a**: Una búsqueda de prueba DEBE aplicar la misma validación de código que la
  búsqueda pública. Un código vacío, ambiguo o ajeno al formato DEBE responder `422`,
  mostrarse junto al campo y retirar cualquier resultado previo sin consultar rangos.
- **FR-034**: Una corrida no publicada DEBE permitir cambiar defaults, reconstruir su
  configuración efectiva y agregar, mover o eliminar anchors o rangos manuales según
  su estrategia. Cambiar de carga, `scheme` o estrategia DEBE crear otra corrida.
- **FR-034a**: Mientras una corrida esté en `PENDING`, el sistema DEBE rechazar otros
  cambios y cálculos sobre ella. Al terminar, una vista basada en un estado anterior
  DEBE refrescarse antes de poder guardar y NO DEBE sobrescribir cambios más recientes.
- **FR-035**: Recalcular una corrida no publicada DEBE marcarla `PENDING`, sustituir de
  forma atómica el snapshot y los resultados anteriores, y volver a presentar la vista
  previa completa. Si falla, la transición a `PENDING` y todos los cambios del intento
  DEBEN revertirse junto con el recálculo.
- **FR-036**: Fuera de `MANUAL`, el sistema NO DEBE permitir editar directamente un
  rango calculado. Una corrección de frontera DEBE modificar un anchor y recalcular la
  corrida completa.
- **FR-037**: Una corrida publicada DEBE mantener inmutables su estrategia, defaults,
  snapshot, anchors, rangos y asignaciones. Corregirla DEBE crear otra corrida.
- **FR-038**: Al derivar una corrida, el backend DEBE ofrecer una plantilla editable con
  la estrategia, parámetros, defaults, anchors y rangos manuales aplicables; DEBE volver
  a resolver la configuración vigente y NO DEBE incluir snapshots, rangos calculados ni
  asignaciones. La interfaz DEBE enviar la plantilla elegida o modificada mediante el
  comando completo de creación, sin reimplementar las reglas de copia.
- **FR-039**: Una corrida derivada DEBE conservar identidad, carga, resultados y
  contadores propios, y permitir comparar sus resultados con la corrida base.
- **FR-040**: Registrar una revisión y sus notas DEBE ser opcional y NO DEBE convertir
  la ubicación en confirmada ni bloquear por sí solo la publicación.

#### Publicación y activación

- **FR-041**: Solo una corrida `DONE`, perteneciente a un `scheme DISTRIBUTED`, con la
  vista previa aceptada PUEDE publicarse. Las posiciones vacías, sobrecargas y claves
  divididas DEBEN mostrarse como advertencias y NO DEBEN bloquear la publicación; una
  combinación inválida DEBE impedir que la corrida alcance `DONE`.
- **FR-042**: La presencia de registros sin asignar NO DEBE bloquear por sí sola la
  publicación. El sistema DEBE mostrar su cantidad como advertencia y exigir una
  confirmación explícita adicional antes de publicar.
- **FR-043**: Publicar DEBE despublicar la corrida vigente del mismo `scheme`, publicar
  la elegida y activar el `scheme` cuando corresponda como una sola operación.
- **FR-044**: El sistema DEBE garantizar que exista como máximo un `scheme` activo y una
  corrida publicada por `scheme`.
- **FR-045**: Durante una publicación, las consultas concurrentes DEBEN observar la
  versión anterior completa hasta poder observar la nueva completa; nunca una mezcla.
- **FR-046**: El sistema DEBE permitir volver a publicar una corrida anterior `DONE`
  sin modificar sus entradas ni resultados.

#### Búsqueda pública

- **FR-047**: La búsqueda pública DEBE recibir un código de clasificación, normalizarlo
  con las reglas vigentes y consultar únicamente el `scheme` activo y su corrida
  publicada.
- **FR-047a**: El sistema DEBE aceptar `POST /api/public/search/open` con el mismo código
  sin normalizar y responder `303` hacia `/buscar?codigo=...` en el origen web
  configurado. El destino NO DEBE ser controlable por el body; el código DEBE viajar
  codificado y la interfaz DEBE precargarlo y ejecutar una sola búsqueda automática.
- **FR-048**: Ante coincidencias exactas en la carga publicada, la búsqueda DEBE
  agrupar y devolver todas las rutas físicas distintas de sus asignaciones, sin
  duplicarlas.
- **FR-049**: Sin coincidencia exacta, la búsqueda DEBE resolver el intervalo que
  contenga la clave mediante `range_start_key <= clave < range_end_key`.
- **FR-050**: La búsqueda NO DEBE combinar cargas, corridas o `scheme` diferentes ni
  consultar borradores o resultados no publicados.
- **FR-051**: Toda respuesta con ubicación DEBE identificarla de forma visible como
  aproximada, incluso cuando existe una coincidencia exacta en el catálogo.
- **FR-052**: Un código vacío, inválido, sin clave comparable, una coincidencia exacta
  sin asignaciones o una ausencia de distribución publicada DEBE producir un resultado
  comprensible sin inventar una ubicación ni exponer información administrativa.
- **FR-053**: La respuesta pública DEBE mostrar la ruta jerárquica completa de cada
  `POSITION` encontrada y PUEDE utilizar su referencia visual existente, pero NO DEBE
  crear ni editar mapas.

#### Mantenimiento, seguridad y trazabilidad

- **FR-054**: Un cambio de colección DEBE utilizar una carga y una corrida nuevas. Un
  cambio de estructura DEBE utilizar otro `scheme`; un cambio de plantilla DEBE
  aplicarse mediante otra plantilla y otro `scheme`.
- **FR-055**: Un cambio de defaults, ajustes o anchors PUEDE recalcular una corrida no
  publicada; si la corrida está publicada, DEBE realizarse en otra corrida.
- **FR-056**: El sistema DEBE registrar de forma estructurada el inicio, fin, duración y
  resultado de cálculos y publicaciones, con datos correlacionables y sin secretos ni
  contenido privado de la colección.
- **FR-057**: Los errores administrativos DEBEN indicar la corrida y la entrada que
  requiere corrección sin incluir códigos, títulos u otros datos privados en registros
  operativos.

### Key Entities

- **Corrida de distribución**: Versión independiente que relaciona un `scheme`, una
  carga, una estrategia, defaults, estado, contadores, linaje y estado de publicación.
- **Entrada de posición congelada**: Copia del orden y la configuración efectiva que
  una `POSITION` tuvo al calcular una corrida, incluido el origen de cada valor.
- **Anchor**: Límite conocido aportado por el personal que indica el código donde
  comienza una posición dentro de una corrida.
- **Rango de distribución**: Intervalo ordenado, continuo y semiabierto asociado a una
  posición como resultado resumido de una corrida.
- **Asignación de libro**: Relación entre un registro concreto de la carga y una sola
  posición dentro de una corrida.
- **Incidencia de distribución**: Condición observable de la vista previa, como
  sobrecarga, posición vacía, clave dividida o registro sin asignar.
- **Resultado de búsqueda**: Una o varias rutas físicas aproximadas obtenidas desde las
  asignaciones exactas o, en su ausencia, desde un rango publicado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de las corridas conserva exactamente una entrada congelada por
  cada posición utilizada, con secuencia y origen de configuración trazables.
- **SC-002**: Dos cálculos con la misma carga, estrategia, snapshot y límites producen
  el 100 % de las mismas asignaciones, rangos y contadores.
- **SC-003**: El 100 % de las combinaciones inválidas de estrategia, unidad, anchors o
  rangos se rechaza antes de dejar resultados consultables.
- **SC-004**: El 100 % de los fallos de cálculo o publicación conserva una versión
  anterior completa o ningún resultado, con 0 snapshots, rangos o asignaciones
  parciales del intento fallido.
- **SC-005**: Una corrida de 100.000 registros y 1.000 posiciones produce su vista
  previa completa en menos de 2 minutos bajo la carga operativa normal prevista.
- **SC-006**: El 100 % de los registros asignados aparece una sola vez por corrida; el
  100 % de los rangos queda ordenado, sin huecos ni solapamientos.
- **SC-007**: Una persona administradora puede crear, calcular, revisar y publicar una
  corrida válida en menos de 10 minutos, sin editar identificadores, claves comparables
  ni secuencias derivadas.
- **SC-008**: El 100 % de las publicaciones mantiene como máximo un `scheme` activo y
  una corrida publicada por `scheme`, incluso ante solicitudes concurrentes.
- **SC-009**: Al menos el 95 % de las búsquedas públicas obtiene una respuesta visible
  en menos de 1 segundo bajo la carga operativa normal prevista.
- **SC-010**: El 100 % de las coincidencias exactas con asignaciones devuelve todas sus
  posiciones distintas sin duplicados; el 100 % de las coincidencias exactas sin
  asignaciones responde sin ubicación y no cae al rango; el 100 % de las claves sin
  coincidencia exacta devuelve la posición de su rango.
- **SC-011**: El 100 % de los resultados públicos con ubicación incluye una indicación
  visible de que es aproximada y 0 respuestas afirman presencia física confirmada.
- **SC-012**: Ninguna operación administrativa de distribución es accesible sin sesión
  activa y ninguna búsqueda pública expone datos administrativos o resultados no
  publicados.
- **SC-013**: El 100 % de las publicaciones con registros sin asignar muestra su
  cantidad y exige una confirmación explícita adicional; 0 publicaciones incompletas
  continúan mediante la confirmación ordinaria.

## Assumptions

- La autenticación administrativa, las cargas terminadas y la normalización
  determinista de códigos ya existen y conservan los contratos de las especificaciones
  001 y 002.
- Las plantillas, locations, secuencia física y ajustes previos ya existen y conservan
  el contrato de la especificación 003.
- `capacity_value` y `target_fill_ratio` expresan un objetivo aproximado o peso de
  reparto, no una capacidad física certificada.
- `CENTIMETERS` se usa proporcionalmente porque la primera versión no conoce el grosor
  individual de cada libro.
- Los registros sin clave comparable forman parte del conteo de no asignados y nunca
  reciben una ubicación calculada.
- Las claves que deban dividirse solo ocupan posiciones consecutivas en esta versión.
- Una búsqueda solicita un código a la vez y devuelve rutas textuales; la creación y
  edición de mapas quedan fuera del alcance.
- La revisión formal es opcional. No se define quién certifica físicamente una
  posición ni se utiliza la revisión como prueba de presencia.

## Fuera de alcance

- Importar, editar, eliminar o corregir cargas y registros de la colección.
- Crear o modificar plantillas, jerarquías, locations o la secuencia física de un
  `scheme`.
- Administrar cuentas, recuperar contraseñas o agregar roles distintos de
  administrador y público.
- Confirmar inventario físico por ejemplar o considerar préstamos y devoluciones.
- Distribuir intencionalmente una clave en posiciones no consecutivas.
- Definir un proceso obligatorio de certificación física o sus responsables.
- Crear, editar o almacenar mapas SVG.
- Actualizar una distribución de forma incremental; cualquier cambio recalcula la
  corrida completa.
- Presentar una ubicación como exacta o confirmada.
