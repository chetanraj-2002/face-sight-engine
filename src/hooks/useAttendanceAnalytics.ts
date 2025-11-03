import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FilterValues } from '@/components/attendance/AttendanceFilters';

interface AttendanceRecord {
  id: string;
  session_id: string;
  name: string;
  usn: string;
  class: string;
  timestamp: string;
  confidence: number;
}

interface Session {
  id: string;
  session_id: string;
  class_name: string;
  subject: string | null;
  started_at: string;
  ended_at: string | null;
  total_students: number;
  total_marked: number;
  status: string;
}

export function useAttendanceAnalytics() {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const fetchData = async (filters: FilterValues = {}) => {
    setLoading(true);
    try {
      // Build query for sessions
      let sessionsQuery = supabase
        .from('attendance_sessions')
        .select('*')
        .order('started_at', { ascending: false });

      if (filters.startDate) {
        sessionsQuery = sessionsQuery.gte('started_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        sessionsQuery = sessionsQuery.lte('started_at', endOfDay.toISOString());
      }
      if (filters.class) {
        sessionsQuery = sessionsQuery.eq('class_name', filters.class);
      }

      const { data: sessionsData, error: sessionsError } = await sessionsQuery;

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);

      // Fetch attendance records for these sessions
      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map(s => s.session_id);
        const { data: recordsData, error: recordsError } = await supabase
          .from('attendance_logs')
          .select('*')
          .in('session_id', sessionIds)
          .order('timestamp', { ascending: false });

        if (recordsError) throw recordsError;
        setAttendanceRecords(recordsData || []);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error: any) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getAnalytics = () => {
    // Calculate daily data
    const dailyMap = new Map<string, { present: number; total: number; sessions: Set<string> }>();
    
    sessions.forEach(session => {
      const date = new Date(session.started_at).toLocaleDateString();
      const records = attendanceRecords.filter(r => r.session_id === session.session_id);
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { present: 0, total: 0, sessions: new Set() });
      }
      
      const dayData = dailyMap.get(date)!;
      dayData.sessions.add(session.session_id);
      dayData.present += records.length;
      dayData.total += session.total_students;
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      present: data.present,
      absent: data.total - data.present,
      total: data.total,
      percentage: data.total > 0 ? (data.present / data.total) * 100 : 0,
    }));

    // Calculate class-wise stats
    const classMap = new Map<string, { totalPresent: number; totalStudents: number; sessions: number }>();
    
    sessions.forEach(session => {
      const records = attendanceRecords.filter(r => r.session_id === session.session_id);
      
      if (!classMap.has(session.class_name)) {
        classMap.set(session.class_name, { totalPresent: 0, totalStudents: 0, sessions: 0 });
      }
      
      const classData = classMap.get(session.class_name)!;
      classData.totalPresent += records.length;
      classData.totalStudents += session.total_students;
      classData.sessions += 1;
    });

    const classStats = Array.from(classMap.entries()).map(([className, data]) => ({
      class: className,
      averageAttendance: data.totalStudents > 0 ? (data.totalPresent / data.totalStudents) * 100 : 0,
      totalSessions: data.sessions,
    }));

    // Calculate overall stats
    const totalPresent = attendanceRecords.length;
    const totalStudents = sessions.reduce((sum, s) => sum + s.total_students, 0);
    const totalAbsent = totalStudents - totalPresent;

    const overallStats = {
      totalSessions: sessions.length,
      totalPresent,
      totalAbsent,
      averageAttendance: totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0,
    };

    return { dailyData, classStats, overallStats };
  };

  const exportToCSV = () => {
    if (sessions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvRows = [
      ['Session ID', 'Class', 'Subject', 'Date', 'Time', 'Present', 'Total', 'Percentage', 'Status'],
      ...sessions.map(session => {
        const records = attendanceRecords.filter(r => r.session_id === session.session_id);
        const percentage = session.total_students > 0 
          ? ((records.length / session.total_students) * 100).toFixed(1) 
          : '0';
        
        return [
          session.session_id,
          session.class_name,
          session.subject || '-',
          new Date(session.started_at).toLocaleDateString(),
          new Date(session.started_at).toLocaleTimeString(),
          records.length.toString(),
          session.total_students.toString(),
          percentage + '%',
          session.status,
        ];
      }),
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Report exported successfully');
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    loading,
    sessions,
    attendanceRecords,
    fetchData,
    getAnalytics,
    exportToCSV,
  };
}