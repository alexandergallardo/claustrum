# Plan Completo: Seed Idempotente, Actualizable y Seguro para Produccion

Este documento aterriza, valida y completa el plan para que el seed de oferta academica pueda ejecutarse varias veces sobre una BD con datos reales, sin romper integridad, sin duplicar registros y con soporte para desactivacion logica de oferta cerrada.

## 1) Validacion de hallazgos contra codigo y schema actual

Los hallazgos originales son correctos en esencia y si corresponden con el repo, con estos matices:

1. **IDs inestables en Python: confirmado.**
   - `supabase/tec-data/src/commands/process_course_offering.py` usa contadores (`next_offering_id`, `next_group_id`, `next_group_professor_id`, `next_meeting_id`).
   - Tambien usa `glob("*.json")` sin ordenar; el orden de archivos puede variar y por tanto cambiar IDs.

2. **SQL no idempotente: confirmado.**
   - `supabase/tec-data/src/commands/sql.py` genera solo `INSERT INTO ... VALUES ...;` (sin `ON CONFLICT`).
   - Re-ejecutar en una BD no vacia puede fallar por PK/UNIQUE.

3. **No se puede borrar grupos con dependencias: confirmado.**
   - `saved_schedule_item.course_offering_group_id -> course_offering_group.id` usa `ON DELETE RESTRICT`.
   - Borrado fisico de grupos ya usados no es viable.

4. **Soft delete propuesto es correcto, pero incompleto.**
   - No basta con tocar `get_eligible_schedule_courses`; hoy la UI consulta `get_schedule_courses`, que depende de `v_schedule_courses`.
   - Se deben filtrar inactivos en la vista base y en funciones/validaciones auxiliares.

5. **Inconsistencia en numeracion de migracion.**
   - El documento hablaba de `0017_add_active_status.sql`, pero el repo ya llega a `0021`.
   - La nueva debe ser `0022_...` (o el siguiente consecutivo real).

## 2) Objetivo funcional final

Al terminar, el flujo debe garantizar:

- Re-ejecutar sync del mismo periodo sin errores de conflicto.
- Altas y cambios se reflejan por UPSERT.
- Registros que desaparecen del origen quedan `is_active = false` (no borrado fisico).
- Historial referencial de horarios guardados se conserva.
- La UI solo muestra oferta activa.

## 3) Cambios requeridos en Base de Datos (SQL)

### 3.1 Nueva migracion de estado y vigencia

Crear migracion `supabase/migrations/0022_offering_soft_delete_and_sync.sql` con:

1. **Columnas nuevas en tablas de oferta:**
   - `course_offering`: `is_active BOOLEAN NOT NULL DEFAULT true`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `course_offering_group`: `is_active BOOLEAN NOT NULL DEFAULT true`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `course_offering_group_professor`: `is_active BOOLEAN NOT NULL DEFAULT true`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `course_offering_meeting`: `is_active BOOLEAN NOT NULL DEFAULT true`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

2. **Triggers de timestamp para tablas nuevas con `updated_at`:**
   - Reusar `public.trigger_set_timestamp()`.
   - Crear triggers `BEFORE UPDATE` para las 4 tablas anteriores.

3. **Indices para desactivacion/consulta:**
   - `idx_course_offering_term_active` en `(academic_term_id, is_active)`
   - `idx_course_offering_group_offering_active` en `(course_offering_id, is_active)`
   - `idx_course_offering_group_professor_group_active` en `(course_offering_group_id, is_active)`
   - `idx_course_offering_meeting_group_active` en `(course_offering_group_id, is_active)`

### 3.2 Actualizar vista y funciones que leen oferta

Actualizar `v_schedule_courses` (hoy definida en `0004_functions.sql`) para que solo arme grupos activos y relaciones activas:

- `course_offering co`: `co.is_active = true`
- `course_offering_group g`: `g.is_active = true`
- `course_offering_group_professor cogp`: `cogp.is_active = true`
- `course_offering_meeting com`: `com.is_active = true`

Con esto, las funciones que ya consumen la vista (`get_schedule_courses`, `get_schedule_courses_by_study_plan`, `get_eligible_schedule_courses`, etc.) quedan alineadas sin duplicar filtros por todos lados.

