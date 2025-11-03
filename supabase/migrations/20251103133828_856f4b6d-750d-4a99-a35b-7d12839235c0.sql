-- Fix infinite recursion in user_roles RLS policies
-- Drop the problematic policies that query user_roles within its own RLS checks

DROP POLICY IF EXISTS "Super admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Institute admins can view institute roles" ON user_roles;
DROP POLICY IF EXISTS "Department admins can view department roles" ON user_roles;

-- Keep the simple, non-recursive policy:
-- "Users can view their own roles" (already exists with: auth.uid() = user_id)

-- Note: Administrative operations on user_roles should be handled through
-- edge functions using the service role key to bypass RLS