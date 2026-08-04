# Decisiones de diseño

## 1. Plantillas en lugar de niveles globales

**Decisión:** reemplazar una secuencia global de niveles por plantillas de
estructura reutilizables.

**Motivo:** una biblioteca puede combinar jerarquías distintas:

```text
Sección -> Cara -> Estantería -> Anaquel
Estantería -> Cara -> Anaquel
Archivador -> Cajón
```

Un listado global obliga a todas las ramas a atravesar los mismos niveles y no
representa estructuras heterogéneas.

**Consecuencia:** un `scheme` puede contener locations creadas desde varias
plantillas.

## 2. La plantilla define forma, no cantidad

**Decisión:** las cantidades no se almacenan en la plantilla.

**Motivo:** dos estructuras con la misma jerarquía pueden tener cantidades
distintas de caras, estanterías o anaqueles.

```text
Misma plantilla:
Sección -> Cara -> Estantería -> Anaquel

Instancia A: 2 caras, 4 estanterías, 20 anaqueles
Instancia B: 1 cara, 1 estantería, 3 anaqueles
```

**Consecuencia:** las locations son la representación física concreta. Un nodo
de plantilla puede instanciarse varias veces bajo el mismo padre.

## 3. Roles fijos `CONTAINER` y `POSITION`

**Decisión:** el sistema fija dos comportamientos estructurales.

| Rol         | Comportamiento                       |
| ----------- | ------------------------------------ |
| `CONTAINER` | Contiene otras locations             |
| `POSITION`  | Recibe distribución y no tiene hijas |

**Motivo:** una lista fija de nombres como Sección, Cara o Anaquel nunca cubrirá
todas las estructuras futuras.

Los nombres pertenecen a la plantilla. El comportamiento pertenece al sistema.

**Consecuencia:** una `POSITION` puede llamarse Anaquel, Cajón o Estantería. La
distribución no depende del vocabulario.

## 4. La raíz concreta es la instancia

**Decisión:** no crear una tabla separada de instancias. Cada location raíz
instancia la raíz de una plantilla.

**Motivo:** la raíz ya contiene identidad, nombre, orden, scheme y plantilla.
Otra tabla duplicaría esos datos.

**Consecuencia:** dos raíces pueden usar la misma plantilla y contener
cantidades distintas de locations.

## 5. Orden por hermanos

**Decisión:** `sort_order` solo ordena locations hermanas.

**Motivo:** un número global es difícil de mantener. Insertar una posición al
inicio obligaría a renumerar todo manualmente.

**Consecuencia:** el sistema:

1. ordena raíces;
2. recorre cada grupo de hijas por `sort_order`;
3. hace un recorrido en profundidad;
4. calcula `leaf_sequence` para todas las `POSITION`.

La plantilla puede sugerir un orden, pero las locations concretas son la fuente
de verdad física.

## 6. `scheme` como versión estructural

**Decisión:** una reorganización física crea otro `scheme`.

**Motivo:** editar la estructura vigente rompería rangos y asignaciones
publicadas.

**Consecuencia:** el personal puede preparar, distribuir y probar una nueva
estructura sin afectar la búsqueda pública.

## 7. `based_on_scheme_id`

**Decisión:** conservar la relación entre un `scheme` copiado y su origen.

**Motivo:** facilita rastrear reorganizaciones y entender de dónde salió una
estructura.

El campo no copia datos. La aplicación crea el nuevo scheme y duplica sus
plantillas aplicadas, locations y configuración.

## 8. Separar estructura y distribución

**Decisión:** no guardar rangos ni asignaciones directamente en `locations` o
`books`.

**Motivo:** esos datos pertenecen a una corrida concreta. Guardarlos en las
entidades base sobrescribiría el historial.

**Consecuencia:**

- `locations` describe el espacio;
- `books` describe la carga;
- `distribution_runs` versiona el cálculo;
- `distribution_ranges` guarda intervalos;
- `book_placements` guarda asignaciones.

## 9. Snapshot de posiciones por corrida

