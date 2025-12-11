-- Drop all user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Institute admins can view institute roles" ON public.user_roles;

-- Create a security definer function to check role without RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Create simple non-recursive policies
-- Users can view their own roles (simple, no recursion)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Super admins can do everything (using security definer function)
CREATE POLICY "Super admins full access"
ON public.user_roles
FOR ALL
USING (public.get_my_role() = 'super_admin');

-- Institute admins can view roles in their institute
CREATE POLICY "Institute admins view institute"
ON public.user_roles
FOR SELECT
USING (
  public.get_my_role() = 'institute_admin' AND
  institute = (SELECT institute FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
);