### 3.3 Ajustes de validaciones de resenas de profesor

La funcion `ensure_professor_review_course_matches_professor()` (migracion `0018`) debe ignorar asignaciones inactivas para no validar contra oferta cerrada:

- Agregar filtros `co.is_active`, `cog.is_active`, `cogp.is_active`.

### 3.4 RLS (recomendado)

Hoy las politicas publicas en tablas de oferta son `USING (true)`. Dos opciones:

- **Opcion recomendada:** dejar lectura publica de tablas base como esta y consumir solo RPC/view filtrada en frontend.
- **Opcion estricta:** cambiar politicas SELECT a `USING (is_active = true)` en tablas de oferta para evitar exposicion accidental de historico.

Documentar en la migracion cual opcion se adopta.

## 4) Cambios requeridos en Python (procesamiento)

### 4.1 IDs deterministas para oferta academica

Modificar `supabase/tec-data/src/commands/process_course_offering.py`:

1. Reemplazar contadores por IDs deterministas estables.
2. Ordenar inputs para estabilidad adicional:
   - `sorted(course_offer_dir.glob("*.json"))`
   - `sorted(schedule_guia_dir.glob("*.json"))`
3. Usar una funcion de hash estable para `BIGINT` positivo.

Ejemplo recomendado:

```python
import hashlib

def deterministic_id(namespace: str, *parts: object) -> int:
    raw = f"{namespace}|" + "|".join(str(p).strip().upper() for p in parts)
    digest = hashlib.blake2b(raw.encode("utf-8"), digest_size=8).digest()
    # 63 bits positivos para BIGINT signed
    return int.from_bytes(digest, "big") & ((1 << 63) - 1)
```

Mapeo sugerido:

- `course_offering.id` = hash de `(course_id, campus_id, academic_unit_id, academic_term_id)`
- `course_offering_group.id` = hash de `(course_offering_id, group_code)`
- `course_offering_group_professor.id` = hash de `(course_offering_group_id, professor_id)`
- `course_offering_meeting.id` = hash de `(course_offering_group_id, weekday, starts_at, ends_at)`

### 4.2 Profesores

Actualmente se generan por nombre en mayuscula y contador incremental si no existe en `professor/data.json`.

Para estabilidad total del seed:

- O mantener estrategia actual pero asegurar que `professor/data.json` siempre se conserva entre corridas.
- **Recomendado:** tambien pasar profesor a ID determinista por nombre normalizado para evitar drift si cambia el orden de archivos.

## 5) Cambios requeridos en Python (generador SQL)

Modificar `supabase/tec-data/src/commands/sql.py` para generar UPSERT real.

### 5.1 Tablas que deben ir con UPSERT

Aplicar `INSERT ... ON CONFLICT ... DO UPDATE` al menos en:

- `professor`
- `course_offering`
- `course_offering_group`
- `course_offering_group_professor`
- `course_offering_meeting`

Y recomendable extender a tablas de catalogo que pueden refrescarse (`course`, `study_plan*`, `course_relation`, etc.) para que todo el seed sea rejecutable.

### 5.2 Regla de update en oferta

En `DO UPDATE SET` incluir siempre:

- Campos de negocio que pueden cambiar (`capacity`, `group_type`, `classroom`, etc.)
- `is_active = true`
- `updated_at = NOW()`

### 5.3 Conflicto por PK vs UNIQUE natural

Si se usan IDs deterministas, `ON CONFLICT (id)` es suficiente.

Si no se usan IDs deterministas, se requiere `ON CONFLICT` por llave natural en cada tabla (por ejemplo `(course_offering_id, group_code)`) y redisenar la resolucion de FKs; es mas complejo. Por eso se recomienda IDs deterministas.

## 6) Logica de desactivacion (soft delete) al final del sync

Agregar bloque SQL al final del seed para marcar inactivos los registros no tocados en la corrida actual.

### 6.1 Marcador temporal unico de corrida

Al inicio de `seed.sql`:

```sql
BEGIN;
SET LOCAL TIME ZONE 'UTC';
-- Se reutiliza NOW() de la transaccion como referencia estable
```

