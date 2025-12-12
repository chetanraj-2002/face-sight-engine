-- Drop the overly permissive public policies on face-images bucket
DROP POLICY IF EXISTS "Public Access for face-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload for face-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete for face-images" ON storage.objects;

-- Add proper role-based policies for face-images bucket
-- Department admins and super admins can manage (CRUD) face images
CREATE POLICY "Admins can manage face images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'face-images' AND 
  (has_role(auth.uid(), 'department_admin') OR 
   has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  bucket_id = 'face-images' AND 
  (has_role(auth.uid(), 'department_admin') OR 
   has_role(auth.uid(), 'super_admin'))
);

-- Faculty can view face images (needed for attendance verification)
CREATE POLICY "Faculty can view face images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'face-images' AND 
  has_role(auth.uid(), 'faculty')
);