**Decisión:** crear `distribution_position_inputs`.

**Motivo:** los defaults de plantillas y locations pueden cambiar. Una corrida
debe conservar exactamente:

- qué posiciones utilizó;
- en qué orden;
- con qué capacidad o peso;
- con qué objetivo y overflow.

**Consecuencia:** cada corrida es reproducible y auditable. `resolution`
registra de dónde salió cada valor efectivo.

## 10. Configuración heredable

**Decisión:** resolver configuración en cuatro niveles:

```text
POSITION concreta
-> ancestro con herencia
-> nodo POSITION de plantilla
-> corrida
```

**Motivo:** configurar todas las posiciones manualmente es costoso, pero
configurar solo por plantilla ignora diferencias físicas.

**Consecuencia:** los defaults cubren el caso común y las locations solo
registran excepciones.

Los valores se resuelven por campo. Capacidad y unidad se resuelven juntas.

## 11. Capacidad, longitud y peso

**Decisión:** aceptar `BOOKS`, `CENTIMETERS` y `WEIGHT`.

**Motivo:** la biblioteca puede conocer distintos tipos de información.

- `BOOKS` es una capacidad aproximada.
- `CENTIMETERS` expresa espacio físico, pero sin grosor por libro se usa
  proporcionalmente.
- `WEIGHT` expresa directamente una proporción.

**Consecuencia:** una corrida exige unidades compatibles. No se mezclan números
que no tengan una interpretación común.

## 12. `target_fill_ratio`

**Decisión:** permitir reservar parte de la capacidad.

```text
40 libros * 0.85 = objetivo de 34
```

**Motivo:** llenar al máximo deja la estructura sin margen para crecimiento.

**Consecuencia:** `1` usa toda la capacidad; un valor menor reduce el objetivo o
el peso efectivo.

## 13. `allow_overflow`

**Decisión:** controlar si una posición puede superar su objetivo para mantener
una clave unida.

**Motivo:** algunos códigos tienen más ejemplares que la capacidad típica de
una posición.

**Consecuencia:**

- con overflow, el grupo se mantiene unido y se advierte el exceso;
- sin overflow, se intenta otra posición o se divide entre posiciones
  consecutivas.

## 14. Contrato por estrategia

**Decisión:** cada valor de `distribution_strategy` define entradas,
validaciones y comportamiento distintos:

| Estrategia | Contrato                                                           |
| ---------- | ------------------------------------------------------------------ |
| `CAPACITY` | Requiere capacidades en `BOOKS` y no admite anchors.               |
| `WEIGHTED` | Requiere `WEIGHT` o `CENTIMETERS` compatibles y no admite anchors. |
| `ANCHORED` | Requiere un anchor para cada posición después de la primera.       |
| `HYBRID`   | Requiere capacidades compatibles y admite anchors parciales.       |
| `MANUAL`   | Requiere rangos completos introducidos por el personal.            |

**Motivo:** si la estrategia solo fuera una etiqueta, el sistema podría aceptar
anchors que después ignora, mezclar unidades o ejecutar un cálculo sin las
entradas necesarias.

**Consecuencia:** el servicio rechaza combinaciones inválidas antes de calcular.
`ANCHORED` representa fronteras suficientes para determinar la distribución;
cuando solo se conocen algunas, se utiliza `HYBRID`.

## 15. Estrategia híbrida

**Decisión:** usar `HYBRID` como estrategia predeterminada.

**Motivo:** ninguna fuente es suficiente por sí sola:

- los pesos aproximan tamaños;
- los anchors incorporan conocimiento físico;
- el algoritmo completa los intervalos desconocidos.

**Consecuencia:** sin anchors se comporta como reparto ponderado. Con anchors
parciales distribuye entre límites. Con todos los límites definidos se aproxima
a una distribución manual.

## 16. Anchors como límites de inicio

**Decisión:** un anchor siempre significa:

> Esta posición comienza en esta clave.

**Motivo:** almacenar inicios y finales separados permite huecos y
contradicciones.

