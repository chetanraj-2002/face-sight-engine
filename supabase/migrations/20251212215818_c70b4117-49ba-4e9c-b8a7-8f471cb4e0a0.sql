-- Fix: Restrict audit_logs INSERT to authenticated users only
-- This prevents anonymous log injection and log flooding attacks

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);