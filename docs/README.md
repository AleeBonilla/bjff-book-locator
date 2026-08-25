# Índice de documentación

Índice canónico de los contratos bibliográficos, el flujo de aplicación y el esquema PostgreSQL V1. El repositorio aún no contiene una aplicación desplegable.

## Orden de lectura

Lea los contratos en este orden cuando una decisión atraviese todo el sistema:

1. [`classification-ordering.md`](classification-ordering.md): define qué relación bibliográfica debe cumplirse.
2. [`normalization.md`](normalization.md): convierte texto y metadatos de origen en componentes inequívocos.
3. [`comparable_key.md`](comparable_key.md): codifica esos componentes en bytes que preservan el orden.
4. [`database/database-v1.md`](database/database-v1.md): persiste perfiles, ubicaciones, rangos y mapas.
5. [`workflows/application-workflow-v1.md`](workflows/application-workflow-v1.md): integra esos contratos en el flujo completo de la aplicación.

## Registro documental

| Documento | Úselo cuando necesite | Autoridad principal |
|---|---|---|
| [Ordenamiento de signaturas](classification-ordering.md) | Determinar precedencia, equivalencia o decisiones bibliográficas abiertas. | Especificación `CO` vigente; fuentes bibliográficas citadas justifican sus reglas. |
| [Normalización](normalization.md) | Implementar parsing, validar entradas o definir el JSON normalizado. | Especificación `NORM`, limitada por `CO`. |
| [Clave comparable](comparable_key.md) | Implementar `ck1`, ordenar, paginar, consultar rangos o migrar versiones de clave. | Especificación `CK`, limitada por `CO` y `NORM`. |
| [Base de datos V1](database/database-v1.md) | Entender entidades, invariantes, estados, mapas SVG y consultas representativas. | [`database/001_initial_schema.sql`](../database/001_initial_schema.sql) para estructura ejecutable; el documento para semántica de diseño. |
| [Flujo de la aplicación V1](workflows/application-workflow-v1.md) | Implementar o revisar la configuración, publicación y búsqueda. | Decisiones funcionales confirmadas, limitadas por los contratos y las migraciones enlazadas. |
| [Migración de estructura](../database/001_initial_schema.sql) | Crear o auditar el esquema PostgreSQL implementado. | El propio SQL. |
| [Perfil inicial](../database/002_seed_basic_ordering_profile.sql) | Insertar o auditar el contrato interno utilizado por los esquemas V1. | El propio SQL. |
| [Guía principal](../README.md) | Orientarse, conocer el estado actual y aplicar las migraciones. | Artefactos enlazados desde cada sección. |

## Estado y límites

- `CO`, `NORM` y `CK` son contratos de diseño; no hay todavía una implementación de aplicación contra la cual ejecutar sus pruebas de conformidad.
- Las migraciones `001_initial_schema.sql` y `002_seed_basic_ordering_profile.sql` implementan la estructura V1 y su perfil interno inicial, pero el repositorio no incluye pruebas automatizadas de integridad o rendimiento.
- Las decisiones institucionales pendientes se conservan en [Decisiones abiertas](classification-ordering.md#13-decisiones-abiertas).

## Regla de mantenimiento

Actualice este índice cuando agregue, mueva, depreque o sustituya un documento. Revise el contrato afectado cuando cambien una regla `CO-*`, el perfil de normalización, la codificación comparable, las transiciones de `scheme_status`, el esquema SQL o la responsabilidad entre base de datos y aplicación.
