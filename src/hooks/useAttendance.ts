import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useAttendance = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSession, setActiveSession] = useState<any>(null);

  // Fetch sessions
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['attendance-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance logs for active session
  const { data: attendanceRecords, isLoading: loadingRecords } = useQuery({
    queryKey: ['attendance-logs', activeSession?.session_id],
    queryFn: async () => {
      if (!activeSession?.session_id) return [];
      
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('session_id', activeSession.session_id)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeSession?.session_id,
  });

  // Start session mutation
  const startSession = useMutation({
    mutationFn: async ({ className, subject }: { className: string; subject?: string }) => {
      const sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Get total students in class
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('class', className);

      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert({
          session_id: sessionId,
          class_name: className,
          subject,
          total_students: count || 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setActiveSession(data);
      toast({
        title: 'Session Started',
        description: `Attendance session for ${data.class_name} has started`,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Start Session',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mark attendance mutation
  const markAttendance = useMutation({
    mutationFn: async ({ imageFile, sessionId }: { imageFile: File; sessionId: string }) => {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('session_id', sessionId);

      const { data, error } = await supabase.functions.invoke('mark-attendance', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Attendance Marked',
        description: `Marked ${data.marked_count} students present`,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Mark Attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // End session mutation
  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setActiveSession(null);
      toast({
        title: 'Session Ended',
        description: 'Attendance session has been closed',
      });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to End Session',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Export attendance
  const exportAttendance = (sessionId: string) => {
    const session = sessions?.find(s => s.session_id === sessionId);
    if (!session) return;

    // Fetch logs for this session
    supabase
      .from('attendance_logs')
      .select('*')
      .eq('session_id', sessionId)
      .then(({ data: logs }) => {
        if (!logs) return;

        // Create CSV
        const headers = ['USN', 'Name', 'Class', 'Timestamp', 'Confidence'];
        const rows = logs.map(log => [
          log.usn,
          log.name,
          log.class,
          new Date(log.timestamp).toLocaleString(),
          `${(log.confidence * 100).toFixed(2)}%`,
        ]);

        const csv = [
          [`Session: ${sessionId}`],
          [`Class: ${session.class_name}`],
          [`Subject: ${session.subject || 'N/A'}`],
          [`Date: ${new Date(session.started_at).toLocaleString()}`],
          [],
          headers,
          ...rows,
        ].map(row => row.join(',')).join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${sessionId}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Exported',
          description: 'Attendance data downloaded as CSV',
        });
      });
  };

  return {
    sessions,
    activeSession,
    attendanceRecords,
    loadingSessions,
    loadingRecords,
    startSession: startSession.mutate,
    markAttendance: markAttendance.mutate,
    endSession: endSession.mutate,
    exportAttendance,
    isStarting: startSession.isPending,
    isMarking: markAttendance.isPending,
    isEnding: endSession.isPending,
    setActiveSession,
  };
};