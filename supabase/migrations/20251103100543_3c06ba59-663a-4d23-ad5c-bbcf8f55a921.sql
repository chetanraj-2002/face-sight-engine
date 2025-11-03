-- Create RLS policy for faculty to view students in their class
CREATE POLICY "Faculty can view students in their class"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'faculty'::app_role) 
  AND role = 'student'::app_role 
  AND class = (SELECT class FROM public.profiles WHERE id = auth.uid())
);

-- Create RLS policy for faculty to update students in their class
CREATE POLICY "Faculty can update students in their class"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'faculty'::app_role) 
  AND role = 'student'::app_role 
  AND class = (SELECT class FROM public.profiles WHERE id = auth.uid())
);

-- Create RLS policy for faculty to view users (students) in their class
CREATE POLICY "Faculty can view users in their class"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND has_role(auth.uid(), 'faculty'::app_role)
    AND profiles.class = users.class
  )
);

-- Create RLS policy for faculty to manage (update/delete) users in their class
CREATE POLICY "Faculty can manage users in their class"
ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND has_role(auth.uid(), 'faculty'::app_role)
    AND profiles.class = users.class
  )
);