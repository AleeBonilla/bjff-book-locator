<!--
Sync Impact Report
==================
Version change: (plantilla sin ratificar) → 1.0.0
Bump rationale: primera ratificación. El archivo contenía únicamente marcadores
de posición sin contenido normativo; se define el conjunto completo de
principios y el régimen de gobernanza.

Principios definidos (10):
  I.    Documentación directa
  II.   Simplicidad antes que abstracción
  III.  Separación de responsabilidades
  IV.   Especificación antes de implementación
  V.    Calidad verificable en módulos clave
  VI.   Seguridad por defecto
  VII.  Evolución segura de los datos
  VIII. Interfaz reemplazable y consistente
  IX.   Observabilidad no bloqueada
  X.    `docs/` como contexto oficial

Secciones añadidas:
  - Restricciones del proyecto (reemplaza [SECTION_2_NAME])
  - Flujo de trabajo y puertas de calidad (reemplaza [SECTION_3_NAME])

Secciones eliminadas: ninguna.

Plantillas y artefactos dependientes:
  ✅ .specify/templates/plan-template.md   — Constitution Check concretado
  ✅ .specify/templates/tasks-template.md  — regla de pruebas alineada con el
                                             principio V; fase de cierre alineada
                                             con los principios VII y X
  ✅ .specify/templates/spec-template.md   — revisado; sin conflictos, sin cambios
  ✅ README.md                             — ya enlaza esta constitución
  ✅ docs/README.md                        — ya enlaza esta constitución
  ✅ .claude/skills/speckit-*/SKILL.md     — revisados; sin referencias obsoletas

TODO diferidos: ninguno.
-->

# Constitución de BJFF Book Locator

Este documento define las reglas de gobernanza del localizador de libros de la
Biblioteca José Figueres Ferrer. Prevalece sobre cualquier otra práctica,
convención o preferencia individual del proyecto.

Las palabras **DEBE**, **NO DEBE** y **DEBERÍA** son normativas. **DEBE** y
**NO DEBE** expresan obligaciones cuyo incumplimiento bloquea la aceptación de un
cambio. **DEBERÍA** expresa una recomendación fuerte: apartarse de ella exige
justificación escrita en el cambio correspondiente.

## Core Principles

### I. Documentación directa

La documentación y los comentarios DEBEN ser claros, directos y proporcionales a
lo que explican.

- Un documento DEBE tener una sola responsabilidad principal.
- Un comentario DEBE explicar por qué existe una decisión, no repetir lo que el
  código ya dice.
- NO DEBE agregarse texto de relleno, repetición entre documentos ni
  reformulaciones de una regla ya definida en otro archivo.
- Una regla vive en un único documento; los demás la enlazan.

**Razón:** la duplicación de reglas produce contradicciones silenciosas. Un texto
inflado esconde las decisiones reales entre material accesorio.

### II. Simplicidad antes que abstracción

La solución más simple que satisface el requisito DEBE preferirse.

- Una abstracción DEBE justificarse por un caso concreto ya existente, no por uno
  previsto.
- NO DEBE introducirse una capa, un patrón ni una dependencia sin registrar qué
  alternativa más simple se descartó y por qué.
- La duplicación puntual es preferible a una abstracción prematura equivocada.

**Razón:** este sistema ya modela una realidad física heterogénea e incierta. La
complejidad accidental sobre complejidad esencial vuelve el resultado imposible
de revisar.

### III. Separación de responsabilidades

Cada componente DEBE tener un límite explícito y una única razón para cambiar.

- La lógica de dominio NO DEBE residir en la interfaz ni en los controladores.
- La persistencia NO DEBE contener reglas de negocio más allá de las invariantes
  que protege la base de datos.
- Las separaciones ya establecidas por el modelo DEBEN conservarse: estructura
  física, configuración, cálculo y resultados publicados tienen ciclos de vida
  distintos y no se mezclan.

**Razón:** la separación entre estructura y distribución es la decisión central
del diseño. Perderla en el código anula las garantías del modelo de datos.

### IV. Especificación antes de implementación

Toda funcionalidad DEBE tener una especificación aprobada antes de implementarse.

- El orden de trabajo DEBE ser: especificación, plan, tareas, implementación.
- Una especificación DEBE indicar precondiciones, comportamiento esperado,
  validaciones y resultados observables.
- Un punto no resuelto DEBE registrarse explícitamente como pendiente en lugar de
  decidirse durante la implementación.
- Un cambio de comportamiento acordado DEBE actualizar la especificación
  correspondiente en el mismo cambio.

**Razón:** las decisiones tomadas dentro del código no quedan registradas ni
pueden revisarse. Este proyecto define su comportamiento antes de escribirlo.

### V. Calidad verificable en módulos clave

