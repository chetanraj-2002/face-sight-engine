-- Create role_change_audit table for tracking role assignments and changes
CREATE TABLE public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('assigned', 'removed', 'modified')),
  role app_role NOT NULL,
  institute text,
  department text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on role_change_audit
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Super admins can see all audit logs
CREATE POLICY "Super admins can view all audit logs"
ON public.role_change_audit
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Institute admins can see audit logs for their institute
CREATE POLICY "Institute admins can view institute audit logs"
ON public.role_change_audit
FOR SELECT
USING (
  has_role(auth.uid(), 'institute_admin') 
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.institute = role_change_audit.institute
  )
);

-- Department admins can see audit logs for their department
CREATE POLICY "Department admins can view department audit logs"
ON public.role_change_audit
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin')
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.department = role_change_audit.department
  )
);

-- Create index for better query performance
CREATE INDEX idx_role_audit_user_id ON public.role_change_audit(user_id);
CREATE INDEX idx_role_audit_performed_by ON public.role_change_audit(performed_by);
CREATE INDEX idx_role_audit_created_at ON public.role_change_audit(created_at DESC);

-- Update profiles RLS to support scope-based filtering
-- Institute admins can only view profiles in their institute
DROP POLICY IF EXISTS "Institute admins can view institute profiles" ON public.profiles;
CREATE POLICY "Institute admins can view institute profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'institute_admin') 
  AND EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.institute = ur2.institute
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profiles.id
  )
);

-- Update user_roles RLS for better scope isolation
-- Institute admins can view roles in their institute
CREATE POLICY "Institute admins can view institute roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'institute_admin')
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.institute = user_roles.institute
  )
);

-- Department admins can view roles in their department
CREATE POLICY "Department admins can view department roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin')
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.department = user_roles.department
  )
);