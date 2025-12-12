import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, TrendingUp, CheckCircle2, XCircle, Search, Filter, BookOpen, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

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

interface SubjectStats {
  subject: string;
  attended: number;
  total: number;
  percentage: number;
}

export default function StudentAttendance() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [allSessions, setAllSessions] = useState<{ session_id: string; subject: string | null; started_at: string }[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    percentage: 0,
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAttendanceData();
    }
  }, [user]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);

      // Fetch all sessions for the student's class
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select('session_id, class_name, subject, started_at')
        .eq('class_name', profile?.class || '')
        .eq('status', 'completed')
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      setAllSessions(sessionsData || []);

      // Fetch attendance logs for the student
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('id, session_id, timestamp, confidence')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: false });

      if (logsError) throw logsError;

      // Enrich logs with session details
      if (logsData && logsData.length > 0 && sessionsData) {
        const sessionMap = new Map(sessionsData.map(s => [s.session_id, s]));
        const enrichedLogs = logsData.map(log => ({
          ...log,
          session: sessionMap.get(log.session_id),
        }));
        setAttendanceLogs(enrichedLogs);
      } else {
        setAttendanceLogs([]);
      }

      // Calculate overall stats
      const totalSessions = sessionsData?.length || 0;
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAttendanceData();
    setIsRefreshing(false);
  };

  // Get unique subjects
  const subjects = useMemo(() => {
    const subjectSet = new Set(allSessions.map(s => s.subject || 'General').filter(Boolean));
    return Array.from(subjectSet).sort();
  }, [allSessions]);

  // Get unique months
  const months = useMemo(() => {
    const monthSet = new Set(allSessions.map(s => format(new Date(s.started_at), 'yyyy-MM')));
    return Array.from(monthSet).sort().reverse();
  }, [allSessions]);

  // Subject-wise statistics
  const subjectStats = useMemo((): SubjectStats[] => {
    const subjectMap = new Map<string, { attended: number; total: number }>();

    // Count total sessions per subject
    allSessions.forEach(session => {
      const subject = session.subject || 'General';
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, { attended: 0, total: 0 });
      }
      subjectMap.get(subject)!.total++;
    });

    // Count attended sessions per subject
    attendanceLogs.forEach(log => {
      const subject = log.session?.subject || 'General';
      if (subjectMap.has(subject)) {
        subjectMap.get(subject)!.attended++;
      }
    });

    return Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      attended: data.attended,
      total: data.total,
      percentage: data.total > 0 ? (data.attended / data.total) * 100 : 0,
    })).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [allSessions, attendanceLogs]);

  // Filtered attendance logs
  const filteredLogs = useMemo(() => {
    return attendanceLogs.filter(log => {
      const matchesSearch = searchQuery === '' || 
        (log.session?.subject || 'General').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSubject = selectedSubject === 'all' || 
        (log.session?.subject || 'General') === selectedSubject;
      
      const matchesMonth = selectedMonth === 'all' || 
        (log.session?.started_at && format(new Date(log.session.started_at), 'yyyy-MM') === selectedMonth);

      return matchesSearch && matchesSubject && matchesMonth;
    });
  }, [attendanceLogs, searchQuery, selectedSubject, selectedMonth]);

  // Weekly trend data
  const trendData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return format(date, 'MMM yyyy');
    }).reverse();

    return last6Months.map(month => {
      const monthSessions = allSessions.filter(s => 
        format(new Date(s.started_at), 'MMM yyyy') === month
      );
      const monthAttended = attendanceLogs.filter(log => 
        log.session?.started_at && format(new Date(log.session.started_at), 'MMM yyyy') === month
      );
      
      const total = monthSessions.length;
      const attended = monthAttended.length;
      
      return {
        month,
        attended,
        total,
        percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
      };
    });
  }, [allSessions, attendanceLogs]);

  // Get percentage color
  const getPercentageColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
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

  return (
    <div className="space-y-6 p-6 md:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Track your attendance history and performance • {profile.class}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
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
            <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalSessions - stats.attended} classes missed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPercentageColor(stats.percentage)}`}>
              {stats.percentage.toFixed(1)}%
            </div>
            <Progress 
              value={stats.percentage} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Subject-wise Attendance
          </CardTitle>
          <CardDescription>Your attendance breakdown by subject</CardDescription>
        </CardHeader>
        <CardContent>
          {subjectStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No subjects found</p>
          ) : (
            <div className="space-y-4">
              {subjectStats.map((subject) => (
                <div key={subject.subject} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{subject.subject}</span>
                      <Badge variant="outline" className="text-xs">
                        {subject.attended}/{subject.total} classes
                      </Badge>
                    </div>
                    <span className={`font-bold ${getPercentageColor(subject.percentage)}`}>
                      {subject.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${getProgressColor(subject.percentage)}`}
                      style={{ width: `${subject.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Your attendance percentage over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.every(d => d.total === 0) ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Attendance']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Classes Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Classes Overview</CardTitle>
            <CardDescription>Attended vs total classes per month</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.every(d => d.total === 0) ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--muted))" name="Total Classes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attended" fill="hsl(var(--primary))" name="Attended" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <BookOpen className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(subject => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map(month => (
              <SelectItem key={month} value={month}>
                {format(new Date(month + '-01'), 'MMMM yyyy')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Attendance History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {attendanceLogs.length} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {attendanceLogs.length === 0 
                  ? 'No attendance records found' 
                  : 'No records match your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.session?.started_at
                          ? format(new Date(log.session.started_at), 'MMM dd, yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.timestamp), 'hh:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.session?.subject || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={log.confidence >= 0.8 ? 'default' : 'secondary'}
                        >
                          {(log.confidence * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