Los módulos clave DEBEN tener pruebas automatizadas que se ejecuten sin
intervención manual.

Son módulos clave, como mínimo:

- la normalización y el orden de los códigos de clasificación;
- el algoritmo de distribución y sus contratos por estrategia;
- la resolución de configuración efectiva y su precedencia;
- la publicación y activación transaccionales;
- la resolución de una búsqueda pública.

Reglas:

- Una prueba DEBE fallar de forma reproducible ante la regresión que vigila.
- El orden determinista de los códigos de clasificación DEBE estar cubierto por
  pruebas antes de que cualquier módulo dependa de él.
- Los módulos fuera de esta lista DEBERÍAN tener pruebas donde el costo de un
  error justifique su mantenimiento.
- La cobertura total NO DEBE usarse como criterio de aceptación.

**Razón:** el valor del sistema depende de comparaciones deterministas y de un
cálculo reproducible. Sin pruebas, una regresión en el orden es indetectable
hasta que el resultado público ya es incorrecto.

### VI. Seguridad por defecto

El comportamiento seguro DEBE ser el predeterminado, no una opción de despliegue.

- El backend DEBE operar con el mínimo privilegio necesario, incluido el usuario
  de base de datos.
- Los secretos NO DEBEN incluirse en el repositorio, en el historial, en los
  ejemplos ni en los registros. Se leen de la configuración del entorno.
- Toda entrada externa DEBE validarse en el servidor antes de usarse, incluidas
  las que ya valida la interfaz.
- Las consultas DEBEN usar parámetros; la concatenación de SQL con datos de
  entrada NO DEBE utilizarse.
- El material privado de la BJFF DEBE tratarse según la sección
  «Restricciones del proyecto».
- Una operación administrativa DEBE exigir autenticación; la búsqueda pública NO
  DEBE requerirla.

**Razón:** el sistema custodia material de un tercero y expone una superficie
pública. Un valor predeterminado inseguro se convierte en la configuración real.

### VII. Evolución segura de los datos

Todo cambio del esquema aplicado DEBE realizarse mediante migraciones
versionadas.

- Los scripts `database/01_schema.sql`, `02_functions_triggers.sql` y
  `03_views.sql` son la línea base del esquema.
- Una vez aplicado el esquema en un entorno compartido, un cambio de persistencia
  DEBE expresarse como una migración ordenada y aplicable hacia adelante; NO DEBE
  editarse la línea base como si nunca se hubiera aplicado.
- Una migración DEBE ser reproducible y su orden de aplicación DEBE ser explícito.
- Un cambio de persistencia DEBE actualizar `docs/db.md` en el mismo cambio.
- Una migración destructiva DEBE indicar qué dato se pierde y por qué es
  aceptable.

**Razón:** el modelo conserva historial versionado de distribuciones. Un cambio
de esquema no rastreable rompe la trazabilidad que justifica ese historial.

### VIII. Interfaz reemplazable y consistente

La interfaz DEBE poder reestructurarse o sustituirse sin reescribir el dominio.

- La interfaz NO DEBE contener reglas de negocio, cálculos de ubicación ni
  normalización de códigos; los consume del servicio.
- La comunicación con el backend DEBE realizarse mediante contratos explícitos.
- Los componentes DEBEN ser consistentes entre sí en terminología, estados y
  tratamiento de errores.
- La interfaz DEBE comunicar la ubicación como aproximada en todos los casos.

**Razón:** la presentación cambiará más veces que el dominio. Si las reglas se
filtran a la interfaz, cada rediseño se convierte en un riesgo funcional.

### IX. Observabilidad no bloqueada

El diseño DEBE dejar abierta la incorporación posterior de un sistema de
observabilidad.

- Los errores DEBEN propagarse con contexto suficiente para diagnosticarlos; NO
  DEBEN silenciarse.
- Las operaciones largas —importación, cálculo y publicación— DEBEN registrar
  inicio, fin y resultado de forma estructurada y correlacionable.
- Los registros NO DEBEN contener secretos ni material privado de la colección.
- No se exige instrumentación completa en esta primera funcionalidad, pero
  ninguna decisión de diseño DEBE impedirla después.

**Razón:** la instrumentación temprana sería complejidad prematura; una
arquitectura que la imposibilita sería una deuda permanente.

### X. `docs/` como contexto oficial

La carpeta `docs/` es el contexto oficial del proyecto.

- Una decisión de diseño, una regla de dominio o un motivo DEBEN registrarse en
  `docs/` para considerarse vigentes.
- El SQL de `database/` es la fuente de verdad de la estructura implementada;
  `docs/db.md` la explica sin reemplazarla.
- Ante un conflicto entre `docs/` y otra fuente informal, prevalece `docs/`, y el
  conflicto DEBE resolverse actualizando el documento correspondiente.
