import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Image, Brain, UserCheck, RefreshCw, Database, Cpu, ClipboardCheck, ArrowRight, Building, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface DepartmentStats {
  department: string;
  totalStudents: number;
  totalImages: number;
  todayAttendance: number;
  attendanceRate: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isInstituteAdmin = profile?.role === 'institute_admin';
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalImages: 0,
    recentRecognitions: 0,
    todayAttendance: 0,
  });
  const [instituteStats, setInstituteStats] = useState({
    totalDepartments: 0,
    totalStudents: 0,
    avgAttendanceRate: 0,
    activeSessions: 0,
  });
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [usersCount, imagesCount, recognitionsCount, attendanceCount] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('face_images').select('*', { count: 'exact', head: true }),
      supabase.from('recognition_history').select('*', { count: 'exact', head: true }).gte('timestamp', yesterday.toISOString()),
      supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).gte('timestamp', today.toISOString()),
    ]);

    setStats({
      totalUsers: usersCount.count || 0,
      totalImages: imagesCount.count || 0,
      recentRecognitions: recognitionsCount.count || 0,
      todayAttendance: attendanceCount.count || 0,
    });
  }, []);

  // Fetch institute-specific stats for institute_admin
  const fetchInstituteStats = useCallback(async () => {
    if (!isInstituteAdmin || !profile?.institute) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get departments in this institute
    const { data: deptRoles } = await supabase
      .from('user_roles')
      .select('department')
      .eq('institute', profile.institute)
      .not('department', 'is', null);

    const uniqueDepartments = [...new Set(deptRoles?.map(r => r.department).filter(Boolean) || [])];

    // Get profiles in this institute
    const { data: instituteProfiles } = await supabase
      .from('profiles')
      .select('id, department')
      .eq('institute', profile.institute);

    // Get active sessions
    const { count: activeSessions } = await supabase
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get today's attendance
    const { data: todayAttendance } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('timestamp', today.toISOString());

    const totalStudents = instituteProfiles?.length || 0;
    const todayAttendanceCount = todayAttendance?.length || 0;
    const avgAttendanceRate = totalStudents > 0 
      ? Math.round((todayAttendanceCount / totalStudents) * 100) 
      : 0;

    setInstituteStats({
      totalDepartments: uniqueDepartments.length,
      totalStudents,
      avgAttendanceRate,
      activeSessions: activeSessions || 0,
    });

    // Build department-wise stats
    const deptStatsPromises = uniqueDepartments.map(async (dept) => {
      const deptProfiles = instituteProfiles?.filter(p => p.department === dept) || [];
      const deptProfileIds = deptProfiles.map(p => p.id);
      
      // Get users linked to these profiles
      const { count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get face images for department
      const { count: imageCount } = await supabase
        .from('face_images')
        .select('*', { count: 'exact', head: true });

      // Get today's attendance for department
      const deptAttendance = todayAttendance?.filter(a => 
        deptProfiles.some(p => p.id === a.user_id)
      ) || [];

      const attendanceRate = deptProfiles.length > 0 
        ? Math.round((deptAttendance.length / deptProfiles.length) * 100) 
        : 0;

      return {
        department: dept as string,
        totalStudents: deptProfiles.length,
        totalImages: imageCount || 0,
        todayAttendance: deptAttendance.length,
        attendanceRate,
      };
    });

    const deptStats = await Promise.all(deptStatsPromises);
    setDepartmentStats(deptStats);
  }, [isInstituteAdmin, profile?.institute]);

  useEffect(() => {
    fetchStats();
    if (isInstituteAdmin) {
      fetchInstituteStats();
    }
  }, [fetchStats, fetchInstituteStats, isInstituteAdmin]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channels = [
      supabase
        .channel('users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
        })
        .subscribe(),
      supabase
        .channel('face-images-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'face_images' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
        })
        .subscribe(),
      supabase
        .channel('attendance-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
        })
        .subscribe(),
      supabase
        .channel('sessions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
          if (isInstituteAdmin) fetchInstituteStats();
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [fetchStats, fetchInstituteStats, isInstituteAdmin]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    if (isInstituteAdmin) await fetchInstituteStats();
    setIsRefreshing(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome{profile?.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isInstituteAdmin 
              ? `Institute overview for ${profile?.institute || 'your institution'}`
              : "Here's your attendance system overview"
            }
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

      {/* Institute Admin Overview Cards */}
      {isInstituteAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:border-primary/20 transition-colors border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Departments
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{instituteStats.totalDepartments}</div>
              <p className="text-xs text-muted-foreground mt-1">registered departments</p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Students
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{instituteStats.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">across all departments</p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Attendance Rate
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-green-600">{instituteStats.avgAttendanceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">today's average</p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Sessions
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{instituteStats.activeSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">ongoing now</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Department-wise Statistics Table - Institute Admin Only */}
      {isInstituteAdmin && departmentStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Department Performance
            </CardTitle>
            <CardDescription>Today's attendance and progress by department</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-center">Today's Attendance</TableHead>
                  <TableHead>Attendance Rate</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentStats.map((dept) => (
                  <TableRow key={dept.department}>
                    <TableCell className="font-medium">{dept.department}</TableCell>
                    <TableCell className="text-center">{dept.totalStudents}</TableCell>
                    <TableCell className="text-center">{dept.todayAttendance}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={dept.attendanceRate} className="h-2 w-20" />
                        <span className="text-sm text-muted-foreground">{dept.attendanceRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={dept.attendanceRate >= 75 ? 'default' : dept.attendanceRate >= 50 ? 'secondary' : 'destructive'}
                      >
                        {dept.attendanceRate >= 75 ? 'Good' : dept.attendanceRate >= 50 ? 'Average' : 'Low'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {departmentStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No departments registered yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Standard Stats - For non-institute admins */}
      {!isInstituteAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Students
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Face Images
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Image className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.totalImages}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recognitions (24h)
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.recentRecognitions}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Attendance
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.todayAttendance}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions - Only for department_admin */}
      {profile?.role === 'department_admin' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card 
            className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
            onClick={() => navigate('/dataset')}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Dataset</p>
                  <p className="text-sm text-muted-foreground">Manage student images</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
            onClick={() => navigate('/training')}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Cpu className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Training</p>
                  <p className="text-sm text-muted-foreground">Train recognition model</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
            onClick={() => navigate('/attendance')}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Attendance</p>
                  <p className="text-sm text-muted-foreground">Mark attendance</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions - Institute Admin */}
      {isInstituteAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card 
            className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
            onClick={() => navigate('/departments')}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Departments</p>
                  <p className="text-sm text-muted-foreground">Manage department admins</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
            onClick={() => navigate('/attendance-reports')}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Reports</p>
                  <p className="text-sm text-muted-foreground">View attendance reports</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