El inicio de una posición es el final exclusivo del tramo anterior.

**Consecuencia:** una posición tiene como máximo un anchor. Los anchors deben
avanzar tanto en orden físico como en orden de clasificación.

## 17. Los anchors son entradas

**Decisión:** un ajuste manual modifica anchors y vuelve a ejecutar el
algoritmo; no edita un rango aislado.

**Motivo:** mover una frontera afecta rangos vecinos, asignaciones, conteos y
alertas.

**Consecuencia:** el sistema recalcula resultados coherentes. Para la primera
versión se recalcula la corrida completa.

## 18. Borradores y publicaciones

**Decisión:** una corrida no publicada puede ajustar defaults, settings, anchors o
rangos manuales y recalcularse en el mismo registro, pero su `scheme`, carga y
estrategia quedan fijos desde la creación. Una corrida publicada es inmutable.

Los cambios y cálculos sobre una misma corrida se serializan: mientras está `PENDING`
se rechazan otras mutaciones, y una vista desactualizada debe refrescarse antes de
guardar. Si un recálculo falla, se revierte todo el intento y se conserva sin cambios la
última vista previa válida.

Una corrida inicial en `ERROR` puede reintentarse con un comando completo mientras no
esté publicada. El reintento conserva `scheme`, carga y estrategia, permite corregir
defaults, anchors o rangos manuales y usa la revisión observada. Como todavía no existe
una vista previa válida, un nuevo fallo conserva `ERROR`, elimina cualquier resultado
parcial, actualiza el diagnóstico e incrementa la revisión; un éxito pasa a `DONE` e
incrementa la revisión.

**Motivo:** guardar una versión por cada ajuste de vista previa genera ruido,
pero cambiar la carga o la estrategia altera la identidad y explicación del cálculo.
Mezclar entradas de operaciones concurrentes o conservar resultados que no
corresponden a sus anchors rompería la reproducibilidad. Modificar una versión pública
destruiría historial.

**Alternativas descartadas:** cambiar carga o estrategia dentro del mismo borrador,
porque haría ambiguo qué representa la corrida; encolar cambios concurrentes o aceptar
el último en completar, porque podría combinar intenciones de dos personas; conservar
nuevas entradas junto con resultados anteriores después de un fallo, porque formarían
una vista previa incoherente.

**Consecuencia:** un ajuste compatible reutiliza la corrida no publicada. Un cambio de
`scheme`, carga o estrategia crea otra corrida. Corregir una corrida publicada crea una
derivada con `based_on_distribution_run_id`.

## 19. Linaje entre corridas

**Decisión:** `based_on_distribution_run_id` registra que una corrida se creó a
partir de otra del mismo `scheme`.

**Motivo:** se necesita comparar propuestas y explicar el origen de una
corrección sin modificar la corrida publicada.

**Consecuencia:** el backend ofrece una plantilla de derivación con estrategia,
parámetros, defaults, anchors y entradas manuales aplicables. La plantilla vuelve a
resolver la configuración vigente, excluye snapshot, `book_placements` y rangos
calculados, y puede editarse antes de enviarse como un comando completo de creación.
React consume esa plantilla y no reproduce las reglas de copia.

La relación no hereda filas automáticamente en la base de datos. La corrida derivada
es independiente, puede usar otra carga de colección y conserva resultados propios.

## 20. `distribution_ranges`

**Decisión:** usar intervalos con inicio inclusivo y final exclusivo:

```text
[range_start_key, range_end_key)
```

**Motivo:** elimina ambigüedad en las fronteras.

**Consecuencia:**

- cadena vacía cubre el inicio global;
- `~` cubre el final;
- los rangos forman una cobertura continua;
- una posición de continuación puede tener placements sin rango propio.

En estrategia `MANUAL`, el personal introduce los intervalos, pero estos solo se
consideran resultados de la corrida después de validarlos y derivar sus
placements.

## 21. `book_placements`

**Decisión:** guardar la asignación calculada de cada registro por corrida.

