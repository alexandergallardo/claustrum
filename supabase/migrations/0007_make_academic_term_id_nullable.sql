-- Make academic_term_id nullable in student_course_record
ALTER TABLE public.student_course_record
ALTER COLUMN academic_term_id DROP NOT NULL;
