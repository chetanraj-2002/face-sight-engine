-- Enable realtime for attendance_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;

-- Enable realtime for attendance_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;