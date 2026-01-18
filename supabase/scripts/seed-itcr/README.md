# ITCR Seed Script Documentation

## Overview

The ITCR seed script (`supabase/scripts/seed-itcr/`) populates a Supabase database with data from Instituto Tecnológico de Costa Rica (ITCR) public APIs. It ingests:

- **Catalog data**: Countries, universities, campuses, academic units, modalities, terms
- **Curriculum data**: Study plans, courses, levels, course relations (prerequisites/corequisites/equivalents)
- **Schedule data**: Professors, course offerings, groups, meetings, and group-professor assignments

The script is designed for **idempotent execution** - running it multiple times produces consistent results via upsert operations.

## Architecture

### Directory Structure

```
seed-itcr/
├── index.ts                  # Main entry point and orchestrator
├── config.ts                 # Configuration constants, URL definitions, CLI parsing
├── logging.ts                # Progress tracking and formatted output
├── http-client.ts            # HTTP utilities with TLS bypass for ITCR endpoints
├── supabase-client.ts        # PostgREST client for database operations
│
├── fetchers/                 # External API clients
│   ├── index.ts
│   ├── curriculum-api.ts     # TecDigital Curriculum API (plans, courses)
│   ├── student-records.ts    # TecDigital Student Records (terms, campuses, schedules)
│   ├── guia-horarios.ts      # Guía Horarios SOAP endpoints (schedule data)
│   └── tecdigital.ts         # TEC Digital table parsing for capacity/classroom data
│
├── sync/                     # Database sync modules (ordered by execution)
│   ├── index.ts              # Re-exports and buildIngestMaps utility
│   ├── base-catalog.ts       # Countries
│   ├── campuses.ts           # Campus locations
│   ├── terms.ts              # Academic terms (periods)
│   ├── modalities.ts         # Academic modalities (Semestre, Verano, etc.)
│   ├── academic-units.ts     # Schools/departments
│   ├── programs.ts           # Academic unit × campus relationships
│   ├── curriculum.ts         # Study plans, courses, levels, relations
│   └── schedule.ts           # Professors, offerings, groups, meetings
│
├── types.ts                  # TypeScript type definitions
├── utils/index.ts            # Utility functions (normalization, parsing)
└── normalizers/index.ts      # Data normalization functions
```

### Key Dependencies

- **Bun**: Runtime and package manager
- **Supabase PostgREST API**: Database operations via REST
- **ITCR Public APIs**: Data sources (see `config.ts` for URLs)

## Execution Order

The seed runs in a **strict dependency order** because each step depends on data created in previous steps:

```
┌─────────────────────────────────────┐
│ 1. seedBaseCatalog                  │  country (CR, US, MX, CO, PA)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 2. ensureItcrUniversity             │  university (Instituto Tecnológico de Costa Rica)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 3. syncCampuses                     │  campus (sedes: AL, CA, LM, SC, SJ, etc.)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 4. syncTerms                        │  academic_term (depends on modality)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 5. syncModalities                   │  academic_modality (from Guía Horarios API)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 6. syncAcademicUnits                │  academic_unit (escuelas/departamentos)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 7. syncProgramsAndCampusAvailability│  academic_unit_campus (which units at which campuses)
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 8. syncCurriculumPlans              │  study_plan, study_plan_level,
│                                      │  course, study_plan_level_course,
│                                      │  course_relation, study_plan_campus
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│ 9. syncSchedule                     │  professor, course_offering,
│                                      │  course_offering_group,
│                                      │  course_offering_meeting,
│                                      │  course_offering_group_professor
└─────────────────────────────────────┘
```

**Critical dependency chain:**
1. `academic_term` requires `academic_modality`
2. `study_plan` requires `academic_unit` and `academic_modality`
3. `course_offering` requires `course`, `campus`, `academic_unit`, `academic_term`
4. `course_offering_group` requires `course_offering`
5. `course_offering_meeting` requires `course_offering_group`
6. `course_offering_group_professor` requires `course_offering_group` and `professor`

## Database Schema

### Core Tables (Catalog)

