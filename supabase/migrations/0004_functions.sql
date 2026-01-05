-- functions.sql
-- All database functions for user profile and dropdown loading.
-- Consolidates migrations 0004, 0005, and 0006.
--
-- IMPORTANT (SECURITY / SUPABASE LINTER):
-- - DO NOT use SECURITY DEFINER views. Supabase DB linter flags SECURITY DEFINER views because they can
--   execute with the view owner's privileges and bypass RLS expectations.
-- - These views are (and must remain) SECURITY INVOKER / default behavior.
-- - Underlying catalog tables are already RLS-enabled and readable (anon+authenticated) via 0002_rls.sql.
--
-- About hardening:
-- - We explicitly set helper functions to SECURITY INVOKER to avoid accidental privilege elevation.
-- - We also attempt to set views as security_invoker (Postgres 15+). If your Postgres version doesn't
--   support this, the views remain normal invoker views by default.

BEGIN;

-- ============================================================================
-- VIEW: universities (NO SECURITY DEFINER)
-- ============================================================================
-- Returns active universities that have at least one active campus.
DROP VIEW IF EXISTS public.v_universities;
CREATE VIEW public.v_universities
WITH (security_invoker = true)
AS
SELECT DISTINCT u.id, u.name, u.short_name
FROM public.university u
WHERE u.id IN (SELECT DISTINCT university_id FROM public.campus WHERE is_active = true)
ORDER BY u.name;

COMMENT ON VIEW public.v_universities IS 'Active universities that have campuses.';

-- ============================================================================
-- VIEW: campuses_by_university (NO SECURITY DEFINER)
-- ============================================================================
-- Returns active campuses.
DROP VIEW IF EXISTS public.v_campuses_by_university;
CREATE VIEW public.v_campuses_by_university
WITH (security_invoker = true)
AS
SELECT c.id, c.university_id, c.code, c.name
FROM public.campus c
WHERE c.is_active = true
ORDER BY c.name;

COMMENT ON VIEW public.v_campuses_by_university IS 'Active campuses, filterable by university_id.';

-- ============================================================================
-- VIEW: academic_units_with_plans (NO SECURITY DEFINER)
-- ============================================================================
-- Returns academic units (schools) that have study plans.
-- Used to populate school dropdown - only shows schools that actually offer plans.
DROP VIEW IF EXISTS public.v_academic_units_with_plans;
CREATE VIEW public.v_academic_units_with_plans
WITH (security_invoker = true)
AS
SELECT DISTINCT au.id, au.university_id, au.code, au.name
FROM public.academic_unit au
WHERE au.id IN (
  SELECT DISTINCT academic_unit_id
  FROM public.study_plan
)
ORDER BY au.name;

COMMENT ON VIEW public.v_academic_units_with_plans IS 'Academic units (schools) that have study plans.';

-- ============================================================================
-- VIEW: academic_units_for_campus
-- ============================================================================
-- Returns academic units (schools) available at active campuses.
DROP VIEW IF EXISTS public.v_academic_units_for_campus;
CREATE VIEW public.v_academic_units_for_campus
WITH (security_invoker = true)
AS
SELECT DISTINCT au.id, au.code, au.name
FROM public.academic_unit au
WHERE au.id IN (
  SELECT DISTINCT academic_unit_id
  FROM public.academic_unit_campus
  WHERE campus_id IN (SELECT id FROM public.campus WHERE is_active = true)
)
ORDER BY au.name;

COMMENT ON VIEW public.v_academic_units_for_campus IS 'Academic units available at active campuses.';

-- ============================================================================
-- VIEW: study_plans_for_academic_unit (NO SECURITY DEFINER)
-- ============================================================================
-- Returns study plans (Bachillerato, Licenciatura, etc.) for academic units.
DROP VIEW IF EXISTS public.v_study_plans_for_academic_unit;
CREATE VIEW public.v_study_plans_for_academic_unit
WITH (security_invoker = true)
AS
SELECT sp.id, sp.academic_unit_id, sp.external_plan_id, sp.name, sp.academic_degree,
       am.name AS modality_name
FROM public.study_plan sp
JOIN public.academic_modality am ON sp.academic_modality_id = am.id
ORDER BY sp.name;

