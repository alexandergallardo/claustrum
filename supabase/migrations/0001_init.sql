-- 0001_init.sql
-- Initial schema: extensions, enums, tables, constraints (PK/UK/FK/CHECK), and triggers/functions.
--
-- Notes / conventions:
-- - This migration intentionally DOES NOT create RLS policies or enable RLS. That is handled in `0002_rls.sql`.
-- - Most non-unique indexes are also deferred to `0003_indexes.sql` to keep concerns separated.
-- - All tables live in `public` unless otherwise noted.

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- For legacy uuid generation if needed. Supabase often uses gen_random_uuid() via pgcrypto,
-- but this project schema was originally generated with uuid-ossp.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_relation_type') THEN
    CREATE TYPE course_relation_type AS ENUM (
      'PREREQUISITE',
      'COREQUISITE',
      'EQUIVALENT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_course_status') THEN
    CREATE TYPE student_course_status AS ENUM (
      'PASSED',
      'FAILED',
      'IN_PROGRESS',
      'WITHDRAWN',
      'APPROVED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_type') THEN
    CREATE TYPE course_type AS ENUM (
      'Curso Unico',
      'Curso Comun',
      'Electiva Unica'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_type') THEN
    CREATE TYPE group_type AS ENUM (
      'Regular',
      'Semipresencial',
      'Virtual',
      'Asistida'
    );
  END IF;
END $$;

-- ============================================================================
-- TABLES (CATALOG / REFERENCE DATA)
-- These are primarily read-only from the app perspective and populated by admin/seeds/sync scripts.
-- ============================================================================

-- Countries (ISO-3166 alpha-2)
CREATE TABLE IF NOT EXISTS public.country (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  iso2_code  CHAR(2) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.country IS 'Reference table for countries (ISO-3166 alpha-2).';
COMMENT ON COLUMN public.country.iso2_code IS 'ISO-3166 alpha-2 country code (unique).';

-- Universities (e.g., ITCR)
CREATE TABLE IF NOT EXISTS public.university (
  id         BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL,
  name       TEXT NOT NULL,
  short_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT university_country_id_fkey
    FOREIGN KEY (country_id)
    REFERENCES public.country(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.university IS 'Universities / institutions; currently used for ITCR and future expansion.';
COMMENT ON COLUMN public.university.short_name IS 'Short display name (e.g., ITCR).';

-- Campuses / sedes (code used across multiple external APIs)
CREATE TABLE IF NOT EXISTS public.campus (
  id            BIGSERIAL PRIMARY KEY,
  university_id BIGINT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  opened_on     DATE,
  closed_on     DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campus_university_id_fkey
    FOREIGN KEY (university_id)
    REFERENCES public.university(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.campus IS 'Campus/site (sede). `code` is the canonical cross-API identifier (e.g., CA, SJ).';

-- Academic Units (schools/departments offering courses; some also offer degree programs)
CREATE TABLE IF NOT EXISTS public.academic_unit (
  id             BIGSERIAL PRIMARY KEY,
  university_id  BIGINT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  offers_careers BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT academic_unit_university_id_fkey
    FOREIGN KEY (university_id)
    REFERENCES public.university(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.academic_unit IS 'School/department (escuela/departamento). May or may not have careers (degree programs).';
COMMENT ON COLUMN public.academic_unit.offers_careers IS 'True when unit appears as a career/program provider in curriculum endpoints.';

-- Academic modalities (Semestre/Verano/etc.) from guiahorarios
CREATE TABLE IF NOT EXISTS public.academic_modality (
  id               BIGSERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  periods_per_year INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.academic_modality IS 'Catalog of academic modalities (S=Semestre, V=Verano, etc.).';

-- Academic terms (specific year + modality + period number, plus external key)
CREATE TABLE IF NOT EXISTS public.academic_term (
  id                  BIGSERIAL PRIMARY KEY,
  academic_modality_id BIGINT NOT NULL,
  year                INTEGER NOT NULL,
  period_number       INTEGER NOT NULL,
  external_key        TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  starts_on           DATE,
  ends_on             DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT academic_term_academic_modality_id_fkey
    FOREIGN KEY (academic_modality_id)
    REFERENCES public.academic_modality(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.academic_term IS 'Academic period instance: year + modality + period_number; external_key matches upstream keys (e.g., 2026_S_1, VER-2025).';

-- ============================================================================
-- PROGRAM / CURRICULUM TABLES
-- ============================================================================

-- Academic unit offered at campus (many-to-many)
CREATE TABLE IF NOT EXISTS public.academic_unit_campus (
  id               BIGSERIAL PRIMARY KEY,
  academic_unit_id BIGINT NOT NULL,
  campus_id        BIGINT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT academic_unit_campus_academic_unit_id_fkey
    FOREIGN KEY (academic_unit_id)
    REFERENCES public.academic_unit(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT academic_unit_campus_campus_id_fkey
    FOREIGN KEY (campus_id)
    REFERENCES public.campus(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT academic_unit_campus_unique_unit_campus
    UNIQUE (academic_unit_id, campus_id)
);

COMMENT ON TABLE public.academic_unit_campus IS 'Join table: which academic units (schools/careers) are offered at which campuses.';

-- Study plan / curriculum (plan de estudio)
CREATE TABLE IF NOT EXISTS public.study_plan (
  id                   BIGSERIAL PRIMARY KEY,
  academic_unit_id     BIGINT NOT NULL,
  academic_modality_id BIGINT NOT NULL,
  external_plan_id     INTEGER NOT NULL,
  name                 TEXT NOT NULL,
  academic_degree      TEXT,
  first_level_number   INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT study_plan_academic_unit_id_fkey
    FOREIGN KEY (academic_unit_id)
    REFERENCES public.academic_unit(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_academic_modality_id_fkey
    FOREIGN KEY (academic_modality_id)
    REFERENCES public.academic_modality(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_unique_unit_external
    UNIQUE (academic_unit_id, external_plan_id)
);

COMMENT ON TABLE public.study_plan IS 'Curriculum/study plan version (Bachillerato, Licenciatura, etc.) for an academic unit; external_plan_id comes from upstream plan id.';

-- Study plan valid at campus (many-to-many + optional validity dates)
CREATE TABLE IF NOT EXISTS public.study_plan_campus (
  id           BIGSERIAL PRIMARY KEY,
  study_plan_id BIGINT NOT NULL,
  campus_id    BIGINT NOT NULL,
  valid_from   DATE,
  valid_to     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT study_plan_campus_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_campus_campus_id_fkey
    FOREIGN KEY (campus_id)
    REFERENCES public.campus(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_campus_unique_plan_campus
    UNIQUE (study_plan_id, campus_id)
);

COMMENT ON TABLE public.study_plan_campus IS 'Join table: where/when a study plan is valid; supports campus availability rules.';

-- ============================================================================
-- COURSE TABLES
-- ============================================================================

-- Canonical course catalog
CREATE TABLE IF NOT EXISTS public.course (
  id                   BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  default_credits      INTEGER NOT NULL DEFAULT 0,
  default_weekly_hours INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.course IS 'Canonical course catalog. `code` is the official course code (e.g., IC1802). Courses are shared across multiple study plans without a single owning unit.';

-- Plan levels (e.g., Semestre 0, Semestre 1)
CREATE TABLE IF NOT EXISTS public.study_plan_level (
  id           BIGSERIAL PRIMARY KEY,
  study_plan_id BIGINT NOT NULL,
  level_number INTEGER NOT NULL,
  level_label  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT study_plan_level_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_level_unique_plan_level
    UNIQUE (study_plan_id, level_number)
);

COMMENT ON TABLE public.study_plan_level IS 'A level/semester inside a study plan; label is upstream text, level_number is normalized ordering.';

-- Courses in plan level (join + course attributes as defined in plan)
CREATE TABLE IF NOT EXISTS public.study_plan_level_course (
  id                 BIGSERIAL PRIMARY KEY,
  study_plan_level_id BIGINT NOT NULL,
  course_id          BIGINT NOT NULL,
  credits            INTEGER NOT NULL,
  weekly_hours       INTEGER NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT study_plan_level_course_level_id_fkey
    FOREIGN KEY (study_plan_level_id)
    REFERENCES public.study_plan_level(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_level_course_course_id_fkey
    FOREIGN KEY (course_id)
    REFERENCES public.course(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT study_plan_level_course_unique_level_course
    UNIQUE (study_plan_level_id, course_id)
);

COMMENT ON TABLE public.study_plan_level_course IS 'Join table: courses included in a specific study plan level (with credits/hours as per plan).';

-- Course relations in a plan (prereq/coreq/equivalent)
CREATE TABLE IF NOT EXISTS public.course_relation (
  id            BIGSERIAL PRIMARY KEY,
  study_plan_id BIGINT NOT NULL,
  from_course_id BIGINT NOT NULL,
  to_course_id  BIGINT NOT NULL,
  relation_type course_relation_type NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_relation_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT course_relation_from_course_id_fkey
    FOREIGN KEY (from_course_id)
    REFERENCES public.course(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_relation_to_course_id_fkey
    FOREIGN KEY (to_course_id)
    REFERENCES public.course(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_relation_unique
    UNIQUE (study_plan_id, from_course_id, to_course_id, relation_type)
);

COMMENT ON TABLE public.course_relation IS 'Prerequisite/corequisite/equivalent constraints for courses within a study plan.';

-- ============================================================================
-- COURSE OFFERING TABLES (SCHEDULE)
--
-- Term representation:
-- - `academic_term.external_key` stores the term key used by the Student Records endpoints
--   (e.g., "2026_S_1"), which is required to query the schedule guide HTML table.
-- - Guía Horarios provides schedule rows per (school, year) and includes modality/period fields
--   (NUM_ANO, IDE_MODALIDAD, IDE_PER_MOD) that can be normalized to the same key format
--   ("{NUM_ANO}_{IDE_MODALIDAD}_{IDE_PER_MOD}") to join/enrich schedule data.
-- ============================================================================

-- Professors (normalized by full name; upstream varies in casing)
CREATE TABLE IF NOT EXISTS public.professor (
  id        BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.professor IS 'Professor/instructor catalog (deduped by full_name).';

-- Course offering (header-level) for campus + term + publishing unit
--
-- Uniqueness:
-- A course offering is uniquely identified by (course_id, campus_id, academic_unit_id, academic_term_id).
-- This supports repeated ingestion runs via upsert semantics without creating duplicates.
CREATE TABLE IF NOT EXISTS public.course_offering (
  id                  BIGSERIAL PRIMARY KEY,
  course_id           BIGINT NOT NULL,
  campus_id           BIGINT NOT NULL,
  academic_unit_id    BIGINT NOT NULL,
  academic_term_id    BIGINT NOT NULL,
  course_name_snapshot TEXT NOT NULL,
  credits_snapshot    INTEGER NOT NULL,
  weekly_hours_snapshot INTEGER NOT NULL,
  course_type         course_type,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_offering_course_id_fkey
    FOREIGN KEY (course_id)
    REFERENCES public.course(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_campus_id_fkey
    FOREIGN KEY (campus_id)
    REFERENCES public.campus(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_academic_unit_id_fkey
    FOREIGN KEY (academic_unit_id)
    REFERENCES public.academic_unit(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_academic_term_id_fkey
    FOREIGN KEY (academic_term_id)
    REFERENCES public.academic_term(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_unique_course_campus_unit_term
    UNIQUE (course_id, campus_id, academic_unit_id, academic_term_id)
);

COMMENT ON TABLE public.course_offering IS 'A course offered at a campus during a term (header). Snapshots preserve upstream display values at the time of ingestion.';

-- Groups/sections for an offering
CREATE TABLE IF NOT EXISTS public.course_offering_group (
  id                BIGSERIAL PRIMARY KEY,
  course_offering_id BIGINT NOT NULL,
  group_code        TEXT NOT NULL,
  group_type        group_type NOT NULL,
  classroom         TEXT,
  capacity          INTEGER NOT NULL DEFAULT 0,
  reserved_seats    INTEGER NOT NULL DEFAULT 0,
  enrolled_count    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_offering_group_course_offering_id_fkey
    FOREIGN KEY (course_offering_id)
    REFERENCES public.course_offering(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_group_unique
    UNIQUE (course_offering_id, group_code)
);

COMMENT ON TABLE public.course_offering_group IS 'Specific group/section within a course offering (e.g., Grupo 01).';

-- Group-professor join (many-to-many)
CREATE TABLE IF NOT EXISTS public.course_offering_group_professor (
  id                     BIGSERIAL PRIMARY KEY,
  course_offering_group_id BIGINT NOT NULL,
  professor_id           BIGINT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_offering_group_professor_group_id_fkey
    FOREIGN KEY (course_offering_group_id)
    REFERENCES public.course_offering_group(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_group_professor_professor_id_fkey
    FOREIGN KEY (professor_id)
    REFERENCES public.professor(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_group_professor_unique
    UNIQUE (course_offering_group_id, professor_id)
);

COMMENT ON TABLE public.course_offering_group_professor IS 'Join table: professors assigned to a specific offering group.';

-- Meetings (weekday/time) for a group
--
-- Uniqueness:
-- A meeting row is uniquely identified by
-- (course_offering_group_id, weekday, starts_at, ends_at).
-- This allows the ingestion to upsert meetings without producing duplicates across multiple runs.
CREATE TABLE IF NOT EXISTS public.course_offering_meeting (
  id                     BIGSERIAL PRIMARY KEY,
  course_offering_group_id BIGINT NOT NULL,
  weekday                INTEGER NOT NULL,
  starts_at              TIME NOT NULL,
  ends_at                TIME NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_offering_meeting_course_offering_group_id_fkey
    FOREIGN KEY (course_offering_group_id)
    REFERENCES public.course_offering_group(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_meeting_weekday_check
    CHECK (weekday BETWEEN 1 AND 7),

  CONSTRAINT course_offering_meeting_unique
    UNIQUE (course_offering_group_id, weekday, starts_at, ends_at)
);

COMMENT ON TABLE public.course_offering_meeting IS 'Normalized schedule meeting rows (weekday/time) for a group; one row per meeting.';

-- Reservations (reserved seats with optional targeting)
--
-- The schema supports reservation targeting via nullable foreign keys:
-- - campus_id, academic_unit_id, study_plan_id
-- When targeting is known, a reservation row represents reserved seats constrained to that target.
-- When targeting is unknown or not provided by upstream sources, an untargeted row may be stored
-- with all three targeting columns set to NULL.
--
-- Uniqueness:
-- A reservation row is uniquely identified by
-- (course_offering_group_id, campus_id, academic_unit_id, study_plan_id).
-- This allows combining seat counts from one source with targeting from another source while keeping
-- ingestion idempotent across repeated runs.
CREATE TABLE IF NOT EXISTS public.course_offering_reservation (
  id                     BIGSERIAL PRIMARY KEY,
  course_offering_group_id BIGINT NOT NULL,
  campus_id              BIGINT,
  academic_unit_id       BIGINT,
  study_plan_id          BIGINT,
  reserved_seats         INTEGER,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT course_offering_reservation_group_id_fkey
    FOREIGN KEY (course_offering_group_id)
    REFERENCES public.course_offering_group(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_reservation_campus_id_fkey
    FOREIGN KEY (campus_id)
    REFERENCES public.campus(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_reservation_academic_unit_id_fkey
    FOREIGN KEY (academic_unit_id)
    REFERENCES public.academic_unit(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_reservation_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT course_offering_reservation_unique
    UNIQUE (course_offering_group_id, campus_id, academic_unit_id, study_plan_id)
);

COMMENT ON TABLE public.course_offering_reservation IS 'Optional reservation targeting for groups (campus/unit/plan) when upstream provides constraints.';

-- ============================================================================
-- USER / STUDENT DATA TABLES (RLS will be enabled + policies in 0002_rls.sql)
-- ============================================================================

-- User profile (links to auth.users)
CREATE TABLE IF NOT EXISTS public."user" (
  id         UUID PRIMARY KEY,
  carnet     TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public."user" IS 'App user profile (student). Only stores carnet; other identity fields exist in auth.users.';

-- User study plans (declared plan context)
CREATE TABLE IF NOT EXISTS public.user_study_plan (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  study_plan_id BIGINT NOT NULL,
  campus_id    BIGINT NOT NULL,
  entry_year   INTEGER NOT NULL,
  started_on   DATE,
  ended_on     DATE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_study_plan_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public."user"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT user_study_plan_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT user_study_plan_campus_id_fkey
    FOREIGN KEY (campus_id)
    REFERENCES public.campus(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT user_study_plan_unique
    UNIQUE (user_id, study_plan_id, campus_id)
);

COMMENT ON TABLE public.user_study_plan IS 'User declared study plan + campus context (used for eligibility checks and personalization).';

-- Student course records (app-managed transcript-like history)
CREATE TABLE IF NOT EXISTS public.student_course_record (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL,
  study_plan_id   BIGINT NOT NULL,
  course_id       BIGINT NOT NULL,
  academic_term_id BIGINT NOT NULL,
  status          student_course_status NOT NULL,
  grade           NUMERIC(5,2),
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT student_course_record_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public."user"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT student_course_record_study_plan_id_fkey
    FOREIGN KEY (study_plan_id)
    REFERENCES public.study_plan(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT student_course_record_course_id_fkey
    FOREIGN KEY (course_id)
    REFERENCES public.course(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT student_course_record_academic_term_id_fkey
    FOREIGN KEY (academic_term_id)
    REFERENCES public.academic_term(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.student_course_record IS 'User course history (status/grade/approved) used for eligibility and filtering.';

-- Saved schedules (user-defined collections)
CREATE TABLE IF NOT EXISTS public.saved_schedule (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  academic_term_id BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT saved_schedule_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public."user"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT saved_schedule_academic_term_id_fkey
    FOREIGN KEY (academic_term_id)
    REFERENCES public.academic_term(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.saved_schedule IS 'User-defined saved schedule (not enrollment).';

-- Saved schedule items (groups chosen in a saved schedule)
CREATE TABLE IF NOT EXISTS public.saved_schedule_item (
  id                     BIGSERIAL PRIMARY KEY,
  saved_schedule_id      BIGINT NOT NULL,
  course_offering_group_id BIGINT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT saved_schedule_item_saved_schedule_id_fkey
    FOREIGN KEY (saved_schedule_id)
    REFERENCES public.saved_schedule(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT saved_schedule_item_course_offering_group_id_fkey
    FOREIGN KEY (course_offering_group_id)
    REFERENCES public.course_offering_group(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT saved_schedule_item_unique
    UNIQUE (saved_schedule_id, course_offering_group_id)
);

COMMENT ON TABLE public.saved_schedule_item IS 'Selected offering groups inside a saved schedule.';

-- ============================================================================
-- HELPER FUNCTIONS + TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function (public)
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_set_timestamp() IS 'Generic trigger to set updated_at=now() on UPDATE.';

-- Apply updated_at triggers to tables that define updated_at
DO $$
BEGIN
  -- user
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_user') THEN
    CREATE TRIGGER set_timestamp_user
      BEFORE UPDATE ON public."user"
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- university
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_university') THEN
    CREATE TRIGGER set_timestamp_university
      BEFORE UPDATE ON public.university
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- campus
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_campus') THEN
    CREATE TRIGGER set_timestamp_campus
      BEFORE UPDATE ON public.campus
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- academic_unit
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_academic_unit') THEN
    CREATE TRIGGER set_timestamp_academic_unit
      BEFORE UPDATE ON public.academic_unit
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- academic_modality
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_academic_modality') THEN
    CREATE TRIGGER set_timestamp_academic_modality
      BEFORE UPDATE ON public.academic_modality
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- academic_term
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_academic_term') THEN
    CREATE TRIGGER set_timestamp_academic_term
      BEFORE UPDATE ON public.academic_term
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- study_plan
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_study_plan') THEN
    CREATE TRIGGER set_timestamp_study_plan
      BEFORE UPDATE ON public.study_plan
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- course
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_course') THEN
    CREATE TRIGGER set_timestamp_course
      BEFORE UPDATE ON public.course
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;

  -- saved_schedule
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_saved_schedule') THEN
    CREATE TRIGGER set_timestamp_saved_schedule
      BEFORE UPDATE ON public.saved_schedule
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
END $$;

-- Auto-create user profile upon auth.users insert
-- SECURITY DEFINER because it must insert into public."user" regardless of caller privileges,
-- and will be invoked by an auth trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."user" (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function: when a new auth user is created, create a matching row in public.user (profile).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

COMMIT;
