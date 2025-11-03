-- Add faculty role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'faculty';

-- Add class field to profiles for faculty to track which class they teach
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class TEXT;