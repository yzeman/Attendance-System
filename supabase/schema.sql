-- ============================================
-- SMART ATTENDANCE SYSTEM - SUPABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  full_name TEXT NOT NULL,
  matric_no TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  face_descriptors JSONB DEFAULT '[]'::jsonb,
  enrolled_courses UUID[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. COURSES TABLE
-- ============================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_code TEXT UNIQUE NOT NULL,
  course_name TEXT NOT NULL,
  lecturer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ATTENDANCE TABLE
-- ============================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_attendance_student ON public.attendance(student_id);
CREATE INDEX idx_attendance_course ON public.attendance(course_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_users_matric ON public.users(matric_no);
CREATE INDEX idx_users_role ON public.users(role);

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES FOR users TABLE
-- ============================================

-- Students can read their own data; admins can read all
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR 
    auth.jwt() ->> 'role' = 'admin'
  );

-- Users can update their own data
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own data (registration)
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 7. RLS POLICIES FOR courses TABLE
-- ============================================

-- Any authenticated user can view courses
CREATE POLICY "Authenticated can view courses" ON public.courses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert courses
CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Only admins can update courses
CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Only admins can delete courses
CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 8. RLS POLICIES FOR attendance TABLE
-- ============================================

-- Students can insert their own attendance
CREATE POLICY "Students can insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Students can view their own attendance; admins view all
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT USING (
    auth.uid() = student_id OR 
    auth.jwt() ->> 'role' = 'admin'
  );

-- Only admins can update attendance
CREATE POLICY "Admins can update attendance" ON public.attendance
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample courses
INSERT INTO public.courses (course_code, course_name, lecturer) VALUES
('SWD101', 'Introduction to Web Development', 'Mr. Nta Lawal'),
('SWD202', 'Database Systems', 'Dr. Adebayo'),
('SWD305', 'Software Engineering', 'Prof. Ogunleye'),
('SWD408', 'Mobile Application Development', 'Mr. Ogunbiyi'),
('SWD501', 'Project Management', 'Dr. Faleye');

-- ============================================
-- 10. HELPER FUNCTION: Get attendance summary
-- ============================================

CREATE OR REPLACE FUNCTION get_student_attendance_summary(
  p_student_id UUID,
  p_course_id UUID DEFAULT NULL
)
RETURNS TABLE (
  course_code TEXT,
  course_name TEXT,
  total_present BIGINT,
  total_classes BIGINT,
  attendance_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.course_code,
    c.course_name,
    COUNT(a.id) FILTER (WHERE a.status = 'present') AS total_present,
    COUNT(a.id) AS total_classes,
    ROUND(
      (COUNT(a.id) FILTER (WHERE a.status = 'present')::NUMERIC / 
       NULLIF(COUNT(a.id), 0)::NUMERIC) * 100, 2
    ) AS attendance_percentage
  FROM public.courses c
  LEFT JOIN public.attendance a ON a.course_id = c.id AND a.student_id = p_student_id
  WHERE (p_course_id IS NULL OR c.id = p_course_id)
  GROUP BY c.id, c.course_code, c.course_name
  ORDER BY c.course_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. TRIGGER: Auto-update enrolled_courses
-- ============================================

-- Function to add student to course when enrolled
CREATE OR REPLACE FUNCTION add_student_to_course()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the course to the student's enrolled_courses array
  UPDATE public.users
  SET enrolled_courses = array_append(enrolled_courses, NEW.course_id)
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger when attendance is marked (student automatically enrolled)
CREATE TRIGGER auto_enroll_student
AFTER INSERT ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION add_student_to_course();

-- ============================================
-- END OF SCHEMA
-- ============================================
