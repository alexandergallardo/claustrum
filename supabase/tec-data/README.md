# TEC Data CLI

Herramienta CLI para descargar y procesar datos del Instituto Tecnológico de Costa Rica (ITCR).

## Requisitos

- Python 3.11+
- uv (gestor de paquetes)

## Instalación

```bash
uv sync
```

## Flujo de Trabajo Completo

Esta sección describe todos los comandos necesarios para descargar y procesar todas las entidades de datos.

### Dependencias entre Entidades

```
campus
   └── academic_unit (requiere campus)
            └── academic_unit_campus (generado durante process)
   └── study_plan (requiere academic_unit_campus)
            └── course (generado durante process)

academic_period (independiente)

course_offer (requiere academic_unit)
   └── schedule_guia (requiere course_offer)

course_offering (requiere course_offer, schedule_guia, campus, academic_unit, academic_term, course, professor)
```

### Descarga de Datos

#### Paso 1: Descargar datos base

```bash
uv run tec-data download
```

Este comando descarga:
- `data/raw/campus/` - Sedes del TEC
- `data/raw/academic_unit/` - Escuelas/carreras
- `data/raw/academic_period/` - Modalidades y períodos académicos

#### Paso 2: Descargar planes de estudio

```bash
uv run tec-data download --entity study_plan
```

**Nota**: Este comando requiere que primero se ejecute `uv run tec-data process` para generar `academic_unit_campus`.

#### Paso 3: Descargar oferta de cursos

```bash
uv run tec-data download --entity course_offer --year 2026
```

**Parámetros**:
- `--year` o `-y`: Año académico (ej: 2026)

**Requiere**: `academic_unit/data.json` generado durante el process.

Archivos generados:
- `data/raw/course_offer/{year}/*.json`

#### Paso 4: Descargar horarios (schedule_guia)

```bash
uv run tec-data download --entity schedule_guia --year 2026
```

**Requiere**: Datos de `course_offer` del mismo año.

Archivos generados:
- `data/raw/schedule_guia/{year}/*.json`

### Procesamiento de Datos

#### Paso 1: Procesar datos base

```bash
uv run tec-data process
```

Este comando procesa:
- `data/raw/country/` y `data/raw/university/` (datos de referencia estáticos)
- `data/raw/campus/data.json`
- `data/raw/academic_unit/data.json` y `data/raw/academic_unit_campus/data.json`
- `data/raw/academic_modality/data.json` y `data/raw/academic_term/data.json`

#### Paso 2: Procesar planes de estudio

```bash
uv run tec-data process --entity study_plan
```

**Requiere**: `academic_unit_campus/data.json` generado en el paso 1.

Genera:
- `data/raw/study_plan/data.json`
- `data/raw/study_plan_campus/data.json`
- `data/raw/study_plan_level/data.json`
- `data/raw/study_plan_level_course/data.json`
- `data/raw/course/data.json`
- `data/raw/course_relation/data.json`

#### Paso 3: Procesar oferta de cursos y horarios

```bash
uv run tec-data process --entity course_offering --years 2026
```

**Requiere**:
- `data/raw/course_offer/2026/`
- `data/raw/schedule_guia/2026/`
- `data/raw/campus/data.json`
- `data/raw/academic_unit/data.json`
- `data/raw/academic_term/data.json`
- `data/raw/course/data.json`
- `data/raw/professor/data.json`

**Acciones**:
- Mezcla datos de `course_offer` y `schedule_guia`
- Actualiza nombres de cursos vacíos en `course/data.json`
- Genera 875 profesores nuevos
- Genera registros en:
  - `data/raw/course_offering/data.json` (1140 ofertas)
  - `data/raw/course_offering_group/data.json` (2845 grupos)
  - `data/raw/course_offering_group_professor/data.json` (2751 relaciones)
  - `data/raw/course_offering_meeting/data.json` (2845 reuniones)

## Comandos por Entity

### Download

| Entity | Requiere | Genera |
|--------|----------|--------|
| `campus` | - | `data/raw/campus/` |
| `academic_unit` | campus | `data/raw/academic_unit/` |
| `academic_period` | - | `data/raw/academic_period/` |
| `study_plan` | process (academic_unit_campus) | `data/raw/study_plan/` |
| `course_offer` | process (academic_unit) | `data/raw/course_offer/{year}/` |
| `schedule_guia` | course_offer | `data/raw/schedule_guia/{year}/` |

### Process

| Entity | Requiere | Genera |
|--------|----------|--------|
| `campus` | - | `data/raw/campus/data.json` |
| `academic_unit` | campus | `data/raw/academic_unit/data.json`, `academic_unit_campus/data.json` |
| `academic_period` | - | `data/raw/academic_modality/data.json`, `data/raw/academic_term/data.json` |
| `study_plan` | campus, academic_unit, academic_period, academic_unit_campus | `data/raw/study_plan/`, `data/raw/course/data.json` |
| `course_offering` | course_offer, schedule_guia, campus, academic_unit, academic_term, course | `data/raw/course_offering/`, `data/raw/professor/data.json` |

## Resumen de Comandos en Orden

```bash
# 1. Descargar datos base
uv run tec-data download

# 2. Procesar datos base
uv run tec-data process

# 3. Descargar planes de estudio
uv run tec-data download --entity study_plan

# 4. Procesar planes de estudio
uv run tec-data process --entity study_plan

# 5. Descargar oferta de cursos (año específico)
uv run tec-data download --entity course_offer --year 2026

# 6. Descargar horarios (año específico)
uv run tec-data download --entity schedule_guia --year 2026

# 7. Procesar oferta de cursos y horarios (año específico)
uv run tec-data process --entity course_offering --years 2026
```

## Generación de SQL

Para generar el archivo `../seed.sql` (en la raíz de supabase) con todos los datos:

```bash
uv run tec-data sql
```

O para entidades específicas:

```bash
uv run tec-data sql --tables campus,university,country
```

## Sincronización unificada de catálogo + oferta (local/prod)

Para ejecutar una sincronización idempotente completa (catálogo, planes, cursos, relaciones,
profesores y oferta), usa el comando unificado `sync`:

```bash
# Local (usa postgres local de Supabase)
uv run tec-data sync --target local --years 2026

# Remoto (lee .env.production.local)
uv run tec-data sync --target remote --years 2026 --env-file ../../.env.production.local

# DB URL explícita
uv run tec-data sync --target db-url --db-url "postgresql://..." --years 2026
```

Qué hace `sync`:

1. Ejecuta el pipeline completo de `download + process`.
2. Remapea IDs de todas las tablas sincronizadas por llaves naturales contra la DB destino.
3. Genera SQL full idempotente con upsert por llaves naturales.
4. Aplica el seed generado en la DB destino.
5. Ejecuta verificaciones post-sync.

Opciones útiles:

- `--skip-pipeline`: no vuelve a descargar/procesar; usa `data/raw` actual.
- `--no-apply`: solo genera SQL (no aplica).
- `--keep-sql`: conserva el archivo SQL generado.