Cada `book_id` tiene una sola `POSITION` por corrida. Varios registros pueden
compartir `comparable_key` y distribuirse entre posiciones consecutivas.

**Motivo:** un ejemplar o fila de la carga ocupa una sola posición; el código de
clasificación es el que puede abarcar más de una.

**Consecuencia:** una búsqueda exacta agrupa las posiciones distintas de todos
los placements con la misma clave. `allow_overflow` intenta mantener unido ese
grupo, pero nunca crea dos placements para un mismo `book_id`.

El dato continúa siendo algorítmico y aproximado. El modelo permite que una
clave ocupe ubicaciones no consecutivas en el futuro, aunque ese comportamiento
no forma parte de esta versión.

## 22. Resultado público siempre aproximado

**Decisión:** no usar las categorías “confirmado” y “estimado” para la ubicación.

**Motivo:** incluso una coincidencia exacta en catálogo usa una asignación
algorítmica y no demuestra presencia física.

**Consecuencia:** una coincidencia exacta puede ser más específica, pero la
interfaz siempre comunica una ubicación aproximada.

## 23. Revisión física opcional

**Decisión:** conservar `reviewed_by`, `reviewed_at` y `review_notes` como una revisión
opcional de rangos. Solo pueden agregarse, modificarse o retirarse mientras la corrida
esté en `DONE` y no se haya publicado. Al publicar, esos metadatos quedan inmutables
junto con el resto de la versión.

**Motivo:** el proceso real de verificación física todavía no es obligatorio ni define
una figura definitiva, pero permitir cambios después de publicar alteraría el registro
histórico que explica el resultado público.

**Alternativas descartadas:** permitir revisiones posteriores a la publicación, porque
una misma versión pública cambiaría con el tiempo; exigir que todos los rangos estén
revisados antes de publicar, porque todavía no existe un proceso de verificación
obligatorio acordado.

**Consecuencia:** revisar es opcional y no convierte la ubicación en confirmada ni
bloquea la publicación. Una corrección posterior requiere derivar otra corrida.

## 24. Colación binaria

**Decisión:** guardar claves comparables con `COLLATE "C"`.

**Motivo:** la ubicación depende de una comparación determinista de las claves
normalizadas.

**Consecuencia:** importación, distribución y búsqueda usan la misma función de
normalización y el mismo orden.

## 25. Código de barras no único

**Decisión:** identificar una fila por carga y número de fila, no por código de
barras.

**Motivo:** el catálogo oficial contiene códigos de barras repetidos.

**Consecuencia:** el código de barras se indexa para consulta, pero no rechaza
registros válidos.

## 26. Publicación transaccional

**Decisión:** cambiar la corrida publicada o el scheme activo dentro de una
transacción.

**Motivo:** la búsqueda pública no debe observar un estado intermedio.

**Consecuencia:** las consultas concurrentes ven la versión anterior hasta que
la nueva queda completa.

## 27. Autenticación fuera del problema de distribución

**Decisión:** esta funcionalidad solo distingue administrador autenticado y
público.

**Motivo:** reintentos y bloqueo de inicio de sesión pertenecen a otra
funcionalidad.

**Consecuencia:** el modelo de esta versión no incluye contadores ni bloqueos de
autenticación.

## 28. Plantillas activas inmutables

**Decisión:** usar el ciclo:

```text
DRAFT -> ACTIVE -> ARCHIVED
```

Solo una plantilla `DRAFT` permite modificar nodos. Una plantilla `ACTIVE`
permite crear instancias, pero su jerarquía es inmutable.

**Motivo:** cambiar una plantilla aplicada puede invalidar silenciosamente las
locations que ya la instancian.

**Consecuencia:** una forma nueva se modela en otra plantilla. `ARCHIVED`
impide nuevas instancias sin eliminar las estructuras existentes.

## 29. Registro explícito de decisiones y preguntas abiertas

**Decisión:** mantener las decisiones importantes en `docs/decisiones.md` y las
incertidumbres materiales en `docs/preguntas-abiertas.md`, asistidas por las skills
locales `record-decisions` y `track-open-questions`.

