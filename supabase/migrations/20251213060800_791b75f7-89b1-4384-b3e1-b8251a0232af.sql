-- Add unique constraint on batch_number for upsert operations
ALTER TABLE public.user_batch_tracking ADD CONSTRAINT user_batch_tracking_batch_number_unique UNIQUE (batch_number);