### 6.2 Desactivacion por periodo (orden correcto)

Primero hijos, luego padre:

1. `course_offering_meeting`
2. `course_offering_group_professor`
3. `course_offering_group`
4. `course_offering`

Criterio:

- `updated_at < NOW()` dentro de la transaccion (porque los UPSERT de esta corrida escribieron `NOW()`).
- Acotar por `academic_term_id` del/los periodos sincronizados para no tocar otros terminos.

Ejemplo base (ajustar para cada tabla):

```sql
UPDATE public.course_offering_group g
SET is_active = false, updated_at = NOW()
WHERE g.is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.course_offering co
    WHERE co.id = g.course_offering_id
      AND co.academic_term_id = ANY(ARRAY[/* term ids sincronizados */])
  )
  AND g.updated_at < NOW();
```

Importante: no borrar fisicamente nada, solo desactivar.

## 7) Secuencias de BIGSERIAL (evitar colisiones futuras)

Como el seed inserta IDs explicitos, al final del script se debe ajustar secuencias:

```sql
SELECT setval(pg_get_serial_sequence('public.course_offering', 'id'), COALESCE(MAX(id), 1), true) FROM public.course_offering;
```

Hacerlo para todas las tablas seeded con PK serial (`professor`, `course_offering*`, etc.).

## 8) Cambios en pipeline de ejecucion

En `supabase/tec-data/sync-all.sh`:

- Mantener pasos de descarga/proceso.
- Generar `seed.sql` con UPSERT + bloque de desactivacion + `setval`.
- Ejecutar en una sola transaccion.
- (Opcional) parametrizar `TERM_IDS` para desactivar solo terminos cargados.

## 9) Checklist de implementacion (no resumen, acciones concretas)

1. Crear migracion `0022_offering_soft_delete_and_sync.sql`.
2. Agregar columnas `is_active`/`updated_at` y triggers en 4 tablas de oferta.
3. Agregar indices compuestos por FK + `is_active`.
4. Re-crear `v_schedule_courses` con filtros de activos en offering/group/professor/meeting.
5. Ajustar `ensure_professor_review_course_matches_professor()` para validar solo contra activos.
6. Actualizar `process_course_offering.py` con IDs deterministas y `glob` ordenado.
7. (Recomendado) aplicar estabilidad de IDs tambien a profesores.
8. Actualizar `sql.py` para emitir UPSERT por tabla (al menos oferta + profesor).
9. Incluir `is_active=true` y `updated_at=NOW()` en todos los UPSERT de oferta.
10. Agregar bloque final de soft delete por `academic_term_id` en orden hijo->padre.
11. Agregar `setval` de secuencias al final.
12. Regenerar `seed.sql` y validar en BD local con dos corridas consecutivas.

## 10) Validaciones obligatorias de aceptacion

Ejecutar estas comprobaciones luego de implementar:

1. **Idempotencia:** correr sync 2 veces seguidas, sin errores de PK/UNIQUE.
2. **Actualizacion:** cambiar capacidad de un grupo en origen y verificar que se actualiza en BD.
3. **Desactivacion:** quitar un grupo del origen y confirmar `is_active=false` tras sync.
4. **No perdida historica:** `saved_schedule_item` mantiene referencia valida al grupo inactivo.
5. **UI limpia:** RPC `get_schedule_courses` no devuelve grupos/ofertas inactivas.
6. **Resenas consistentes:** validacion de reviews no acepta match contra asignaciones inactivas.

## 11) Riesgos y mitigaciones

- **Colision de hash (baja probabilidad):** usar namespace por entidad y 63 bits; monitorear IDs duplicados en preproduccion.
- **Datos no normalizados (nombres profesor):** normalizar `strip().upper()` antes de hash.
- **Desactivacion accidental de otro periodo:** filtrar siempre por `academic_term_id` sincronizado.
- **Drift de secuencias:** ejecutar `setval` siempre al final del seed.

## 12) Conclusion

El enfoque original era correcto, pero faltaban piezas criticas (vista base, funciones auxiliares, secuencias, orden de desactivacion, numeracion de migracion y estabilidad por orden de archivos). Con este plan, el archivo ya queda completo y accionable para implementacion real de seed productivo.