**Motivo:** una decisión que queda únicamente en una conversación no puede revisarse,
y una duda convertida silenciosamente en supuesto suele reaparecer como defecto o
bloqueo. Los dos tipos de información tienen ciclos distintos: la decisión es vigente;
la pregunta permanece abierta hasta que exista evidencia o autoridad para resolverla.

**Alternativas descartadas:** mezclar preguntas y decisiones en un solo documento,
porque dificultaría distinguir lo acordado de lo pendiente; usar únicamente
`tasks.md`, porque una tarea describe trabajo ejecutable y no necesariamente la
incertidumbre que lo origina.

**Consecuencia:** las preguntas resueltas no se borran, sino que conservan su
resolución. Cuando una respuesta establezca un criterio duradero, se registra además
como decisión y ambas entradas se enlazan.

## 30. Disponibilidad separada del ciclo de vida estructural

**Decisión:** `enabled` controla la disponibilidad sin cambiar el estado ni borrar
historial.

- Una plantilla deshabilitada no admite nuevas instancias. Sus locations existentes
  siguen visibles, pero quedan fuera del conjunto estructural utilizable.
- Un nodo de plantilla deshabilitado y todos sus descendientes permanecen visibles,
  pero no pueden instanciarse.
- Si una plantilla deshabilitada ya participa en un `scheme DEFINED`, el `scheme`
  conserva su estado y `leaf_sequence`, pero no puede utilizarse para una nueva corrida
  hasta volver a habilitar la plantilla o preparar otro `scheme`.
- Un `scheme` deshabilitado sigue visible y administrable según su estado, pero no
  puede seleccionarse para nuevas corridas.

**Motivo:** disponibilidad y ciclo de vida resuelven problemas distintos. Los estados
protegen la evolución estructural; `enabled` permite retirar temporalmente elementos
del uso normal sin reescribir versiones ni perder trazabilidad.

**Alternativas descartadas:** permitir que las instancias de una plantilla
deshabilitada siguieran utilizándose, porque haría que `enabled` fuera solo visual;
deshabilitar en cascada las locations existentes, porque alteraría datos históricos;
revertir un `scheme DEFINED` a `DRAFT` o cambiar su secuencia, porque rompería su
inmutabilidad; impedir la deshabilitación mientras existan referencias, porque
eliminaría el retiro temporal.

**Consecuencia:** la selección de estructuras para una corrida debe comprobar la
disponibilidad del `scheme`, de sus plantillas y de sus locations. Volver a habilitar
un elemento restaura su disponibilidad sin reconstruir el historial.

## 31. Eliminación explícita y atómica de subárboles en borrador

**Decisión:** al eliminar en `DRAFT` un nodo de plantilla o una location con
descendientes, el sistema muestra el subárbol completo, exige confirmación explícita y
elimina todo el subárbol como una sola operación.

**Motivo:** eliminar solo el padre dejaría una jerarquía inválida y exigir borrar cada
hoja por separado vuelve innecesariamente costoso corregir un borrador.

**Alternativas descartadas:** rechazar la operación hasta borrar primero todos los
descendientes, por el trabajo manual que introduce; deshabilitar en lugar de eliminar,
porque un borrador todavía puede corregirse sin conservar elementos descartados;
reubicar automáticamente las hijas, porque podría crear relaciones incompatibles con
la plantilla.

**Consecuencia:** cancelar la confirmación no cambia ningún elemento y un fallo durante
la eliminación no puede dejar un subárbol parcial. Fuera de `DRAFT` se preservan las
reglas de inmutabilidad y retiro mediante disponibilidad o archivo.

## 32. Modelado estructural sobre la línea base existente

**Decisión:** implementar la administración de plantillas, `scheme`, locations y
settings sobre las tablas ya presentes en `database/01_schema.sql`, sin agregar tablas,
columnas ni una migración para la funcionalidad 003.