- Las responsabilidades y reglas de mantenimiento de cada documento están en
  `docs/README.md` y desarrollan esta constitución.

**Razón:** un proyecto en fase de diseño se sostiene por su documentación. Una
decisión que solo existe en una conversación no puede revisarse ni heredarse.

## Restricciones del proyecto

**Terminología.** El término **códigos de clasificación** DEBE usarse de forma
consistente en documentación, código, interfaz y especificaciones.

**Idioma.** La documentación, las especificaciones y el texto visible para la
persona usuaria DEBEN escribirse en español. Los identificadores de código, los
nombres de tablas y columnas y los valores de los tipos enumerados se mantienen
en inglés, según la convención ya establecida en `database/`.

**Persistencia.** El sistema DEBE ejecutarse sobre PostgreSQL 15 o superior. Los
scripts de la línea base se aplican en orden y cada uno supone que el anterior
terminó correctamente.

**Determinismo del orden.** Las claves comparables DEBEN almacenarse y compararse
con colación `C`. La importación, la distribución y la búsqueda DEBEN usar la
misma función de normalización y el mismo orden.

**Resultado público.** Ninguna salida DEBE presentarse como ubicación confirmada.
El sistema no verifica la presencia física de un ejemplar.

**Material privado.** `bjff-collection.csv` y `docs/dataset.md` son material
privado de la Biblioteca José Figueres Ferrer.

- NO DEBEN publicarse ni incluirse en commits, issues, entregables,
  redistribuciones, registros ni ejemplos.
- El acceso DEBE aprobarse previamente por la persona responsable del repositorio
  y exige ser asistente de la BJFF o persona contribuidora autorizada por la
  BJFF.
- El desarrollo general DEBE usar `bjff-collection-example.csv`.

**Alcance de la primera funcionalidad.** Las exclusiones registradas en
`docs/flujo.md` DEBEN respetarse. Ampliar el alcance exige actualizar antes ese
documento.

## Flujo de trabajo y puertas de calidad

**Ciclo de trabajo.** Una funcionalidad recorre: `/speckit-specify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Ninguna etapa DEBE
omitirse ni adelantarse.

**Puertas de aceptación.** Un cambio no se acepta si:

1. contradice un principio de esta constitución sin justificación registrada;
2. modifica el comportamiento sin actualizar la especificación afectada;
3. modifica la persistencia sin migración o sin actualizar `docs/db.md`;
4. altera un módulo clave sin pruebas automatizadas que cubran el cambio;
5. introduce una abstracción sin registrar la alternativa más simple descartada;
6. incluye secretos o material privado de la BJFF;
7. rompe el orden determinista de los códigos de clasificación;
8. presenta una ubicación como confirmada.

**Justificación de la complejidad.** Una desviación DEBE registrarse en el plan
de la funcionalidad, indicando qué principio se tensiona, por qué es necesario y
qué alternativa más simple se descartó. Una desviación no registrada se trata
como incumplimiento.

**Revisión.** Toda revisión DEBE verificar explícitamente el cumplimiento de esta
constitución y de las reglas de mantenimiento de `docs/README.md`.

## Governance

**Autoridad.** Esta constitución prevalece sobre cualquier otra práctica del
proyecto. Ante un conflicto entre este documento y otro artefacto, prevalece esta
constitución y el otro artefacto DEBE corregirse.

**Enmiendas.** Una enmienda DEBE:

1. proponerse como un cambio explícito sobre este archivo;
2. indicar qué principio o sección se agrega, modifica o elimina, y por qué;
3. actualizar en el mismo cambio los artefactos dependientes afectados
   —plantillas de `.specify/templates/`, `README.md` y `docs/`—;
4. registrar el impacto en el informe de sincronización del encabezado.

**Versionado.** La versión sigue el formato `MAJOR.MINOR.PATCH`:

- **MAJOR:** se elimina o redefine un principio de forma incompatible con la
  práctica anterior.
- **MINOR:** se agrega un principio o sección, o se amplía materialmente una
  guía existente.
- **PATCH:** aclaraciones, redacción o correcciones sin cambio semántico.

**Cumplimiento.** El cumplimiento se verifica en cada revisión mediante las
puertas de aceptación de la sección anterior. Un incumplimiento detectado después
de aceptarse DEBE corregirse o registrarse como desviación justificada; no se
normaliza por precedente.

**Guía operativa.** Para el detalle del comportamiento acordado se usa
`docs/flujo.md`; para el fundamento de las decisiones, `docs/decisiones.md`; para
la persistencia, `docs/db.md` junto con los scripts de `database/`.

**Version**: 1.0.0 | **Ratified**: 2026-07-30 | **Last Amended**: 2026-07-30
