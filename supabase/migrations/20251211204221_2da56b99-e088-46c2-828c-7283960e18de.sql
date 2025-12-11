-- Drop existing policies on profiles table and recreate with proper permissions
DROP POLICY IF EXISTS "Super admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Department admins can manage department profiles" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can view students in department" ON public.profiles;
DROP POLICY IF EXISTS "Institute admins can view institute profiles" ON public.profiles;

-- Create permissive policies instead of restrictive
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Super admins have full access to profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Institute admins can view institute profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'institute_admin') AND 
  EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.institute = ur2.institute
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = profiles.id
  )
);

CREATE POLICY "Department admins can manage department profiles"
ON public.profiles
FOR ALL
USING (
  public.has_role(auth.uid(), 'department_admin') AND 
  EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.department = ur2.department
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = profiles.id
  )
);

CREATE POLICY "Faculty can view students in department"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'faculty') AND 
  EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.department = ur2.department
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = profiles.id AND public.has_role(profiles.id, 'student')
  )
);