-- Add policy for department admins to view user roles in their department
CREATE POLICY "Department admins can view department roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin'::app_role) 
  AND department = (
    SELECT ur.department 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    LIMIT 1
  )
);