Las reglas de varios registros —ciclos, disponibilidad de una ruta, transiciones
completas, copia, borrado de subárboles y cálculo de `leaf_sequence`— se validan en
servicios transaccionales. PostgreSQL conserva las llaves, unicidades, checks y
triggers básicos existentes.

**Motivo:** la línea base ya representa todas las entidades y relaciones requeridas.
El propio modelo documenta que las validaciones que necesitan recorrer el árbol o
coordinar varias escrituras pertenecen al servicio.

**Alternativas descartadas:** crear una tabla adicional de instancias, porque cada
location raíz ya cumple esa función; guardar los árboles como JSON, porque perdería las
garantías relacionales existentes; modificar la línea base o agregar triggers para
toda regla funcional, porque mezclaría coordinación de aplicación con invariantes de
persistencia sin necesidad.

**Consecuencia:** `apps/api/src/database/schema.types.ts` describe ante Kysely cinco
tablas adicionales, pero no se convierte en fuente del esquema. Las operaciones
compuestas deben probar su atomicidad contra PostgreSQL real.

## 33. Consultas de árbol completas y mutaciones REST granulares

**Decisión:** las consultas administrativas de detalle devuelven el árbol completo y
ordenado, mientras que cada escritura identifica el nodo o la location afectada.
Activar, archivar, mover, ordenar, copiar, definir y confirmar un borrado son acciones
explícitas del contrato REST.

**Motivo:** la interfaz necesita el árbol completo para modelar, pero reemplazarlo
entero en cada guardado podría sobrescribir ramas no editadas y haría difícil atribuir
un error al elemento que lo produjo. Las acciones expresan mejor las transiciones y
operaciones atómicas que un cambio parcial genérico.

**Alternativas descartadas:** enviar el árbol completo para cada cambio, por el riesgo
de pérdida y la validación ambigua; exponer cada nivel como un recurso distinto, porque
los nombres son configurables y solo existen los roles `CONTAINER` y `POSITION`;
incorporar GraphQL, porque REST cubre los dos patrones sin otra tecnología.

**Consecuencia:** React envía intenciones pequeñas y vuelve a consultar el detalle
después de mutar. El backend mantiene la autoridad sobre jerarquía, disponibilidad,
orden y `leaf_sequence`; `packages/api-types` comparte únicamente las formas del
contrato.

## 34. Navegación administrativa por flujo de trabajo

**Decisión:** la interfaz administrativa tiene solo dos áreas principales:
**Importaciones** y **Esquemas**. Importaciones reúne la carga de archivos y el
historial. Esquemas reúne los esquemas físicos y las plantillas que necesitan para
modelarse.

La creación de una jerarquía solicita el padre de forma explícita y permite iniciar la
creación desde cualquier contenedor. Al modelar un esquema físico, una sola acción
puede crear varias instancias hermanas con un nombre base y numeración consecutiva.

La identidad visual usa como referencia el sitio de la Biblioteca José Figueres
Ferrer: azul marino `#002855`, turquesa `#008285`, acento rojo `#E4002B`, fondos claros
y tipografía sans serif. La marca propia se presenta sin símbolo, con el nombre **Book
Locator** y el subtítulo **Biblioteca José Figueres Ferrer** en una tipografía
secundaria de menor tamaño. En la cabecera interna ambos textos tienen un tamaño que
permite leerlos con claridad. No se utilizan logotipos institucionales del TEC.

**Motivo:** importación e historial son etapas de un mismo flujo, igual que plantillas
y esquemas físicos. Separarlos como destinos principales aumenta la navegación y
oculta dependencias. La selección implícita del árbol también hacía difícil saber bajo
qué elemento se agregaría una nueva ubicación y obligaba a repetir acciones para crear
estructuras físicas regulares.

**Alternativas descartadas:** mantener cuatro destinos principales, porque expone
entidades técnicas en lugar de tareas; usar únicamente la selección visual del árbol
como padre, porque el contexto de creación no resulta evidente; exigir una operación
por instancia, porque vuelve lenta la construcción de estructuras repetitivas.
Acompañar el nombre con un símbolo propio de libro también se probó y se retiró para
mantener una identidad más sencilla y centrada en el nombre.

