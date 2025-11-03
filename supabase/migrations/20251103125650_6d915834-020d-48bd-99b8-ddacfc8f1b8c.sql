-- Step 1: Add unique constraint if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- Step 2: Migrate roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, institute, department)
SELECT 
  p.id,
  p.role,
  p.institute,
  p.department
FROM public.profiles p
WHERE p.role IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = p.role
  );

-- Step 3: Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Institute admins can view institute profiles" ON public.profiles;
DROP POLICY IF EXISTS "Department admins can manage department profiles" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can view students in department" ON public.profiles;

-- Step 4: Now drop the role column from profiles
ALTER TABLE public.profiles DROP COLUMN role;

-- Step 5: Update the handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, usn, department, institute, class)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    NEW.email,
    NEW.raw_user_meta_data->>'usn',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'institute',
    NEW.raw_user_meta_data->>'class'
  );
  
  INSERT INTO public.user_roles (user_id, role, institute, department)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'),
    NEW.raw_user_meta_data->>'institute',
    NEW.raw_user_meta_data->>'department'
  );
  
  RETURN NEW;
END;
$$;

-- Step 6: Recreate all policies using has_role function
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Super admins have full access to profiles"
ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Institute admins can view institute profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'institute_admin') 
  AND EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.institute = ur2.institute
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = profiles.id
  )
);

CREATE POLICY "Department admins can manage department profiles"
ON public.profiles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'department_admin')
  AND EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.department = ur2.department
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = profiles.id
  )
);

CREATE POLICY "Faculty can view students in department"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'faculty')
  AND EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN user_roles ur2 ON ur1.department = ur2.department
    WHERE ur1.user_id = auth.uid() 
      AND ur2.user_id = profiles.id
      AND public.has_role(profiles.id, 'student')
  )
);