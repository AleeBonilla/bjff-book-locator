# Investigación: Carga administrativa inicial de la colección

**Fecha**: 2026-07-30 | **Spec**: [spec.md](spec.md)

El stack quedó fijado por la persona responsable del proyecto: monorepo TypeScript,
React con Vite, Tailwind, NestJS con REST, PostgreSQL en Docker y Vitest. Este
documento resuelve las decisiones que ese encuadre no fija y que sí condicionan la
implementación.

Criterio transversal: primera versión, simplicidad inicial, y el principio II de la
constitución —una abstracción se justifica por un caso concreto existente, no por uno
previsto—.

## 1. Acceso a la base de datos

**Decisión**: consultas con [Kysely](https://kysely.dev) sobre el controlador `pg`.

**Motivo**: `database/*.sql` ya existe y la constitución lo declara fuente de verdad de
la estructura implementada. Se necesita una capa que *use* ese esquema sin pretender
poseerlo. Kysely es un constructor de consultas con tipos: no genera migraciones, no
sincroniza esquemas y no impone convenciones sobre las tablas. Además parametriza
siempre, que es lo que exige FR-045 y el principio VI.

El esquema usa elementos que un ORM tradicional maneja mal: llaves foráneas
compuestas, índices únicos parciales, columnas `COLLATE "C"` y tipos enumerados
propios. Kysely no los interpreta; simplemente ejecuta el SQL que se le describe.

**Alternativas consideradas**:

- *Prisma*: excelente ergonomía, pero su modelo de trabajo pasa por poseer el esquema y
  su propio historial de migraciones. Chocaría con los principios VII y X.
- *TypeORM*: es el ORM idiomático de NestJS, pero es pesado para diez consultas y su
  modo `synchronize` es un riesgo permanente sobre un esquema escrito a mano.
- *`pg` a secas*: la opción más simple en dependencias. Se descartó porque la seguridad
  de tipos en las consultas del importador —el módulo clave del principio V— aporta más
  de lo que cuesta una dependencia pequeña.

## 2. Inserción masiva de registros

**Decisión**: `INSERT` de múltiples filas por lotes de 1000, dentro de una única
transacción.

**Motivo**: SC-006 exige que 10 000 filas terminen en menos de 30 segundos y FR-026a
las procesa de forma síncrona. Insertar fila por fila son 10 000 viajes de ida y vuelta
y no alcanza el objetivo. Un `INSERT` de 1000 filas reduce eso a diez sentencias, muy
por debajo del presupuesto, y mantiene la atomicidad que exige FR-028.

**Alternativas consideradas**:

- *`COPY FROM`*: es el camino más rápido, pero exige serializar a un formato
  intermedio y complica el manejo por fila de errores y marcas de revisión, que esta
  funcionalidad necesita. La ventaja de velocidad no hace falta para este volumen.
- *Inserción fila por fila*: descartada por rendimiento.

## 3. Almacenamiento de la sesión

**Decisión**: sesión del lado del servidor en memoria del proceso, con cookie
`httpOnly`, `SameSite=Lax` y `Secure` fuera de desarrollo.

**Motivo**: FR-003 exige invalidar la sesión de inmediato al cerrarla. Un token
autocontenido tipo JWT no permite eso sin una lista de revocación, que es justamente la
maquinaria que una primera versión no necesita. Una sesión del lado del servidor la
invalida borrando una entrada.

Se eligió memoria del proceso en lugar de una tabla porque el esquema vigente no tiene
tabla de sesiones y añadirla obligaría a una migración y a actualizar `docs/db.md` por
un beneficio que esta versión no cosecha.

**Consecuencias aceptadas, a registrar como límite conocido**:

- el backend corre como una sola instancia;
- al reiniciar el servicio las sesiones se pierden y hay que volver a entrar.

Ambas son tolerables para un panel administrativo interno con pocas cuentas. Cuando
alguna deje de serlo, la salida es una tabla de sesiones o un almacén externo, sin
tocar el resto del diseño.

**Alternativas consideradas**:

- *JWT en cookie `httpOnly`*: sin estado, pero incompatible con la invalidación
  inmediata de FR-003 salvo con lista de revocación.
- *Sesiones en PostgreSQL*: sobreviven al reinicio y permiten varias instancias, a
  costa de una migración y de mantenimiento del esquema que hoy nada exige.

## 4. Hash de contraseñas

**Decisión**: `scrypt` del módulo `node:crypto`, con sal por cuenta y parámetros
explícitos, comparando con `timingSafeEqual`.

**Motivo**: es una función de derivación de claves reconocida, viene en el núcleo de
Node y no requiere compilación nativa. Cero dependencias nuevas y cero fricción de
instalación, incluido Windows, que es el entorno de desarrollo actual.

**Alternativas consideradas**:

- *argon2*: es la primera recomendación de OWASP y sería la elección si hubiera que
  optar solo por robustez. Se descartó para la primera versión por el módulo nativo y
  su compilación. Sustituirlo después es un cambio local a la función de hash.
- *bcrypt / bcryptjs*: ampliamente usado, pero `bcrypt` compila y `bcryptjs` es
  notablemente lento en JavaScript puro.

## 5. Lectura del CSV

**Decisión**: `csv-parse`, configurado con `bom: true`, `delimiter: ';'`,
`quote: '"'` y `relax_column_count: true`.

**Motivo**: FR-008b prohíbe repartir las filas por el carácter delimitador, porque los
campos entrecomillados lo contienen. Hace falta un lector que respete comillas, y
`csv-parse` es el estándar del ecosistema Node. Resuelve además el BOM de FR-009 y
tolera CRLF y LF, como pide FR-008a.

`relax_column_count` permite que una fila con número de campos distinto llegue al
código en lugar de abortar la lectura, que es lo que necesita FR-039 para marcarla
`REJECTED` y continuar.

**Alternativas consideradas**:

- *`papaparse`*: orientado al navegador; no aporta ventajas en el servidor.
- *Lector propio*: descartado. El entrecomillado con delimitadores internos es
  precisamente donde una implementación casera falla.

## 6. Herramienta del monorepo

**Decisión**: workspaces de npm.

**Motivo**: vienen con Node, no añaden herramienta ni configuración, y bastan para
cuatro paquetes con dependencias internas simples. El principio II pide no incorporar
maquinaria sin un caso que la justifique.

**Alternativas consideradas**:

- *pnpm workspaces*: instalación más rápida y enlazado más estricto. Es la mejora
  natural si el número de paquetes crece.
- *Turborepo o Nx*: resuelven orquestación y caché de tareas, problemas que este
  repositorio todavía no tiene.

## 7. Migraciones

**Decisión**: los tres scripts de `database/` son la línea base y se aplican en orden;
los cambios posteriores van como archivos SQL numerados en `database/migrations/`,
aplicados por `node-pg-migrate` y registrados en una tabla de control.

**Motivo**: el principio VII exige migraciones ordenadas y aplicables hacia adelante
una vez que el esquema vive en un entorno compartido. Mantener las migraciones en SQL
plano conserva la coherencia con la línea base, que también es SQL plano, y evita
introducir un lenguaje intermedio.

Esta funcionalidad no necesita ninguna migración: usa el esquema tal como está. La
herramienta se deja instalada y probada para que el primer cambio real de persistencia
no tenga que inventar el mecanismo.

**Alternativas consideradas**:

- *Runner propio*: unas cuarenta líneas, pero hay que escribirlo y probarlo.
- *Migraciones de un ORM*: descartado junto con el ORM, por la decisión 1.

## 8. Aplicación del esquema en desarrollo

**Decisión**: `docker compose` con PostgreSQL 16, montando `database/*.sql` en
`docker-entrypoint-initdb.d` para que se apliquen en orden al crear el volumen.

**Motivo**: reproduce el arranque documentado en el README sin scripts adicionales. El
orden alfabético de los archivos coincide con el orden de ejecución exigido.

Se aplica la línea base completa, no solo las tablas de esta funcionalidad. Los tres
scripts son internamente dependientes —los triggers y las llaves foráneas se
referencian entre sí— y recortarlos produciría un esquema distinto del documentado,
contra el principio X. Esta funcionalidad simplemente usa cuatro de sus tablas.

PostgreSQL 16 satisface el mínimo de 15 que fija la constitución.

## 9. Aprovisionamiento de cuentas

**Decisión**: script del workspace del backend que crea una cuenta ADMIN leyendo
usuario y contraseña de variables de entorno.

**Motivo**: la especificación asume que las cuentas se crean fuera de la aplicación y
excluye su administración. Hace falta un camino para que exista la primera cuenta.

La contraseña nunca se escribe en el repositorio ni se registra en la salida del
script, conforme a FR-007 y al principio VI.

## 10. Validación de entrada y accesibilidad

**Decisión**: `ValidationPipe` de NestJS con `class-validator` en el backend; en el
frontend, HTML semántico con etiquetas asociadas, gestión de foco y anuncio de errores,
sin biblioteca de componentes.

**Motivo**: FR-045 exige validar en el servidor con independencia de la interfaz;
`class-validator` es el camino idiomático de NestJS y no añade conceptos nuevos.

Del lado visual, esta funcionalidad tiene un formulario de acceso, un selector de
archivo, una tabla y una vista de detalle. Todo eso se construye con elementos nativos
correctamente etiquetados, que es la base de la accesibilidad. Incorporar una
biblioteca de primitivas sería complejidad sin un caso que la pida; queda como opción
cuando aparezcan componentes que el HTML nativo no cubra.

## 11. Estrategia de pruebas

**Decisión**: Vitest en todos los paquetes. Pruebas unitarias sin base de datos para la
normalización de códigos; pruebas de integración contra PostgreSQL en Docker para la
importación, vaciando las tablas de la funcionalidad antes de cada caso.

> **Corregido durante la implementación.** El plan preveía aislar cada caso en una
> transacción revertida al terminar. No es viable: las pruebas atraviesan HTTP y la
> aplicación abre su propia conexión, así que no puede participar de la transacción del
> test. Se sustituyó por `TRUNCATE ... RESTART IDENTITY CASCADE` antes de cada caso, con
> los archivos ejecutados en serie (`fileParallelism: false` en la configuración raíz de
> Vitest, donde sí surte efecto: por proyecto se ignora).
>
> **Base separada.** Vaciar tablas obliga a que las pruebas tengan su propia base. Se
> añadió `bjff_test`, creada por `docker/initdb/99_setup.sh` con la misma línea base y
> apuntada por `TEST_DATABASE_URL`. Compartirla con desarrollo borraba las cargas y la
> cuenta administrativa en cada corrida. El arnés aborta si esa variable no apunta a una
> base cuyo nombre termine en `_test`: es la salvaguarda contra un `.env` mal
> configurado.

**Motivo**: el principio V exige pruebas automatizadas en los módulos clave, y nombra
la normalización y el orden de los códigos de clasificación. Ese módulo es puro y se
prueba sin infraestructura, lo que permite cubrir con detalle los pares de orden y
equivalencia de `docs/clasificacion.md`.

La importación, en cambio, solo se demuestra de extremo a extremo: contadores,
atomicidad y colación dependen de la base real. Revertir la transacción de cada caso
mantiene las pruebas aisladas sin recrear el esquema entre ellas.

`bjff-collection-example.csv` es el archivo de prueba. SC-002 fija sus contadores
esperados. `bjff-collection.csv` y `docs/dataset.md` no se usan en pruebas ni se
copian a ningún artefacto.

**Alternativas consideradas**:

- *Testcontainers*: levanta y destruye la base por ejecución, con aislamiento perfecto.
  Se descartó para la primera versión porque `docker compose` ya está en el flujo de
  desarrollo y añadir otra vía de arranque no aporta todavía.
- *Base en memoria o simulada*: inservible aquí. El orden con colación `C` y las
  restricciones del esquema son justo lo que hay que verificar.
