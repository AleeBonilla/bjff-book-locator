# Investigación: Distribución y búsqueda pública

**Fecha**: 2026-08-03 | **Spec**: [spec.md](spec.md)

La investigación contrasta la especificación 004 con el esquema SQL y los módulos ya
implementados. No usa el dataset privado ni introduce otro stack.

## 1. Stack y límites del módulo

**Decisión**: conservar TypeScript 5.7 y Node.js 20 en el monorepo de npm, NestJS 11
con Kysely y PostgreSQL para la API, React 19 con React Router, Vite y Tailwind para la
interfaz, tipos REST en `packages/api-types` y Vitest con Supertest para pruebas.

La API agrega un solo módulo `distribution`. El controlador traduce HTTP, el servicio
coordina casos de uso, el repositorio concentra SQL y funciones puras resuelven
configuración, estrategias, rangos e incidencias. La búsqueda pública reutiliza el mismo
módulo, pero su controlador se marca explícitamente con `@Public()`.

**Motivo**: es la arquitectura vigente y ya ofrece validación, transacciones, errores
uniformes, autenticación por defecto y registro estructurado.

**Alternativas consideradas**:

- Crear `packages/distribution`: descartado porque solo la API ejecuta el algoritmo.
- Incorporar un ORM o una cola: descartado porque Kysely y la ejecución administrativa
  sincrónica cubren el alcance sin otra infraestructura.
- Separar administración y búsqueda en módulos de dominio distintos: descartado porque
  deben compartir la resolución de ubicaciones y la regla de aproximación.

## 2. Persistencia y evolución

**Decisión**: reutilizar `distribution_runs`, `distribution_position_inputs`,
`distribution_anchors`, `distribution_ranges`, `book_placements` y `location_paths`.
No se agregan tablas. Una migración SQL ordenada agrega a `distribution_runs`:

```sql
revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
```

La línea base no se reescribe. La implementación actualizará `docs/db.md` junto con la
migración y ampliará `schema.types.ts` para describir todas las tablas de distribución
y la vista de rutas. Como la conexión normal pertenece al rol de aplicación y no puede
alterar el esquema, `.env.example` declarará `MIGRATION_DATABASE_URL` para el
propietario. El script `migrate` usará esa variable y `migrate:test` aplicará las mismas
migraciones a `TEST_DATABASE_URL` antes de la suite de integración.

**Motivo**: el modelo existente ya separa entradas, restricciones y resultados. Solo
falta un token estable para rechazar escrituras basadas en una vista desactualizada.
Las incidencias pueden derivarse de snapshot y resultados, por lo que una tabla de
alertas duplicaría datos.

**Alternativas consideradas**:

- Usar `finished_at` como token: descartado porque no versiona revisiones ni
  publicaciones y una fecha no es un contador de concurrencia inequívoco.
- Ejecutar migraciones con `DATABASE_URL`: descartado porque ese usuario conserva solo
  privilegios de lectura y escritura de datos por diseño.
- Persistir incidencias: descartado porque posiciones vacías, sobrecargas y claves
  divididas son proyecciones reproducibles.
- Guardar propuestas manuales inválidas: descartado; los rangos solo se convierten en
  resultados después de validar y un recálculo fallido conserva el último conjunto
  válido.

## 3. Resolución de configuración

**Decisión**: una función pura recibe el árbol utilizable, settings, defaults de nodos
y defaults de corrida. Recorre cada `POSITION` por `leaf_sequence` y resuelve cada
campo con la precedencia de la especificación. Capacidad y unidad se toman siempre del
mismo nivel. El resultado incluye el valor y su origen, que se serializa en
`distribution_position_inputs.resolution`.

**Motivo**: la resolución es una regla de dominio clave, debe poder probarse sin base de
datos y debe producir un snapshot explicable.

**Alternativas consideradas**:

- Resolver con una consulta SQL recursiva: descartado porque mezclaría precedencia de
  dominio con persistencia y sería más difícil probar los casos por campo.
- Reutilizar los valores visibles del editor React: descartado porque la interfaz no es
  autoridad y puede estar desactualizada.

## 4. Comando de cálculo y concurrencia

**Decisión**: `POST /api/distribution-runs` recibe todos los datos necesarios para
crear y calcular. Primero persiste la cabecera `PENDING`; luego una transacción crea el
snapshot y anchors, ejecuta el algoritmo y escribe rangos, placements, contadores y
`DONE`. Si ese primer cálculo falla, la transacción elimina cualquier resultado parcial
y una actualización posterior deja la cabecera en `ERROR` con diagnóstico general.

El recálculo recibe el conjunto completo de cambios y `expectedRevision`. Dentro de
una sola transacción toma la fila con `FOR UPDATE NOWAIT`, verifica estado, publicación
y revisión, marca `PENDING`, reconstruye entradas y reemplaza resultados. Un error
revierte también el cambio a `PENDING`; la vista previa anterior queda intacta. Una
fila bloqueada responde `RUN_BUSY` y una revisión distinta responde
`RUN_VERSION_CONFLICT`.

Una corrida inicial en `ERROR` puede usar el mismo comando completo de recálculo. El
servicio conserva `scheme`, carga y estrategia. Un éxito crea la primera vista previa e
incrementa la revisión. Un nuevo fallo elimina cualquier resultado parcial, mantiene
`ERROR`, actualiza el diagnóstico e incrementa la revisión, porque no existe una vista
previa válida que deba restaurarse.

