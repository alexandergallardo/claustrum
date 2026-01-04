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
CREATE OR REPLACE VIEW public.v_universities AS
SELECT DISTINCT u.id, u.name, u.short_name
FROM public.university u
WHERE u.id IN (SELECT DISTINCT university_id FROM public.campus WHERE is_active = true)
ORDER BY u.name;

COMMENT ON VIEW public.v_universities IS 'Active universities that have campuses.';

-- ============================================================================
-- VIEW: campuses_by_university (NO SECURITY DEFINER)
-- ============================================================================
-- Returns active campuses.
CREATE OR REPLACE VIEW public.v_campuses_by_university AS
SELECT c.id, c.university_id, c.code, c.name
FROM public.campus c
WHERE c.is_active = true
ORDER BY c.name;

COMMENT ON VIEW public.v_campuses_by_university IS 'Active campuses, filterable by university_id.';

-- ============================================================================
-- VIEW: academic_units_with_plans (NO SECURITY DEFINER)
-- ============================================================================
-- Returns academic units (schools) that have career programs with study plans.
-- Used to populate school dropdown - only shows schools that actually offer plans.
CREATE OR REPLACE VIEW public.v_academic_units_with_plans AS
SELECT DISTINCT au.id, au.university_id, au.code, au.name
FROM public.academic_unit au
WHERE au.offers_careers = true
  AND au.id IN (
    SELECT DISTINCT cp.academic_unit_id
    FROM public.career_program cp
    WHERE cp.id IN (SELECT DISTINCT sp.career_program_id FROM public.study_plan sp)
  )
ORDER BY au.name;

COMMENT ON VIEW public.v_academic_units_with_plans IS 'Academic units that offer careers with study plans.';

-- ============================================================================
-- VIEW: career_programs_with_study_plans (NO SECURITY DEFINER)
-- ============================================================================
-- Returns career programs that have associated study plans.
CREATE OR REPLACE VIEW public.v_career_programs_with_study_plans AS
SELECT DISTINCT cp.id, cp.academic_unit_id, cp.code, cp.name
FROM public.career_program cp
WHERE cp.id IN (SELECT DISTINCT sp.career_program_id FROM public.study_plan sp)
ORDER BY cp.name;

COMMENT ON VIEW public.v_career_programs_with_study_plans IS 'Career programs that have study plans.';

-- ============================================================================
-- VIEW: study_plans_extended (NO SECURITY DEFINER)
-- ============================================================================
-- Returns study plans with their academic unit and university info.
CREATE OR REPLACE VIEW public.v_study_plans_extended AS
SELECT
  sp.id,
  sp.career_program_id,
  sp.external_plan_id,
  sp.name,
  sp.academic_degree,
  cp.academic_unit_id,
  au.university_id,
  u.short_name AS university_short_name,
  au.name AS academic_unit_name
FROM public.study_plan sp
JOIN public.career_program cp ON sp.career_program_id = cp.id
JOIN public.academic_unit au ON cp.academic_unit_id = au.id
JOIN public.university u ON au.university_id = u.id
ORDER BY sp.name;

COMMENT ON VIEW public.v_study_plans_extended IS 'Study plans with academic unit and university info for UI derivation.';