| Table | Description | Key Columns | Unique Constraint |
|-------|-------------|-------------|-------------------|
| `country` | ISO-3166 countries | `iso2_code` | `iso2_code` |
| `university` | Institutions | `country_id`, `short_name` | `short_name` |
| `campus` | Campus locations | `university_id`, `code` | `code` |
| `academic_unit` | Schools/departments | `university_id`, `code` | `code` |
| `academic_modality` | Period types | `code` | `code` |
| `academic_term` | Specific periods | `academic_modality_id`, `external_key` | `external_key` |

### Curriculum Tables

| Table | Description | Key Columns | Unique Constraint |
|-------|-------------|-------------|-------------------|
| `course` | Course catalog | `code` | `code` |
| `study_plan` | Curriculum versions | `academic_unit_id`, `external_plan_id` | `academic_unit_id,external_plan_id` |
| `study_plan_level` | Year/semester in plan | `study_plan_id`, `level_number` | `study_plan_id,level_number` |
| `study_plan_level_course` | Courses in levels | `study_plan_level_id`, `course_id` | `study_plan_level_id,course_id` |
| `course_relation` | Prereqs/coreqs/equivalents | `study_plan_id`, `from_course_id`, `to_course_id`, `relation_type` | (composite) |
| `study_plan_campus` | Plan availability | `study_plan_id`, `campus_id` | `study_plan_id,campus_id` |
| `academic_unit_campus` | Unit availability | `academic_unit_id`, `campus_id` | `academic_unit_id,campus_id` |

### Schedule Tables

| Table | Description | Key Columns | Unique Constraint |
|-------|-------------|-------------|-------------------|
| `professor` | Instructors | `full_name` | `full_name` |
| `course_offering` | Header-level offering | `course_id`, `campus_id`, `academic_unit_id`, `academic_term_id` | (composite) |
| `course_offering_group` | Sections/groups | `course_offering_id`, `group_code` | `course_offering_id,group_code` |
| `course_offering_meeting` | Meeting times | `course_offering_group_id`, `weekday`, `starts_at`, `ends_at` | (composite) |
| `course_offering_group_professor` | Instructor assignments | `course_offering_group_id`, `professor_id` | `course_offering_group_id,professor_id` |

### Entity Relationship Diagram

```
country
  └── university
        ├── campus
        │     └── study_plan_campus
        │     └── academic_unit_campus
        └── academic_unit
              ├── academic_unit_campus
              ├── study_plan
              │     ├── study_plan_level
              │     │     └── study_plan_level_course
              │     │           └── course (many-to-many via study plans)
              │     └── course_relation
              └── course_offering
                    └── course_offering_group
                          ├── course_offering_meeting
                          └── course_offering_group_professor
                                └── professor

academic_modality
  └── academic_term
        └── study_plan
        └── course_offering

course (canonical)
  ├── study_plan_level_course
  └── course_offering
```

## Data Sources

### 1. TecDigital Curriculum API

**Base URL**: `https://tecdigital.tec.ac.cr/tds-curriculum-exp`

| Endpoint | Purpose |
|----------|---------|
| `/ajax/carga_sedes_json` | List of campuses |
| `/ajax/carga_carreras_json?id_sede={code}` | Programs at a campus |
| `/ajax/carga_planes_json?id_sede={code}&id_depto={program}` | Study plans for a program |
| `/ajax/json_draw_angular?id_plan={id}` | Detailed curriculum (courses, levels, requirements) |

**Data flow**:
1. Fetch campuses → `syncCampuses`
2. Fetch careers by campus → `syncAcademicUnits`, `syncProgramsAndCampusAvailability`
3. Fetch plans by program → `syncCurriculumPlans`
4. Fetch plan details (courses, prereqs) → `syncCurriculumPlans`

### 2. TecDigital Student Records API

**Base URL**: `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil`

| Endpoint | Purpose |
|----------|---------|
| `/ajax/combos/carga_periodos_tds_lib` | Academic terms/periods |
| `/ajax/combos/carga_sedes_tds_lib` | Campus list (HTML parsing) |
| `/ajax/combos/carga_carreras_tds_lib?id_sede={code}` | Programs at campus (HTML) |
| `/ajax/tabla_guia_horario?sede={code}&carrera={program}&periodo={term}` | Schedule table (HTML) |

