-- Users table (synced with Python dataset)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image_count INTEGER DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE
);

-- Face images metadata (references to storage)
CREATE TABLE public.face_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  usn TEXT NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training jobs tracking
CREATE TABLE public.training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  logs TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result_data JSONB,
  embeddings_count INTEGER,
  users_processed INTEGER,
  model_version TEXT,
  accuracy FLOAT
);

-- Attendance records (synced from Python JSON files)
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  usn TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT,
  confidence FLOAT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recognition history
CREATE TABLE public.recognition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  faces_detected INTEGER DEFAULT 0,
  faces_recognized INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  results JSONB
);

-- System settings
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Public access policies (adjust based on your security needs)
CREATE POLICY "Allow public read access on users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on users" ON public.users FOR DELETE USING (true);

CREATE POLICY "Allow public read access on face_images" ON public.face_images FOR SELECT USING (true);
CREATE POLICY "Allow public insert on face_images" ON public.face_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on face_images" ON public.face_images FOR DELETE USING (true);

CREATE POLICY "Allow public read access on training_jobs" ON public.training_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on training_jobs" ON public.training_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on training_jobs" ON public.training_jobs FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on attendance_logs" ON public.attendance_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on attendance_logs" ON public.attendance_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on recognition_history" ON public.recognition_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on recognition_history" ON public.recognition_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update on system_settings" ON public.system_settings FOR UPDATE USING (true);

-- Create storage bucket for face images
INSERT INTO storage.buckets (id, name, public) VALUES ('face-images', 'face-images', true);

-- Storage policies for face-images bucket
CREATE POLICY "Public Access for face-images" ON storage.objects FOR SELECT USING (bucket_id = 'face-images');
CREATE POLICY "Public Upload for face-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'face-images');
CREATE POLICY "Public Delete for face-images" ON storage.objects FOR DELETE USING (bucket_id = 'face-images');

-- Create indexes for better query performance
CREATE INDEX idx_users_usn ON public.users(usn);
CREATE INDEX idx_face_images_user_id ON public.face_images(user_id);
CREATE INDEX idx_face_images_usn ON public.face_images(usn);
CREATE INDEX idx_attendance_logs_session_id ON public.attendance_logs(session_id);
CREATE INDEX idx_attendance_logs_usn ON public.attendance_logs(usn);
CREATE INDEX idx_attendance_logs_timestamp ON public.attendance_logs(timestamp);
CREATE INDEX idx_training_jobs_status ON public.training_jobs(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();