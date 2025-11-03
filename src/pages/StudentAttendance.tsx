import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AttendanceLog {
  id: string;
  session_id: string;
  timestamp: string;
  confidence: number;
  session?: {
    class_name: string;
    subject: string | null;
    started_at: string;
  };
}

export default function StudentAttendance() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    percentage: 0,
  });

  useEffect(() => {
    if (user) {
      fetchAttendanceData();
    }
  }, [user]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);

      // Fetch attendance logs for the student
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('id, session_id, timestamp, confidence')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: false });

      if (logsError) throw logsError;

      // Fetch session details
      if (logsData && logsData.length > 0) {
        const sessionIds = [...new Set(logsData.map(log => log.session_id))];
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select('session_id, class_name, subject, started_at')
          .in('session_id', sessionIds);

        if (sessionsError) throw sessionsError;

        const sessionMap = new Map(sessionsData?.map(s => [s.session_id, s]));
        const enrichedLogs = logsData.map(log => ({
          ...log,
          session: sessionMap.get(log.session_id),
        }));

        setAttendanceLogs(enrichedLogs);
      } else {
        setAttendanceLogs([]);
      }

      // Fetch total sessions for the student's class
      const { count: totalCount } = await supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('class_name', profile?.class || '')
        .eq('status', 'completed');

      const totalSessions = totalCount || 0;
      const attended = logsData?.length || 0;
      const percentage = totalSessions > 0 ? (attended / totalSessions) * 100 : 0;

      setStats({
        totalSessions,
        attended,
        percentage,
      });
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendData = () => {
    const monthlyMap = new Map<string, { present: number; total: number }>();

    attendanceLogs.forEach(log => {
      if (log.session?.started_at) {
        const month = format(new Date(log.session.started_at), 'MMM yyyy');
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { present: 0, total: 0 });
        }
        monthlyMap.get(month)!.present++;
      }
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        percentage: data.total > 0 ? (data.present / data.total) * 100 : 0,
      }))
      .reverse();
  };

  if (!profile || profile.role !== 'student') {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              This page is only accessible to students
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 p-10">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const trendData = getTrendData();

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">My Attendance</h1>
        <p className="text-muted-foreground mt-2">
          Track your attendance history and performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              In {profile.class}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions Attended</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalSessions - stats.attended} missed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.percentage.toFixed(1)}%</div>
            <Progress value={stats.percentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Your attendance percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="percentage" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Your recent attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No attendance records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.session?.started_at
                        ? format(new Date(log.session.started_at), 'MMM dd, yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.timestamp), 'hh:mm a')}
                    </TableCell>
                    <TableCell>{log.session?.subject || 'General'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(log.confidence * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}