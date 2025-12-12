-- Drop the problematic policy
DROP POLICY IF EXISTS "Department admins can view department roles" ON public.user_roles;

-- Create a security definer function to get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Create the fixed policy using the security definer function
CREATE POLICY "Department admins can view department roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin'::app_role) 
  AND department = get_user_department(auth.uid())
);