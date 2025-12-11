-- Drop all user_roles policies first
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins full access" ON public.user_roles;
DROP POLICY IF EXISTS "Institute admins view institute" ON public.user_roles;

-- Drop and recreate the function to query auth.uid() directly
DROP FUNCTION IF EXISTS public.get_my_role();

-- Create a function that returns the role for a specific user without RLS check
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Now create simple policies that don't cause recursion
-- Policy 1: Users can always view their own role (direct check, no function call)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Super admins can do everything (using the security definer function)
CREATE POLICY "Super admins full access"
ON public.user_roles
FOR ALL
USING (public.auth_user_role() = 'super_admin');

-- Policy 3: Institute admins can view roles in their institute
CREATE POLICY "Institute admins view institute roles"
ON public.user_roles
FOR SELECT
USING (public.auth_user_role() = 'institute_admin');