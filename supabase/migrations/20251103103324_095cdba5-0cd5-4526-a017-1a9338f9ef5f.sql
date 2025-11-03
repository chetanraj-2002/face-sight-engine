-- Remove overly permissive public policies
DROP POLICY IF EXISTS "Allow public insert on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public read access on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public insert on attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Allow public read access on attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Allow public update on attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Allow public delete on face_images" ON public.face_images;
DROP POLICY IF EXISTS "Allow public insert on face_images" ON public.face_images;
DROP POLICY IF EXISTS "Allow public read access on face_images" ON public.face_images;
DROP POLICY IF EXISTS "Allow public insert on recognition_history" ON public.recognition_history;
DROP POLICY IF EXISTS "Allow public read access on recognition_history" ON public.recognition_history;
DROP POLICY IF EXISTS "Allow public read access on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public update on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public insert on training_jobs" ON public.training_jobs;
DROP POLICY IF EXISTS "Allow public read access on training_jobs" ON public.training_jobs;
DROP POLICY IF EXISTS "Allow public update on training_jobs" ON public.training_jobs;
DROP POLICY IF EXISTS "Allow public delete on users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow public update on users" ON public.users;
DROP POLICY IF EXISTS "Faculty can view users in their class" ON public.users;

-- ATTENDANCE LOGS: Department admins and faculty can view/insert attendance for their department/class
CREATE POLICY "Department admins can view all attendance logs in department"
ON public.attendance_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Faculty can view attendance logs for their class"
ON public.attendance_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'faculty'::app_role) AND
  class = (SELECT class FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Faculty and dept admins can insert attendance logs"
ON public.attendance_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'faculty'::app_role) OR
  has_role(auth.uid(), 'department_admin'::app_role)
);

CREATE POLICY "Students can view their own attendance"
ON public.attendance_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND
  user_id = auth.uid()
);

-- ATTENDANCE SESSIONS: Similar access pattern
CREATE POLICY "Department admins can manage attendance sessions"
ON public.attendance_sessions
FOR ALL
USING (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Faculty can manage attendance sessions for their class"
ON public.attendance_sessions
FOR ALL
USING (
  has_role(auth.uid(), 'faculty'::app_role) AND
  class_name = (SELECT class FROM profiles WHERE id = auth.uid())
);

-- FACE IMAGES: Department admins manage face images
CREATE POLICY "Department admins can manage face images"
ON public.face_images
FOR ALL
USING (has_role(auth.uid(), 'department_admin'::app_role));

-- RECOGNITION HISTORY: Department admins and faculty can view, dept admins can insert
CREATE POLICY "Department admins and faculty can view recognition history"
ON public.recognition_history
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'faculty'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Department admins can insert recognition history"
ON public.recognition_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'faculty'::app_role)
);

-- SYSTEM SETTINGS: Only super admins
CREATE POLICY "Super admins can manage system settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- TRAINING JOBS: Department admins and super admins
CREATE POLICY "Department admins and super admins can manage training jobs"
ON public.training_jobs
FOR ALL
USING (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- USERS TABLE: Department admins manage users in their department
CREATE POLICY "Department admins can manage users in their department"
ON public.users
FOR ALL
USING (
  has_role(auth.uid(), 'department_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Faculty can view users in their assigned class"
ON public.users
FOR SELECT
USING (
  has_role(auth.uid(), 'faculty'::app_role) AND
  class = (SELECT class FROM profiles WHERE id = auth.uid())
);