-- ============================================================================
-- FUNCTION: get_campuses_for_university (invoker)
-- ============================================================================
-- Returns active campuses (AL, CA, LM, SC, SJ) for a specific university.
CREATE OR REPLACE FUNCTION public.get_campuses_for_university(p_university_id BIGINT)
RETURNS TABLE (id BIGINT, university_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
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
-- FUNCTION: get_career_programs_for_campus (invoker)
-- ============================================================================
-- Returns career programs with study plans that are valid at a specific campus.
-- Simplified loading: university -> campus -> career -> plan.
CREATE OR REPLACE FUNCTION public.get_career_programs_for_campus(p_campus_id BIGINT)
RETURNS TABLE (id BIGINT, academic_unit_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT cp.id, cp.academic_unit_id, cp.code, cp.name
  FROM public.career_program cp
  INNER JOIN public.study_plan sp ON sp.career_program_id = cp.id
  INNER JOIN public.study_plan_campus spc ON spc.study_plan_id = sp.id
  WHERE spc.campus_id = p_campus_id
  ORDER BY cp.name;
END;
$$;

COMMENT ON FUNCTION public.get_career_programs_for_campus IS 'Returns career programs with plans for a specific campus.';

-- ============================================================================
-- FUNCTION: get_academic_units_for_university (invoker)
-- ============================================================================
-- Returns academic units with plans for a specific university.
CREATE OR REPLACE FUNCTION public.get_academic_units_for_university(p_university_id BIGINT)
RETURNS TABLE (id BIGINT, university_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
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
-- FUNCTION: get_career_programs_for_academic_unit (invoker)
-- ============================================================================
-- Returns career programs with plans for a specific academic unit.
CREATE OR REPLACE FUNCTION public.get_career_programs_for_academic_unit(p_academic_unit_id BIGINT)
RETURNS TABLE (id BIGINT, academic_unit_id BIGINT, code TEXT, name TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.id, cp.academic_unit_id, cp.code, cp.name
  FROM public.v_career_programs_with_study_plans cp
  WHERE cp.academic_unit_id = p_academic_unit_id
  ORDER BY cp.name;
END;
$$;

COMMENT ON FUNCTION public.get_career_programs_for_academic_unit IS 'Returns career programs with plans for a specific academic unit.';

-- ============================================================================
-- FUNCTION: get_study_plans_for_career_program (invoker)
-- ============================================================================
-- Returns study plans for a specific career program, ordered by newest first (higher external_plan_id = newer).
-- Format: "external_plan_id - name"
CREATE OR REPLACE FUNCTION public.get_study_plans_for_career_program(p_career_program_id BIGINT)
RETURNS TABLE (id BIGINT, career_program_id BIGINT, external_plan_id INTEGER, name TEXT, academic_degree TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id, 
    sp.career_program_id, 
    sp.external_plan_id, 
    sp.external_plan_id::TEXT || ' - ' || sp.name AS name, 
    sp.academic_degree
  FROM public.study_plan sp
  WHERE sp.career_program_id = p_career_program_id
  ORDER BY sp.external_plan_id DESC;
END;
$$;

COMMENT ON FUNCTION public.get_study_plans_for_career_program IS 'Returns study plans for a specific career program, ordered by newest first, format: "external_plan_id - name".';

-- ============================================================================
-- FUNCTION: derive_user_context_from_study_plan (invoker)
-- ============================================================================
-- Inverse derivation: from user_study_plan, derive all related entities.
-- Returns: university_id, campus_id, academic_unit_id, career_program_id, study_plan_id.
CREATE OR REPLACE FUNCTION public.derive_user_context_from_study_plan(p_study_plan_id BIGINT, p_campus_id BIGINT)
RETURNS TABLE (
  university_id BIGINT,
  campus_id BIGINT,
  academic_unit_id BIGINT,
  career_program_id BIGINT,
  study_plan_id BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    univ.id AS university_id,
    p_campus_id AS campus_id,
    au.id AS academic_unit_id,
    cp.id AS career_program_id,
    sp.id AS study_plan_id
  FROM public.study_plan sp
  JOIN public.career_program cp ON sp.career_program_id = cp.id
  JOIN public.academic_unit au ON cp.academic_unit_id = au.id
  JOIN public.university univ ON au.university_id = univ.id
  WHERE sp.id = p_study_plan_id;
END;
$$;

COMMENT ON FUNCTION public.derive_user_context_from_study_plan IS 'Derives university, unit, program from study plan for UI population.';

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
  career_program_id BIGINT,
  career_program_name TEXT,
  study_plan_id BIGINT,
  study_plan_name TEXT,
  user_study_plan_id BIGINT,
  entry_year INTEGER
)
LANGUAGE plpgsql
SET search_path = public
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
    ctx.career_program_id,
    cp.name AS career_program_name,
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
  LEFT JOIN public.career_program cp ON ctx.career_program_id = cp.id
  LEFT JOIN public.study_plan sp ON ctx.study_plan_id = sp.id
  WHERE u.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_profile_with_context IS 'Returns user profile with derived university/campus/unit context.';

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
ALTER FUNCTION public.get_career_programs_for_campus(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_academic_units_for_university(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_career_programs_for_academic_unit(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_study_plans_for_career_program(BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.derive_user_context_from_study_plan(BIGINT, BIGINT) SECURITY INVOKER;
ALTER FUNCTION public.get_user_profile_with_context(UUID) SECURITY INVOKER;
ALTER FUNCTION public.get_study_plan_courses_details(BIGINT) SECURITY INVOKER;

-- Attempt to force SECURITY INVOKER behavior for views (Postgres 15+).
-- If your project runs on a Postgres version that doesn't support this, you'll need to remove these
-- statements and rely on the default invoker behavior of views (and ensure they are not SECURITY DEFINER).
ALTER VIEW public.v_universities SET (security_invoker = true);
ALTER VIEW public.v_campuses_by_university SET (security_invoker = true);
ALTER VIEW public.v_academic_units_with_plans SET (security_invoker = true);
ALTER VIEW public.v_career_programs_with_study_plans SET (security_invoker = true);
ALTER VIEW public.v_study_plans_extended SET (security_invoker = true);

COMMIT;
