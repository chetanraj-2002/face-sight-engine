-- Fix infinite recursion in user_roles RLS policies
-- Drop the problematic policies
DROP POLICY IF EXISTS "Institute admins can view institute roles" ON public.user_roles;
DROP POLICY IF EXISTS "Department admins can view department roles" ON public.user_roles;

-- Recreate policies without causing recursion by using the has_role function
-- which is already a security definer function that bypasses RLS

-- Institute admins can view roles in their institute  
CREATE POLICY "Institute admins can view institute roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'institute_admin')
  AND institute = (
    SELECT ur.institute 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    LIMIT 1
  )
);

-- Department admins can view roles in their department
CREATE POLICY "Department admins can view department roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin')
  AND department = (
    SELECT ur.department 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    LIMIT 1
  )
);