**Consecuencia:** las rutas anteriores se conservan como redirecciones de
compatibilidad, pero no aparecen en la navegación. La interfaz sigue usando las
operaciones REST granulares existentes; la creación múltiple coordina varias altas
desde el cliente y vuelve a consultar el árbol al finalizar.

## 35. Redondeo hacia abajo de objetivos en libros

**Decisión:** cuando `capacity_value * target_fill_ratio` produce un valor fraccionario
en unidad `BOOKS`, el objetivo se redondea hacia abajo al entero inmediato inferior.

**Motivo:** los registros son indivisibles y `target_fill_ratio` representa la fracción
máxima que se intenta utilizar. Redondear hacia abajo evita superar ese objetivo por
efecto del redondeo y mantiene el cálculo determinista.

**Alternativas descartadas:** redondear al entero más cercano o hacia arriba, porque en
ambos casos una posición podría superar el porcentaje objetivo antes de aplicar las
reglas explícitas de overflow.

**Consecuencia:** una posición puede reservar una fracción adicional menor a un libro.
Superar el objetivo sigue dependiendo exclusivamente de `allow_overflow` y genera la
advertencia correspondiente.

## 36. Incidencias no bloqueantes al publicar

**Decisión:** las posiciones vacías, sobrecargas y claves divididas de una corrida
`DONE` son advertencias revisables y no bloquean su publicación. Los registros sin
asignar tampoco la bloquean, pero el panel debe mostrar su cantidad y exigir una
confirmación explícita adicional.

**Motivo:** algunas cargas contienen registros sin clave comparable y ciertas
restricciones pueden impedir asignaciones sin invalidar el resto del resultado.
Además, una distribución aproximada puede dejar posiciones vacías, superar un objetivo
permitido o dividir una clave de forma válida. Las combinaciones incoherentes ya
impiden que la corrida alcance `DONE`. Bloquear las incidencias válidas haría
inutilizable una distribución revisada; publicarla silenciosamente ocultaría una
limitación relevante.

**Alternativas descartadas:** bloquear siempre que `unassigned_count` sea mayor que
cero, porque impediría utilizar la parte ubicable; permitir la publicación sin una
confirmación adicional, porque el personal podría omitir involuntariamente el alcance
incompleto del resultado; bloquear sobrecargas, posiciones vacías o claves divididas,
porque son resultados admitidos por el algoritmo y no errores de coherencia.

**Consecuencia:** toda incidencia queda visible durante la revisión. Solo los registros
sin asignar requieren una confirmación adicional. La ubicación pública cubre únicamente
los registros y rangos calculables, conserva su carácter aproximado y no inventa una
posición para lo que quedó fuera.

## 37. Comandos completos y revisión explícita de corridas

**Decisión:** crear y recalcular una corrida son comandos completos. La interfaz prepara
defaults, anchors o rangos manuales y los envía juntos; el servicio valida, congela las
entradas y calcula sin guardar una configuración intermedia incoherente.

Cada corrida tendrá una `revision` entera. Toda mutación posterior debe indicar la
revisión observada. El repositorio bloquea la corrida con `FOR UPDATE NOWAIT`: una fila
ocupada produce un conflicto de operación en curso y una revisión distinta exige
refrescar la vista. Un recálculo correcto incrementa la revisión; uno fallido revierte
la transacción y conserva la revisión y la vista previa anteriores. Un reintento de una
corrida inicial en `ERROR` también exige `expectedRevision`; cada intento terminado
incrementa la revisión porque actualiza el diagnóstico o produce la primera vista
previa válida.

**Motivo:** el estado `PENDING` representa una ejecución, no un formulario parcialmente
guardado. Defaults, anchors, snapshot, rangos y placements se explican entre sí y no
deben quedar mezclados entre solicitudes. Un identificador de revisión evita depender
de la precisión de fechas para detectar una pantalla desactualizada.

