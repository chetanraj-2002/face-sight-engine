-- Add UNIQUE constraint on storage_path to enable upsert functionality
ALTER TABLE public.face_images 
ADD CONSTRAINT face_images_storage_path_unique UNIQUE (storage_path);