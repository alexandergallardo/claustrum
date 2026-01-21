-- Fix search_path security issues in existing functions

-- Update update_student_course_status to set search_path
CREATE OR REPLACE FUNCTION public.update_student_course_status(
  p_user_id UUID,
  p_study_plan_id BIGINT,
  p_course_id BIGINT,
  p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE user_course_status
  SET status = p_status, updated_at = NOW()
  WHERE user_id = p_user_id
    AND study_plan_id = p_study_plan_id
    AND course_id = p_course_id;

  IF NOT FOUND THEN
    INSERT INTO user_course_status (user_id, study_plan_id, course_id, status, created_at, updated_at)
    VALUES (p_user_id, p_study_plan_id, p_course_id, p_status, NOW(), NOW());
    RETURN 'inserted';
  END IF;

  RETURN 'updated';
END;
$$;

COMMENT ON FUNCTION public.update_student_course_status IS 'Updates or inserts a course status for a user';

-- Update delete_student_course_status to set search_path
CREATE OR REPLACE FUNCTION public.delete_student_course_status(
  p_user_id UUID,
  p_study_plan_id BIGINT,
  p_course_id BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM user_course_status
  WHERE user_id = p_user_id
    AND study_plan_id = p_study_plan_id
    AND course_id = p_course_id;

  IF FOUND THEN
    RETURN 'deleted';
  END IF;

  RETURN 'not_found';
END;
$$;

COMMENT ON FUNCTION public.delete_student_course_status IS 'Deletes a course status for a user';

-- Update get_user_dashboard_stats to set search_path (already has it but let's verify)
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id UUID, p_study_plan_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_stats JSON;
  v_semesters JSON;
  v_next_courses JSON;
BEGIN
  -- Calculate overall stats
  WITH course_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'approved') AS completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE status = 'withdrawn') AS withdrawn,
      COUNT(*) FILTER (WHERE status = 'not_taken' OR status IS NULL) AS not_taken,
      SUM(credits) FILTER (WHERE status = 'approved') AS completed_credits,
      COUNT(*) AS total,
      SUM(credits) AS total_credits
    FROM user_course_status
    WHERE user_id = p_user_id AND study_plan_id = p_study_plan_id
  )
  SELECT json_build_object(
    'totalCourses', COALESCE((SELECT total FROM course_stats), 0),
    'completedCourses', COALESCE((SELECT completed FROM course_stats), 0),
    'inProgressCourses', COALESCE((SELECT in_progress FROM course_stats), 0),
    'failedCourses', COALESCE((SELECT failed FROM course_stats), 0),
    'withdrawnCourses', COALESCE((SELECT withdrawn FROM course_stats), 0),
    'notTakenCourses', COALESCE((SELECT not_taken FROM course_stats), 0),
    'totalCredits', COALESCE((SELECT total_credits FROM course_stats), 0),
    'completedCredits', COALESCE((SELECT completed_credits FROM course_stats), 0),
    'currentSemester', COALESCE((
      SELECT MAX(level_number)
      FROM user_course_status ucs
      JOIN study_plan_course spc ON spc.id = ucs.course_id
      WHERE ucs.user_id = p_user_id AND ucs.study_plan_id = p_study_plan_id
      AND ucs.status IN ('approved', 'in_progress')
    ), 0),
    'progressPercentage', CASE
      WHEN (SELECT total FROM course_stats) > 0 THEN
        ROUND(((SELECT completed FROM course_stats)::numeric / (SELECT total FROM course_stats)::numeric) * 100)::int
      ELSE 0
    END
  ) INTO v_stats;

  -- Calculate semester progress
  SELECT json_agg(
    json_build_object(
      'levelNumber', spc.level_number,
      'levelLabel', 'Semestre ' || spc.level_number::text,
      'totalCourses', sem.total,
      'completedCourses', sem.completed,
      'credits', sem.credits,
      'completedCredits', sem.completed_credits,
      'status', CASE
        WHEN sem.completed = sem.total THEN 'completed'
        WHEN sem.completed > 0 OR sem.in_progress > 0 THEN 'in_progress'
        ELSE 'pending'
      END
    ) ORDER BY spc.level_number
  ) INTO v_semesters
  FROM (
    SELECT
      spc.level_number,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ucs.status = 'approved') AS completed,
      SUM(spc.credits) AS credits,
      SUM(spc.credits) FILTER (WHERE ucs.status = 'approved') AS completed_credits,
      COUNT(*) FILTER (WHERE ucs.status = 'in_progress') AS in_progress
    FROM study_plan_course spc
    LEFT JOIN user_course_status ucs ON ucs.course_id = spc.id
      AND ucs.user_id = p_user_id
      AND ucs.study_plan_id = p_study_plan_id
    WHERE spc.study_plan_id = p_study_plan_id
    GROUP BY spc.level_number
  ) sem;

  -- Get next available courses (prerequisites met or no prerequisites)
  WITH next_courses AS (
    SELECT
      spc.id::text AS id,
      spc.course_code AS code,
      spc.course_name AS name,
      spc.credits AS credits,
      'Semestre ' || spc.level_number::text AS levelLabel,
      ARRAY(
        SELECT json_agg(prereq.course_code::text)
        FROM study_plan_course prereq
        JOIN course_relation cr ON cr.to_course_id = spc.id AND cr.relation_type = 'PREREQUISITE'
        WHERE prereq.id = cr.from_course_id
      ) AS prerequisites
    FROM study_plan_course spc
    WHERE spc.study_plan_id = p_study_plan_id
    AND spc.id NOT IN (
      SELECT course_id FROM user_course_status
      WHERE user_id = p_user_id AND study_plan_id = p_study_plan_id
      AND status IN ('approved', 'in_progress')
    )
    AND NOT EXISTS (
      SELECT 1 FROM course_relation cr
      WHERE cr.to_course_id = spc.id AND cr.relation_type = 'PREREQUISITE'
      AND cr.from_course_id NOT IN (
        SELECT course_id FROM user_course_status
        WHERE user_id = p_user_id AND study_plan_id = p_study_plan_id AND status = 'approved'
      )
    )
    ORDER BY spc.level_number, spc.course_code
    LIMIT 10
  )
  SELECT json_agg(json_build_object(
    'id', id,
    'code', code,
    'name', name,
    'credits', credits,
    'levelLabel', levelLabel,
    'prerequisites', prerequisites
  )) INTO v_next_courses
  FROM next_courses;

  RETURN json_build_object(
    'stats', v_stats,
    'semesters', COALESCE(v_semesters, '[]'::json),
    'nextCourses', COALESCE(v_next_courses, '[]'::json)
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_dashboard_stats IS 'Returns dashboard statistics for a user study plan';
