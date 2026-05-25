## tec-data refactor plan (no behavior changes)

### Current pain points

- `src/commands/sync.py` (2157 lines) mixes orchestration, seed history replay, SQL diff generation, ledger writes, and ID remap logic.
- `src/commands/process.py` (929 lines) contains unrelated entity processors in one module.
- `src/commands/sql.py` (816 lines) combines formatting, schema ordering, and file/manifest emission.
- Large files increase regression risk because domain rules and side effects are not isolated.

### Target structure

```text
src/commands/
  sync/
    __init__.py            # public sync_cmd entry point
    cli.py                 # sync_cmd options adapter (Typer-facing)
    orchestrator.py        # run_sync / high-level flow
    pipeline.py            # run_sync_pipeline and prerequisite checks
    seed_history.py        # baseline replay + temp DB lifecycle
    delta.py               # generate_minimal_delta_seed + SQL diff helpers
    remap.py               # remap_all_ids_to_db and FK mapping helpers
    ledger.py              # ledger_seed_exists / mark_seed_status / fingerprint checks
    io.py                  # JSON I/O, fingerprint, metadata parsing
    constants.py           # table lists, conflict columns, target URLs
```

```text
src/commands/process/
  __init__.py              # run_process public function
  core.py                  # scope routing + shared helpers
  reference_data.py        # country/university bootstrap
  campus.py                # process_campus
  academic_unit.py         # process_academic_unit
  study_plan.py            # process_study_plan
  academic_term.py         # process_academic_term
  modality.py              # process_academic_modality
  course.py                # process_course
  relations.py             # process_course_relations
  offering.py              # offering aggregation entry point
```

```text
src/commands/sql/
  __init__.py              # run_sql public function
  writer.py                # SQL write primitives
  manifest.py              # manifest generation
  ordering.py              # table ordering and dependency helpers
  formatting.py            # scalar/list value formatting
```

### Extraction order (safe, incremental)

1. **Pure helpers first**
   - Move deterministic helpers (`canonical_json`, `seed_sha256`, `parse_seed_timestamp`) into `sync/io.py`.
   - Keep same function names and signatures, re-export from package `__init__.py` to avoid call-site churn.

2. **Low-risk side-effect boundaries**
   - Extract `sync/ledger.py` and `sync/seed_history.py` because they communicate via explicit DB URLs.
   - Add narrow integration tests with snapshot SQL and mock `subprocess` boundaries.

3. **Delta generation isolation**
   - Move schema introspection and update/insert statement builders into `sync/delta.py`.
   - Keep `generate_minimal_delta_seed` output byte-for-byte stable (important for SHA-based ledger logic).

4. **Remap decomposition**
   - Split `remap_all_ids_to_db` into per-domain mapping steps:
     - `map_catalog_ids`
     - `map_study_plan_ids`
     - `map_offering_ids`
   - Preserve write order and ID assignment strategy to avoid FK drift.

5. **Process/sql module split**
   - Move entity processors from `process.py` one by one into dedicated modules.
   - Keep `run_process` and CLI behavior untouched; only internal imports change.

### Guardrails to preserve exact behavior

- Keep all CLI flags and defaults identical.
- Preserve seed file header metadata keys and order.
- Preserve `scope` semantics (`catalog`, `offering`, `all`) and table selection.
- Preserve SQL emission ordering and conflict clauses per table.
- Preserve offering-specific soft-delete filtering by `academic_term_id`.
- Preserve `seed-history` bootstrapping (`auth`, `better_auth`, roles, stubs).

### Verification strategy during refactor

- Run on each extraction step:
  - `uv run ruff check`
  - `uv run ty check`
- Golden-file checks:
  - Generate seed from same input before/after extraction and compare SQL + manifest outputs.
- Replay checks:
  - Apply generated seeds against ephemeral Postgres and compare row counts/fingerprints.
