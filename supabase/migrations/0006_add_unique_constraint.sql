-- Add unique constraint to student_course_record for upsert functionality
ALTER TABLE public.student_course_record
DROP CONSTRAINT IF EXISTS student_course_record_user_course_plan_unique;

ALTER TABLE public.student_course_record
ADD CONSTRAINT student_course_record_user_course_plan_unique
UNIQUE (user_id, study_plan_id, course_id);
