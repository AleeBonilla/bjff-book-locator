---
name: record-decisions
description: Registra o actualiza decisiones importantes en docs/decisiones.md. Usar siempre que una tarea adopte, cambie o revierta una decisión de dominio, arquitectura, persistencia, API, seguridad, operación o flujo de trabajo con consecuencias duraderas; también cuando se descarte una alternativa relevante. No usar para detalles mecánicos, correcciones obvias ni preguntas todavía sin resolver.
---

# Registrar decisiones

Mantener `docs/decisiones.md` como registro canónico de decisiones importantes del
proyecto.

## Flujo

1. Leer `docs/README.md`, `docs/decisiones.md` y los artefactos afectados.
2. Confirmar que existe una decisión real. Si el punto sigue abierto, usar
   `$track-open-questions`.
3. Buscar una entrada equivalente:
   - actualizarla si cambió su alcance o fundamento;
   - si se revierte, conservar el contexto histórico y explicar la nueva decisión;
   - crear una entrada nueva solo cuando no exista una equivalente.
4. Usar el siguiente número disponible y un título específico.
5. Escribir en español, de forma directa, con esta estructura mínima:

```markdown
## N. Título

**Decisión:** qué queda acordado.

**Motivo:** problema que resuelve y criterio usado.

**Alternativas descartadas:** opciones relevantes y por qué no se eligieron.

**Consecuencia:** efectos, límites y trabajo futuro.
```

6. Omitir «Alternativas descartadas» únicamente cuando no existió una alternativa
   material.
7. Actualizar en el mismo cambio cualquier especificación, flujo o documento cuya
   afirmación haya quedado obsoleta.
8. Revisar el diff para evitar reglas duplicadas, secretos o material privado.

## Criterio de importancia

Registrar una decisión cuando cambiarla después afectaría contratos, datos, seguridad,
comportamiento observable, arquitectura, operación o la forma de aceptar cambios.
No registrar nombres locales, refactors sin cambio de comportamiento ni elecciones
impuestas por una API sin alternativa real.
