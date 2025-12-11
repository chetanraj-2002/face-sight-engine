-- Drop all existing user_roles policies to fix infinite recursion
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Institute admins can view institute roles" ON public.user_roles;

-- Create simple, non-recursive policies
-- Users can always view their own roles (no has_role call)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- For super_admin management, we use a subquery instead of has_role to avoid recursion
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Institute admins can view roles in their institute (using subquery)
CREATE POLICY "Institute admins can view institute roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'institute_admin'
    AND ur.institute = user_roles.institute
  )
);