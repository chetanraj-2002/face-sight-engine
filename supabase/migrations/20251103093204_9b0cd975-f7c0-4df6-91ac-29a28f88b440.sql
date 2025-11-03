-- Create attendance_sessions table for managing attendance sessions
CREATE TABLE public.attendance_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  subject TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_marked INTEGER NOT NULL DEFAULT 0,
  total_students INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access on attendance_sessions" 
ON public.attendance_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on attendance_sessions" 
ON public.attendance_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on attendance_sessions" 
ON public.attendance_sessions 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_attendance_sessions_updated_at
BEFORE UPDATE ON public.attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();