**Data flow**:
1. Fetch terms → `syncTerms`
2. Fetch campuses (fallback) → `syncCampuses`
3. Fetch programs by campus (fallback) → `syncAcademicUnits`, `syncProgramsAndCampusAvailability`
4. Parse schedule tables → `syncSchedule`

### 3. Guía Horarios (SOAP/RPC)

**Base URL**: `https://tec-appsext.itcr.ac.cr/guiahorarios`

Requires AlteonP cookie authentication (acquired via GET to `escuela.aspx`).

| Endpoint | Purpose |
|----------|---------|
| `/escuela.aspx/cargaEscuelas` | Academic units (escuelas) |
| `/escuela.aspx/cargaModalidadPeriodos` | Modalities and periods |
| `/escuela.aspx/getdatosEscuelaAno` | Course offerings by school and year |

**Data flow**:
1. Acquire AlteonP cookie → `index.ts`
2. Fetch academic units → `syncAcademicUnits`, `syncSchedule`
3. Fetch modalities → `syncModalities`
4. Fetch offerings by school/year → `syncSchedule`

## Key Data Conversions

### Academic Term Keys

ITCR uses a standardized term key format: `{YEAR}_{MODALITY}_{PERIOD}`

| Key Example | Year | Modality | Period |
|-------------|------|----------|--------|
| `2026_S_1` | 2026 | Semestre | 1 |
| `2025_V_2` | 2025 | Verano | 2 |
| `2024_B_3` | 2024 | Bimestre | 3 |

**Modality codes:**
- `A` = Anual
- `S` = Semestre
- `V` = Verano
- `B` = Bimestre
- `C` = Cuatrimestre
- `T` = Trimestre
- `H` = Centros Formación Humanística
- `M` = Mensual
- `I` = Intensivo
- `N` = Bianual

### Course Codes

Valid codes follow pattern: `{2-3 letters}{3-5 digits}`

Examples: `IC1802`, `MA0101`, `CA2125`, `FH0178`, `AEN100`

Invalid: `NO HAY MATERIAS EQUIVALENTES`, `ELECTIVA ABIERTA` (filtered by `isValidCourseCode()`)

### Campus Codes (Primary)

The seed focuses on primary campuses defined in `config.ts`:

```typescript
const PRIMARY_CAMPUSES = ["AL", "CA", "LM", "SC", "SJ"];
```

| Code | Name |
|------|------|
| AL | Alajuela |
| CA | Cartago |
| LM | Limón |
| SC | San Carlos |
| SJ | San José |

### Schedule Data Structure

The schedule sync converts raw API data into a nested structure:

```
SchedulePeriod[]
  └── periodo: string (e.g., "2026_S_1")
  └── cursos: Map<string, ScheduleCourse>
        └── codigo: string (course code)
        └── nombre: string (course name)
        └── escuela: { codigo, nombre }
        └── modalidad: string
        └── tipo_materia: string | null
        └── grupos: Map<string, ScheduleGroup>
              └── numero: number (group code)
              └── sede: { codigo, nombre }
              └── profesores: string[]
              └── modalidad: string (group type)
              └── capacidad: number | null
              └── horarios: Map<string, ScheduleMeeting>
                    └── weekday: number (1-7)
                    └── starts_at: string (HH:MM)
                    └── ends_at: string (HH:MM)
                    └── classroom: string | null
```

### Normalization Functions

**Course names** (`normalizeCourseName`):
- Capitalizes first letter of each word
- Preserves acronyms (ALL CAPS, 2-8 chars)
- Converts Roman numerals to uppercase
- Keeps Spanish stopwords lowercase (except first position)

**Modality names to codes** (`normalizeModalityToCode`):
- "Semestre" → "S"
- "Verano" → "V"
- "Cuatrimestre" → "C"
- etc.

**Course types** (`normalizeCourseType`):
- Maps free-text to enum: `Curso Unico`, `Curso Comun`, `Electiva Unica`, `Trabajo Final De Graduacion`

