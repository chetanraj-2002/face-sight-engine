-- Fix infinite recursion in profiles policies
-- Remove all existing problematic policies
DROP POLICY IF EXISTS "Department admins can view their department profiles" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can update students in their class" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can view students in their class" ON public.profiles;
DROP POLICY IF EXISTS "Institute admins can view their institute profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Institute admins can view profiles in their institute" ON public.profiles;
DROP POLICY IF EXISTS "Department admins can view profiles in their department" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can view students in their department" ON public.profiles;
DROP POLICY IF EXISTS "Department admins can update profiles in their department" ON public.profiles;

-- Create simpler, non-recursive policies for profiles
CREATE POLICY "Super admins have full access to profiles"
ON public.profiles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Institute admins can view institute profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'institute_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.institute = profiles.institute
  )
);

CREATE POLICY "Department admins can manage department profiles"
ON public.profiles
FOR ALL
USING (
  has_role(auth.uid(), 'department_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.department = profiles.department
  )
);

CREATE POLICY "Faculty can view students in department"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'faculty'::app_role) AND
  role = 'student'::app_role AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.department = profiles.department
  )
);