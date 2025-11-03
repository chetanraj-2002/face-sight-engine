-- Add model versions table for tracking different model iterations
CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  training_job_id uuid REFERENCES public.training_jobs(id) ON DELETE SET NULL,
  is_active boolean DEFAULT false,
  is_production boolean DEFAULT false,
  accuracy double precision,
  users_count integer,
  embeddings_count integer,
  model_path text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deployed_at timestamp with time zone,
  deprecated_at timestamp with time zone
);

-- Add index for faster queries
CREATE INDEX idx_model_versions_version ON public.model_versions(version);
CREATE INDEX idx_model_versions_is_active ON public.model_versions(is_active);
CREATE INDEX idx_model_versions_is_production ON public.model_versions(is_production);

-- Add dataset quality metrics table
CREATE TABLE public.dataset_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL CHECK (check_type IN ('minimum_images', 'image_quality', 'duplicate_detection', 'face_detection')),
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  usn text,
  details jsonb,
  checked_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add index for faster queries
CREATE INDEX idx_quality_checks_status ON public.dataset_quality_checks(status);
CREATE INDEX idx_quality_checks_user_id ON public.dataset_quality_checks(user_id);
CREATE INDEX idx_quality_checks_checked_at ON public.dataset_quality_checks(checked_at DESC);

-- Add A/B testing experiments table
CREATE TABLE public.model_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  model_a_version text REFERENCES public.model_versions(version) ON DELETE CASCADE,
  model_b_version text REFERENCES public.model_versions(version) ON DELETE CASCADE,
  traffic_split_a integer DEFAULT 50 CHECK (traffic_split_a >= 0 AND traffic_split_a <= 100),
  traffic_split_b integer DEFAULT 50 CHECK (traffic_split_b >= 0 AND traffic_split_b <= 100),
  is_active boolean DEFAULT true,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone,
  results jsonb
);

-- Add index for active experiments
CREATE INDEX idx_experiments_is_active ON public.model_experiments(is_active);

-- Enable RLS on model_versions
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

-- Super admins and department admins can manage model versions
CREATE POLICY "Admins can manage model versions"
ON public.model_versions
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') 
  OR has_role(auth.uid(), 'department_admin')
);

-- Enable RLS on dataset_quality_checks
ALTER TABLE public.dataset_quality_checks ENABLE ROW LEVEL SECURITY;

-- Department admins can view quality checks
CREATE POLICY "Department admins can view quality checks"
ON public.dataset_quality_checks
FOR SELECT
USING (
  has_role(auth.uid(), 'department_admin') 
  OR has_role(auth.uid(), 'super_admin')
);

-- System can insert quality checks
CREATE POLICY "System can insert quality checks"
ON public.dataset_quality_checks
FOR INSERT
WITH CHECK (true);

-- Enable RLS on model_experiments
ALTER TABLE public.model_experiments ENABLE ROW LEVEL SECURITY;

-- Admins can manage experiments
CREATE POLICY "Admins can manage experiments"
ON public.model_experiments
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') 
  OR has_role(auth.uid(), 'department_admin')
);

-- Enable realtime for training_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_jobs;

-- Add check constraints to ensure traffic splits add up to 100
ALTER TABLE public.model_experiments 
ADD CONSTRAINT check_traffic_splits 
CHECK (traffic_split_a + traffic_split_b = 100);