**Group types** (`normalizeGroupType`):
- Maps free-text to enum: `Regular`, `Semipresencial`, `Virtual`, `Asistida`, `Tutoría`

## ID Resolution Pattern

A critical pattern in the seed is **ID resolution via composite keys**:

### The Problem

Foreign key relationships require database-generated IDs, but external APIs only provide codes/keys.

### The Solution: buildIngestMaps

```typescript
const maps = await buildIngestMaps({ supabase });
// Returns:
// - campusIdByCode: Map<string, number>
// - academicUnitIdByCode: Map<string, number>
// - academicModalityIdByCode: Map<string, number>
// - academicTermIdByExternalKey: Map<string, number>
// - courseIdByCode: Map<string, number>
// - studyPlanIdByUnitCodeAndExternalPlanId: Map<string, number>
```

### Usage Pattern

```typescript
// 1. Build maps from existing DB data
const maps = await buildIngestMaps({ supabase });

// 2. Use maps to convert external keys to DB IDs
const campus_id = maps.campusIdByCode.get("SJ");  // Returns database ID

// 3. Upsert records with foreign key IDs
await supabase.upsertMany({
  table: "course_offering",
  rows: [{ course_id, campus_id, ... }],
  onConflict: "course_id,campus_id,...",
});

// 4. Re-build maps to get newly created IDs (for child records)
const maps2 = await buildIngestMaps({ supabase });

// 5. Use maps2 for next level of records
```

### Critical: Re-query After Upsert

Never assume IDs exist before querying. For example, when creating offerings:

```typescript
// WRONG: Using temporary IDs
const offering_id = allOfferings.length + 1;  // Will NOT match DB!

// RIGHT: Query DB for real IDs after upsert
const offerings = await supabase.select({
  table: "course_offering",
  columns: "id,course_id,campus_id,academic_unit_id,academic_term_id",
});
const offeringIdByCompositeKey = new Map<string, number>();
for (const o of offerings) {
  const key = `${o.course_id}_${o.campus_id}_${o.academic_unit_id}_${o.academic_term_id}`;
  offeringIdByCompositeKey.set(key, o.id);
}
```

## Command Line Options

```bash
bun run supabase:seed:api [options]

Options:
  --dry-run               Simulate without database changes
  --only <modules>        Run only specific modules (comma-separated)
  --max-campuses <n>      Limit campuses to process
  --max-terms <n>         Limit terms to process
  --max-plans-per-program <n>  Limit plans per program
  --campuses <codes>      Specific campus codes (e.g., "SJ,AL,CA")
  --terms <keys>          Specific term keys (e.g., "2026_S_1,2025_V_2")
```

### Examples

