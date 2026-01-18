-- Function to update student course status
CREATE OR REPLACE FUNCTION update_student_course_status(
  p_user_id UUID,
  p_study_plan_id INTEGER,
  p_course_id INTEGER,
  p_status student_course_status
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.student_course_record (user_id, study_plan_id, course_id, status, recorded_at)
  VALUES (p_user_id, p_study_plan_id, p_course_id, p_status, NOW())
  ON CONFLICT (user_id, study_plan_id, course_id)
  DO UPDATE SET
    status = p_status,
    recorded_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_student_course_status TO authenticated;