**Motivo**: el comando completo evita configuraciones parcialmente guardadas. El
bloqueo sin espera rechaza un cálculo simultáneo y la revisión detecta una pantalla
obsoleta sin depender del momento exacto de una fecha.

**Alternativas consideradas**:

- Varias operaciones para guardar defaults y anchors: descartado porque permitiría
  combinaciones intermedias que nunca produjeron la vista previa mostrada.
- Mantener `PENDING` visible mediante varias transacciones durante un recálculo:
  descartado porque exigiría compensaciones para restaurar la corrida ante un fallo.
- Esperar el bloqueo: descartado porque una segunda persona necesita una respuesta
  inmediata para refrescar, no otra ejecución en cola.

## 5. Motor determinista de distribución

**Decisión**: el motor opera sobre objetos simples, sin Kysely ni NestJS. Recibe libros
ordenados por `comparable_key COLLATE "C"`, posiciones congeladas, anchors y, para
`MANUAL`, rangos propuestos. Devuelve placements, rangos e incidencias antes de que el
repositorio escriba nada.

El motor se divide en funciones pequeñas para:

- validar el contrato de cada estrategia;
- agrupar registros por clave sin perder el orden por `book_id`;
- segmentar posiciones y grupos mediante anchors;
- calcular objetivos en `BOOKS` con `Math.floor` o pesos proporcionales;
- asignar grupos, overflow y divisiones consecutivas;
- validar cobertura manual y derivar placements;
- construir rangos semiabiertos desde `''` hasta `~`;
- derivar posiciones vacías, sobrecargas y claves divididas.

**Motivo**: todas las estrategias comparten orden, agrupamiento y salidas, pero sus
entradas permitidas son diferentes. Un motor puro hace reproducibles las invariantes y
permite pruebas exhaustivas de casos límite.

**Alternativas consideradas**:

- Un servicio o clase por estrategia: descartado porque duplicaría el recorrido y las
  invariantes antes de existir comportamientos independientes suficientes.
- Calcular con SQL: descartado porque overflow, salto de posiciones y división de
  grupos son reglas secuenciales más claras y comprobables en TypeScript.

## 6. Publicación y búsqueda

**Decisión**: publicar es una transacción que bloquea la corrida, el `scheme` objetivo
y el `scheme` activo; valida `expectedRevision`, `DONE`, aceptación de vista previa y
la confirmación adicional cuando hay no asignados. Luego desactiva y despublica la
versión anterior, publica la elegida, activa su `scheme` e incrementa la revisión. Los
índices parciales existentes permanecen como barrera ante carreras. Toda corrida cuyo
estado de publicación cambie incrementa su propia revisión.

La búsqueda pública normaliza con `@bjff/classification`. En una sola consulta lógica
selecciona el `scheme` activo y su corrida publicada. Si la carga contiene coincidencias
exactas, devuelve solo las rutas distintas de sus placements; si no existen
coincidencias exactas, consulta el rango semiabierto. Nunca cae a rangos para ocultar
que una coincidencia exacta quedó sin asignar.

**Motivo**: una transacción PostgreSQL ofrece el cambio atómico que exige la consulta
pública. La precedencia exacta conserva la semántica definida en `docs/flujo.md`.

**Alternativas consideradas**:

- Copiar resultados a una tabla pública: descartado porque duplicaría versiones y
  abriría una ventana de inconsistencia.
- Buscar siempre por rangos: descartado porque perdería las múltiples posiciones de
  ejemplares con la misma clave.

## 7. Contratos e interfaz

**Decisión**: ampliar `packages/api-types` con tipos de corridas, entradas, rangos,
incidencias, comparación y búsqueda. Los controladores administrativos permanecen
protegidos por la guarda global. Solo `POST /api/public/search` usa `@Public()` y su
respuesta omite identificadores y metadatos administrativos innecesarios.

La API expone una plantilla de derivación calculada por el backend. Esta proyección
incluye estrategia, parámetros, defaults, anchors y rangos manuales aplicables, permite
elegir una carga terminada y excluye snapshots, placements y rangos calculados. La
interfaz puede modificarla, pero crea la corrida con el comando completo normal.

La administración de distribuciones aparece como una subsección dentro de
**Esquemas**, sin crear una tercera área principal. La ruta `/buscar` es pública y se
renderiza antes de exigir sesión; `/` dirige a esa búsqueda. El panel conserva los
colores y componentes actuales, no usa logotipos institucionales, flechas tipográficas
ni guiones largos, y etiqueta siempre el resultado como ubicación aproximada.

**Motivo**: mantiene la navegación acordada y evita que React replique validaciones o
cálculos del backend.

## 8. Verificación y operación

**Decisión**: cubrir con Vitest unitario el resolutor y el motor; con pruebas de
integración seriales sobre PostgreSQL real los contratos, atomicidad, concurrencia,
publicación y búsqueda; y con una prueba de rendimiento una carga sintética de 100.000
registros y 1.000 posiciones. Otra prueba de rendimiento mide la búsqueda pública y
comprueba que al menos el 95 % de las respuestas termina en menos de 1 segundo bajo la
carga operativa sintética definida. No se usa la colección privada.

Los cálculos y publicaciones registran evento de inicio y fin, duración, identificador
de corrida, conteos y desenlace. Los logs no incluyen códigos, títulos, autores,
barcodes, rangos ni contenido de filas.

**Motivo**: algoritmo, configuración, publicación y búsqueda son módulos clave según
la constitución. PostgreSQL real es necesario para comprobar locks, colación, llaves e
isolación transaccional.