**Alternativas descartadas:** guardar defaults y anchors mediante operaciones separadas
antes de calcular, porque permitiría estados intermedios incompatibles; aceptar la
última escritura, porque podría sobrescribir el trabajo de otra persona; usar solo
`finished_at` como versión, porque no representa revisiones ni ofrece un token entero
estable; introducir una cola de trabajos, porque esta primera versión es administrativa,
local y no necesita otra infraestructura para cumplir el tiempo objetivo.

**Consecuencia:** una migración hacia adelante agrega `revision` a
`distribution_runs`. Los contratos de recálculo, revisión y publicación incluyen
`expectedRevision` y devuelven la revisión vigente. La interfaz conserva localmente el
formulario hasta enviar el comando y vuelve a consultar la corrida después de cualquier
mutación o conflicto. Las migraciones usan una conexión de propietario separada de la
conexión de privilegios mínimos de la aplicación.

## 38. Entrega de búsquedas externas a la interfaz mediante redirección segura

**Decisión:** `POST /api/public/search/open` recibe un código de clasificación sin
normalizar y responde `303 See Other` hacia `/buscar?codigo=...` en el origen web
configurado. La interfaz conserva el texto recibido, lo coloca en el buscador y ejecuta
una sola consulta mediante el endpoint público existente.

El destino se construye exclusivamente desde `WEB_ORIGIN`; el body no puede indicar
otra URL. El código se codifica con `URLSearchParams`, la respuesta no se almacena en
caché y utiliza una política de referente restrictiva.

**Motivo:** integraciones como lectores, formularios o sistemas externos necesitan
entregar un código mediante POST y continuar en la experiencia visual sin duplicar la
normalización ni la resolución de ubicaciones. `303` transforma la navegación posterior
en un GET seguro y evita reenviar el body al refrescar la página.

**Alternativas descartadas:** devolver únicamente JSON, porque no lleva al usuario a la
interfaz; aceptar un `returnTo` aportado por el cliente, porque introduciría una
redirección abierta; hacer que el endpoint calcule y renderice otra vista, porque
duplicaría el flujo de búsqueda pública; guardar temporalmente el código en sesión o
base de datos, porque la consulta es pública, acotada y no necesita estado servidor.

**Consecuencia:** el código público aparece codificado en la URL de la interfaz y puede
quedar en el historial local del navegador. La búsqueda sigue siendo anónima y solo
consulta la publicación vigente. Entradas vacías, ambiguas o ajenas al formato
catalográfico no consultan rangos ni inventan una ubicación.

## 39. Validación única para búsquedas públicas y de prueba

**Decisión:** la búsqueda pública y la búsqueda administrativa de prueba comparten una
sola función que acepta únicamente códigos con una lectura catalográfica utilizable.
Una entrada vacía, sin clase numérica, con caracteres ajenos al formato o con segmentos
ambiguos nunca se convierte en una clave de rango.

La búsqueda pública conserva su respuesta `NOT_FOUND`. La búsqueda de prueba responde
`422 VALIDATION_FAILED` con un mensaje explícito y la interfaz lo muestra junto al
campo, eliminando cualquier resultado anterior.

**Motivo:** la prueba debe anticipar fielmente qué aceptará la búsqueda pública, pero el
contexto administrativo permite explicar que el problema está en el código ingresado.
Usar directamente `comparableKey` aceptaba su mejor interpretación incluso cuando el
texto requería revisión humana y podía mostrar una ubicación engañosa.

**Alternativas descartadas:** duplicar expresiones de validación en ambos servicios,
porque volverían a divergir; validar únicamente en React, porque cualquier cliente
podría saltarse la interfaz; responder `NOT_FOUND` también en la prueba, porque no
distinguiría un código inválido de uno válido que no tiene ubicación.

**Consecuencia:** importación y búsqueda tienen criterios distintos ante la ambigüedad:
la importación conserva la fila y la marca para revisión, mientras una consulta
ambigua no produce ubicación. Las variaciones deterministas documentadas, como espacios,
comas y guiones, continúan normalizándose.