COMMENT ON VIEW public.v_study_plans_for_academic_unit IS 'Study plans (degree variants) for academic units with modality info.';

-- ============================================================================
-- VIEW: study_plans_by_campus
-- ============================================================================
-- Returns study plans valid at active campuses.
DROP VIEW IF EXISTS public.v_study_plans_by_campus;
CREATE VIEW public.v_study_plans_by_campus
WITH (security_invoker = true)
AS
SELECT DISTINCT sp.id, sp.academic_unit_id, sp.external_plan_id, sp.name, sp.academic_degree
FROM public.study_plan sp
WHERE sp.academic_unit_id IN (
  SELECT DISTINCT academic_unit_id
  FROM public.academic_unit_campus
  WHERE campus_id IN (SELECT id FROM public.campus WHERE is_active = true)
)
ORDER BY sp.name;

COMMENT ON VIEW public.v_study_plans_by_campus IS 'Study plans available at active campuses.';

-- ============================================================================
-- FUNCTION: get_campuses_for_university (invoker)
-- ============================================================================
-- Returns active campuses (AL, CA, LM, SC, SJ) for a specific university.
CREATE OR REPLACE FUNCTION public.get_campuses_for_university(p_university_id BIGINT)
RETURNS TABLE (id BIGINT, university_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.university_id, c.code, c.name
  FROM public.campus c
  WHERE c.university_id = p_university_id
    AND c.is_active = true
    AND c.code = ANY(ARRAY['AL', 'CA', 'LM', 'SC', 'SJ']::TEXT[])
  ORDER BY c.name;
END;
$$;

COMMENT ON FUNCTION public.get_campuses_for_university IS 'Returns active campuses (AL, CA, LM, SC, SJ) for a specific university.';

-- ============================================================================
-- FUNCTION: get_academic_units_for_campus (invoker)
-- ============================================================================
-- Returns academic units available at a specific campus.
CREATE OR REPLACE FUNCTION public.get_academic_units_for_campus(p_campus_id BIGINT)
RETURNS TABLE (id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT au.id, au.code, au.name
  FROM public.academic_unit au
  INNER JOIN public.academic_unit_campus auc ON auc.academic_unit_id = au.id
  WHERE auc.campus_id = p_campus_id
  ORDER BY au.name;
END;
$$;

COMMENT ON FUNCTION public.get_academic_units_for_campus IS 'Returns academic units available at a specific campus.';

-- ============================================================================
-- FUNCTION: get_academic_units_for_university (invoker)
-- ============================================================================
-- Returns academic units with plans for a specific university.
CREATE OR REPLACE FUNCTION public.get_academic_units_for_university(p_university_id BIGINT)
RETURNS TABLE (id BIGINT, university_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.university_id, au.code, au.name
  FROM public.v_academic_units_with_plans au
  WHERE au.university_id = p_university_id
  ORDER BY au.name;
END;
$$;

COMMENT ON FUNCTION public.get_academic_units_for_university IS 'Returns academic units with plans for a specific university.';

-- ============================================================================
-- FUNCTION: get_study_plans_for_academic_unit (invoker)
-- ============================================================================
-- Returns study plans for a specific academic unit, ordered by newest first (higher external_plan_id = newer).
-- Format: "external_plan_id - name"
CREATE OR REPLACE FUNCTION public.get_study_plans_for_academic_unit(p_academic_unit_id BIGINT)
RETURNS TABLE (id BIGINT, academic_unit_id BIGINT, external_plan_id INTEGER, name TEXT, academic_degree TEXT)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id, 
    sp.academic_unit_id, 
    sp.external_plan_id, 
    sp.external_plan_id::TEXT || ' - ' || sp.name AS name, 
    sp.academic_degree
  FROM public.study_plan sp
  WHERE sp.academic_unit_id = p_academic_unit_id
  ORDER BY sp.external_plan_id DESC;
END;
$$;

COMMENT ON FUNCTION public.get_study_plans_for_academic_unit IS 'Returns study plans for a specific academic unit, ordered by newest first.';

-- ============================================================================
-- FUNCTION: derive_user_context_from_study_plan (invoker)
-- ============================================================================
-- Inverse derivation: from user_study_plan, derive all related entities.
-- Returns: university_id, campus_id, academic_unit_id, study_plan_id.
CREATE OR REPLACE FUNCTION public.derive_user_context_from_study_plan(p_study_plan_id BIGINT, p_campus_id BIGINT)
RETURNS TABLE (
  university_id BIGINT,
  campus_id BIGINT,
  academic_unit_id BIGINT,
  study_plan_id BIGINT
)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    univ.id AS university_id,
    p_campus_id AS campus_id,
    sp.academic_unit_id,
    sp.id AS study_plan_id
  FROM public.study_plan sp
  JOIN public.campus c ON c.id = p_campus_id
  JOIN public.university univ ON c.university_id = univ.id
  WHERE sp.id = p_study_plan_id;
END;
$$;

COMMENT ON FUNCTION public.derive_user_context_from_study_plan IS 'Derives university, academic_unit from study plan for UI population.';

-- ============================================================================
-- FUNCTION: get_user_profile_with_context (invoker)
-- ============================================================================
-- Returns complete user profile with derived context from their study plan.
-- Used when user already has data configured.
CREATE OR REPLACE FUNCTION public.get_user_profile_with_context(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  carnet TEXT,
  university_id BIGINT,
  university_name TEXT,
  campus_id BIGINT,
  campus_name TEXT,
  academic_unit_id BIGINT,
  academic_unit_name TEXT,
  study_plan_id BIGINT,
  study_plan_name TEXT,
  user_study_plan_id BIGINT,
  entry_year INTEGER
)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.carnet,
    ctx.university_id,
    univ.name AS university_name,
    ctx.campus_id,
    c.name AS campus_name,
    ctx.academic_unit_id,
    au.name AS academic_unit_name,
    ctx.study_plan_id,
    sp.name AS study_plan_name,
    usp.id AS user_study_plan_id,
    usp.entry_year
  FROM public."user" u
  LEFT JOIN public.user_study_plan usp ON u.id = usp.user_id AND usp.is_active = true
  LEFT JOIN LATERAL public.derive_user_context_from_study_plan(
    usp.study_plan_id,
    usp.campus_id
  ) ctx ON true
  LEFT JOIN public.university univ ON ctx.university_id = univ.id
  LEFT JOIN public.campus c ON ctx.campus_id = c.id
  LEFT JOIN public.academic_unit au ON ctx.academic_unit_id = au.id
  LEFT JOIN public.study_plan sp ON ctx.study_plan_id = sp.id
  WHERE u.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_profile_with_context IS 'Returns user profile with derived university/campus/academic_unit context.';

-- ============================================================================
-- FUNCTION: get_study_plan_courses_details (invoker)
-- ============================================================================
-- Returns all courses for a study plan with their details and level info.
CREATE OR REPLACE FUNCTION public.get_study_plan_courses_details(p_study_plan_id BIGINT)
RETURNS TABLE (
  course_id BIGINT,
  level_number INTEGER,
  credits INTEGER,
  weekly_hours INTEGER,
  sort_order INTEGER,
  course_code TEXT,
  course_name TEXT,
  default_credits INTEGER,
  default_weekly_hours INTEGER
)
LANGUAGE plpgsql
SET search_path = public
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    splc.course_id,
    spl.level_number,
    splc.credits,
    splc.weekly_hours,
    splc.sort_order,
    c.code AS course_code,
    c.name AS course_name,
    c.default_credits,
    c.default_weekly_hours
  FROM public.study_plan_level_course splc
  JOIN public.study_plan_level spl ON splc.study_plan_level_id = spl.id
  JOIN public.course c ON splc.course_id = c.id
  WHERE spl.study_plan_id = p_study_plan_id
  ORDER BY spl.level_number, splc.sort_order;
END;
$$;

COMMENT ON FUNCTION public.get_study_plan_courses_details IS 'Returns all courses for a study plan with details flattened.';

-- ============================================================================
-- SECURITY HARDENING (invoker)
-- ============================================================================
-- Ensure helper functions do not run with elevated privileges.
ALTER FUNCTION public.get_campuses_for_university(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_academic_units_for_campus(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_academic_units_for_university(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_study_plans_for_academic_unit(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.derive_user_context_from_study_plan(BIGINT, BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_user_profile_with_context(UUID) SECURITY INVOKER;
ALTER FUNCTION public.get_study_plan_courses_details(BIGINT) SECURITY INVOKER;

COMMIT;