```bash
# Dry run
bun run supabase:seed:api --dry-run

# Seed only curriculum data
bun run supabase:seed:api --only curriculum

# Seed specific campuses
bun run supabase:seed:api --campuses SJ,AL

# Seed specific terms
bun run supabase:seed:api --terms 2026_S_1,2025_V_2

# Seed with limits for testing
bun run supabase:seed:api --max-campuses 2 --max-terms 2 --max-plans-per-program 1
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Yes | Supabase service role secret key |
| `SEED_INSECURE_HTTPS` | No | Set to "1" to bypass TLS for ITCR endpoints (development only) |

## Common Issues and Solutions

### 1. Missing Academic Modality

**Error**: `Missing academic_modality for code="S"`

**Cause**: `syncTerms` runs before `syncModalities` in the original order, but terms require modality IDs.

**Solution**: Ensure `syncModalities` runs before `syncTerms`. The current order is correct.

### 2. Course Not Found in Schedule

**Error**: `Found X courses in schedule not in curriculum, skipping them`

**Cause**: Schedule data contains courses not defined in any study plan.

**Solution**: This is expected behavior. Courses must be defined in curriculum first. Skip these offerings.

### 3. TEC Digital TLS Errors

**Error**: `DEPTH_ZERO_SELF_SIGNED_CERT` or connection timeout

**Cause**: ITCR uses self-signed certificates.

**Solution**: Set `SEED_INSECURE_HTTPS=1` (development only).

### 4. AlteonP Cookie Expiration

**Error**: `Unable to acquire AlteonP cookie from guiahorarios`

**Cause**: Cookie expired or session invalidated.

**Solution**: Re-run the seed to acquire a fresh cookie.

### 5. Duplicate Key Violations

**Error**: `duplicate key value violates unique constraint`

**Cause**: Multiple sync runs or race conditions.

**Solution**: The seed uses upsert semantics. Ensure `onConflict` clauses are correct.

## Idempotency

The seed is designed to be **idempotent** - running it multiple times:

1. **First run**: Creates all records
2. **Subsequent runs**: Updates existing records, skips duplicates
3. **Always**: Produces consistent database state

This is achieved via:
- `upsertMany` with `onConflict` clauses
- Composite unique constraints matching upstream keys
- No assumptions about existing record IDs (always re-query)

## Performance Considerations

### Batch Operations

All upserts use batching to avoid overwhelming the API:

- Courses: 5000 rows/batch
- Study plans: 1000 rows/batch
- Level-course associations: 2000 rows/batch
- Offerings/groups/meetings: 2000 rows/batch

### Parallel Fetching

External API calls use `Promise.all()` where independent:

```typescript
const [programsJson, programsHtml] = await Promise.all([
  fetchProgramCareersFromCurriculumApi(campusCode),
  fetchProgramsByCampusFromStudentRecordsHtml(campusCode),
]);
```

### Caching

Plan details are cached by `externalPlanId` to avoid redundant fetches:

```typescript
let details = fetchedPlanDetailsByExternalPlanId.get(p.externalPlanId);
if (!details) {
  details = await fetchPlanDetailsFromCurriculumApi(p.externalPlanId);
  fetchedPlanDetailsByExternalPlanId.set(p.externalPlanId, details);
}
```

## Logging and Debugging

The seed provides structured logging:

```bash
# Section headers
Sync: curriculum (study plans, levels, courses, relations)

# Progress with ellipsis
  ⋯ course_offering: upserting 5000 rows...

# Success checkmark
  ✓ course_offering: 5000 rows upserted

# Info bullet
  • Syncing curriculum for primary campuses only: AL, CA, LM, SC, SJ

# Warnings
  ⚠ Unknown courseType 'Electiva Libre' -> storing as 'Curso Unico'

# Errors (handled, execution continues)
  ✗ Failed to fetch plan details for plan 123
```

### Failure Reports

On uncaught errors, a summary is printed:

```
========================================
ITCR seeder failed
========================================
Last step: syncTerms -> validate modalities
SEED_INSECURE_HTTPS: disabled
Likely source: ITCR HTTPS endpoints

Error message:
HTTP 503 Service Unavailable
url: https://tec-appsext.itcr.ac.cr/...
========================================
```

## File Structure Reference

### sync/index.ts

Exports all sync functions and contains `buildIngestMaps()`:

```typescript
export async function buildIngestMaps(params: {
  supabase: SupabaseRestClient;
}): Promise<IngestMaps>
```

Returns a map of all entity IDs for ID resolution.

### supabase-client.ts

Implements `SupabaseRestClient` with methods:

- `upsertOne()` / `upsertMany()` - Upsert records
- `insertMany()` - Insert records (no update)
- `select()` / `selectOne()` - Query records
- `deleteWhere()` - Delete matching records
- `ensureItcrUniversity()` - Create/find university with country

### http-client.ts

Implements HTTP utilities:

- `httpJson()` - JSON requests with TLS bypass
- `httpText()` - Text requests with TLS bypass
- `parseScheduleGuideTable()` - Parse HTML schedule tables
- `parseHtmlSpans()` - Extract span elements from HTML
- `weekdayFromSpanish()` - Convert Spanish day names to numbers

## Related Documentation

- **Database Schema**: `supabase/migrations/0001_init.sql`
- **RLS Policies**: `supabase/migrations/0002_rls.sql`
- **Indexes**: `supabase/migrations/0003_indexes.sql`
- **Package.json scripts**: `bun run supabase:seed:api`
