# Reviews Import

Proyecto Python con `uv` para importar reseñas de MisProfesores y asociarlas a profesores/cursos de la base local.

## Estructura

- `main.py`: entrypoint único del repo.
- `src/reviews/`: lógica de descarga, matching, procesamiento y auditoría.
- `data/state/`: estado e índices idempotentes.
  - `downloads/index.json`
  - `matching/professors.json`
  - `matching/unmatched.json`
  - `matching/decisions.json`
  - `matching/manual/*.json`
  - `courses/decisions.json`
  - `courses/variations.json`
- `data/raw/professors/{professor_id}/source-{source_id}/pages/page-XXX.json`: snapshots crudos.
- `data/raw/candidates/{source_id}/pages/page-XXX.json`: evidencia temporal de perfiles no confirmados.
- `data/processed/professors/{professor_id}/source-{source_id}/pages/page-XXX.json`: salida normalizada por página.
- `data/processed/professors/{professor_id}/reviews.sql`: SQL idempotente por profesor.
- `data/processed/reports/`: reportes del procesamiento.
- `data/reports/professors/`: auditorías de matching.

## Comandos

```bash
uv run reviews-match
```

Genera `data/state/matching/professors.json`, `unmatched.json` y `decisions.json`.

```bash
uv run reviews-download
```

Descarga reseñas confirmadas de forma idempotente. Siempre revisa la página 1 y sigue hacia atrás hasta encontrar solapamiento conocido.

```bash
uv run reviews-download --include-unmatched --candidate-pages 2
```

Descarga evidencia limitada para perfiles unmatched en `data/raw/candidates/`.

```bash
uv run reviews-process --write-sql
```

Procesa `data/raw/professors/` hacia `data/processed/professors/` y genera SQL por profesor.

```bash
uv run reviews-import --professor-id 278 --complete-history --write-sql --no-openrouter
```

Descarga y procesa uno o varios profesores confirmados. `--complete-history` y `--write-sql` son opcionales y se activan manualmente. `reviews-import-professor` queda como alias compatible.

```bash
uv run reviews-refresh-matches
```

Scrapea profesores, aplica matches automáticos y manuales, descarga evidencia limitada para unmatched, rematchea usando evidencia de cursos y ejecuta auditoría sin procesar reseñas.

```bash
uv run reviews-refresh-matches --update-reviews
```

Hace lo anterior y además actualiza reseñas crudas confirmadas de forma idempotente.

```bash
uv run reviews-audit
```

Audita matches existentes contra la evidencia.

```bash
uv run reviews-sync --include-unmatched --write-sql
```

Ejecuta el flujo completo: matching, evidencia unmatched, rematch, descarga, procesamiento y auditoría.

## Idempotencia

Cada reseña cruda incluye `source_review_id`, derivado de `Reportar-Comentario_*` cuando existe. Si no existe, se usa un hash estable de fecha, curso, comentario y scores. El índice global está en `data/state/downloads/index.json`, mientras que cada perfil tiene su propio `data/raw/.../index.json`.
