-- Create user_batch_tracking table
CREATE TABLE public.user_batch_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number INTEGER NOT NULL,
  users_in_batch INTEGER DEFAULT 0,
  batch_status TEXT DEFAULT 'collecting' CHECK (batch_status IN ('collecting', 'processing', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  training_job_id UUID REFERENCES public.training_jobs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dataset_backups table
CREATE TABLE public.dataset_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  users_count INTEGER,
  images_count INTEGER,
  backup_folder TEXT,
  batch_number INTEGER,
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_batch_status ON public.user_batch_tracking(batch_status);
CREATE INDEX idx_batch_number ON public.user_batch_tracking(batch_number);
CREATE INDEX idx_backup_batch ON public.dataset_backups(batch_number);

-- Enable RLS
ALTER TABLE public.user_batch_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_backups ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_batch_tracking
CREATE POLICY "Admins can manage batch tracking" ON public.user_batch_tracking
  FOR ALL USING (
    has_role(auth.uid(), 'department_admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- RLS policies for dataset_backups
CREATE POLICY "Admins can view backups" ON public.dataset_backups
  FOR SELECT USING (
    has_role(auth.uid(), 'department_admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "System can insert backups" ON public.dataset_backups
  FOR INSERT WITH CHECK (true);

-- System settings for automation
INSERT INTO public.system_settings (key, value) VALUES 
  ('auto_capture_enabled', 'true'),
  ('images_per_user', '100'),
  ('capture_rate_ms', '500'),
  ('batch_size', '10'),
  ('current_batch_number', '1'),
  ('users_in_current_batch', '0')
ON CONFLICT (key) DO NOTHING;

-- Create backup storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('face-images-backup', 'face-images-backup', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for backup bucket
CREATE POLICY "Admins can access backup bucket" ON storage.objects
  FOR ALL USING (
    bucket_id = 'face-images-backup' AND
    (has_role(auth.uid(), 'department_admin'::app_role) OR 
     has_role(auth.uid(), 'super_admin'::app_role))
  );