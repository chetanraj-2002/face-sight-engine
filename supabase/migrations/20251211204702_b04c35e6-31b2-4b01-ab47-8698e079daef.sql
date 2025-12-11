-- Check current user_roles policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create permissive policy for viewing own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Super admins should be able to view all roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Institute admins can view roles in their institute
CREATE POLICY "Institute admins can view institute roles"
ON public.user_roles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'institute_admin') AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.institute = user_roles.institute
  )
);