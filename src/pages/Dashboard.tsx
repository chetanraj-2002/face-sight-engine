import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Image, Brain, UserCheck, RefreshCw, Database, Cpu, ClipboardCheck, ArrowRight, Building, TrendingUp, Activity, BarChart3, Building2, Layers, CheckCircle, XCircle, FileSearch } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface InstitutionStats {
  institute: string;
  totalDepartments: number;
  totalStudents: number;
  todayAttendance: number;
  attendanceRate: number;
}

interface DepartmentStats {
  department: string;
  totalStudents: number;
  totalImages: number;
  todayAttendance: number;
  attendanceRate: number;
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const isInstituteAdmin = profile?.role === 'institute_admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const isStudent = profile?.role === 'student';
  
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
  const [superAdminStats, setSuperAdminStats] = useState({
    totalInstitutions: 0,
    totalDepartments: 0,
    totalStudents: 0,
    totalImages: 0,
    avgAttendanceRate: 0,
    activeSessions: 0,
    totalModels: 0,
    trainingSuccessRate: 0,
  });
  const [institutionStats, setInstitutionStats] = useState<InstitutionStats[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [studentStats, setStudentStats] = useState({
    totalClasses: 0,
    attended: 0,
    percentage: 0,
  });

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

  // Fetch super admin stats
  const fetchSuperAdminStats = useCallback(async () => {
    if (!isSuperAdmin) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all institutions
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('institute, department');

    const uniqueInstitutions = [...new Set(allRoles?.map(r => r.institute).filter(Boolean) || [])];
    const uniqueDepartments = [...new Set(allRoles?.map(r => r.department).filter(Boolean) || [])];

    // Get all profiles
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, institute, department');

    // Get all stats in parallel
    const [imagesResult, sessionsResult, todayAttendanceResult, modelsResult, jobsResult] = await Promise.all([
      supabase.from('face_images').select('*', { count: 'exact', head: true }),
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('attendance_logs').select('*').gte('timestamp', today.toISOString()),
      supabase.from('model_versions').select('*'),
      supabase.from('training_jobs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);

    const totalStudents = allProfiles?.length || 0;
    const todayAttendance = todayAttendanceResult.data || [];
    const avgAttendanceRate = totalStudents > 0 
      ? Math.round((todayAttendance.length / totalStudents) * 100) 
      : 0;

    // Training success rate
    const jobs = jobsResult.data || [];
    const successfulJobs = jobs.filter(j => j.status === 'completed').length;
    const trainingSuccessRate = jobs.length > 0 
      ? Math.round((successfulJobs / jobs.length) * 100) 
      : 0;

    setSuperAdminStats({
      totalInstitutions: uniqueInstitutions.length,
      totalDepartments: uniqueDepartments.length,
      totalStudents,
      totalImages: imagesResult.count || 0,
      avgAttendanceRate,
      activeSessions: sessionsResult.count || 0,
      totalModels: modelsResult.data?.length || 0,
      trainingSuccessRate,
    });

    // Build institution-wise stats
    const instStatsPromises = uniqueInstitutions.map(async (inst) => {
      const instProfiles = allProfiles?.filter(p => p.institute === inst) || [];
      const instDepartments = [...new Set(instProfiles.map(p => p.department).filter(Boolean))];
      
      const instAttendance = todayAttendance.filter(a => 
        instProfiles.some(p => p.id === a.user_id)
      );

      const attendanceRate = instProfiles.length > 0 
        ? Math.round((instAttendance.length / instProfiles.length) * 100) 
        : 0;

      return {
        institute: inst as string,
        totalDepartments: instDepartments.length,
        totalStudents: instProfiles.length,
        todayAttendance: instAttendance.length,
        attendanceRate,
      };
    });

    const instStats = await Promise.all(instStatsPromises);
    setInstitutionStats(instStats);
  }, [isSuperAdmin]);

  // Fetch student-specific stats
  const fetchStudentStats = useCallback(async () => {
    if (!isStudent || !user || !profile?.class) return;

    // Get total sessions for the student's class
    const { count: totalCount } = await supabase
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('class_name', profile.class)
      .eq('status', 'completed');

    // Get student's attendance count
    const { count: attendedCount } = await supabase
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const total = totalCount || 0;
    const attended = attendedCount || 0;
    const percentage = total > 0 ? (attended / total) * 100 : 0;

    setStudentStats({
      totalClasses: total,
      attended,
      percentage,
    });
  }, [isStudent, user, profile?.class]);

  useEffect(() => {
    if (isStudent) {
      fetchStudentStats();
    } else {
      fetchStats();
      if (isInstituteAdmin) {
        fetchInstituteStats();
      }
      if (isSuperAdmin) {
        fetchSuperAdminStats();
      }
    }
  }, [fetchStats, fetchInstituteStats, fetchSuperAdminStats, fetchStudentStats, isInstituteAdmin, isSuperAdmin, isStudent]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channels = [
      supabase
        .channel('users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
      supabase
        .channel('face-images-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'face_images' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
      supabase
        .channel('attendance-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          fetchStats();
          if (isInstituteAdmin) fetchInstituteStats();
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
      supabase
        .channel('sessions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
          if (isInstituteAdmin) fetchInstituteStats();
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
      supabase
        .channel('training-jobs-changes-dash')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'training_jobs' }, () => {
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
      supabase
        .channel('model-versions-changes-dash')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'model_versions' }, () => {
          if (isSuperAdmin) fetchSuperAdminStats();
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [fetchStats, fetchInstituteStats, fetchSuperAdminStats, isInstituteAdmin, isSuperAdmin]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (isStudent) {
      await fetchStudentStats();
    } else {
      await fetchStats();
      if (isInstituteAdmin) await fetchInstituteStats();
      if (isSuperAdmin) await fetchSuperAdminStats();
    }
    setIsRefreshing(false);
  };

  // Student Dashboard - Simplified view
  if (isStudent) {
    const getPercentageColor = (percentage: number) => {
      if (percentage >= 75) return 'text-green-600';
      if (percentage >= 50) return 'text-yellow-600';
      return 'text-red-600';
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome{profile?.name ? `, ${profile.name}` : ''}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {profile?.class} • Track your attendance
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

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Classes
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{studentStats.totalClasses}</div>
              <p className="text-xs text-muted-foreground mt-1">in {profile?.class}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Classes Attended
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-green-600">{studentStats.attended}</div>
              <p className="text-xs text-muted-foreground mt-1">{studentStats.totalClasses - studentStats.attended} missed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Attendance Rate
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-semibold ${getPercentageColor(studentStats.percentage)}`}>
                {studentStats.percentage.toFixed(1)}%
              </div>
              <Progress value={studentStats.percentage} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Quick Action */}
        <Card 
          className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
          onClick={() => navigate('/my-attendance')}
        >
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">View Detailed Attendance</p>
                <p className="text-sm text-muted-foreground">Subject-wise breakdown, trends, and history</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome{profile?.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSuperAdmin 
              ? "System-wide monitoring and health metrics"
              : isInstituteAdmin 
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

      {/* Super Admin System Overview */}
      {isSuperAdmin && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:border-primary/20 transition-colors border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Institutions
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{superAdminStats.totalInstitutions}</div>
                <p className="text-xs text-muted-foreground mt-1">registered institutions</p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Departments
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{superAdminStats.totalDepartments}</div>
                <p className="text-xs text-muted-foreground mt-1">across all institutions</p>
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
                <div className="text-3xl font-semibold">{superAdminStats.totalStudents}</div>
                <p className="text-xs text-muted-foreground mt-1">system-wide</p>
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
                <div className="text-3xl font-semibold">{superAdminStats.activeSessions}</div>
                <p className="text-xs text-muted-foreground mt-1">ongoing now</p>
              </CardContent>
            </Card>
          </div>

          {/* System Health Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="text-3xl font-semibold text-green-600">{superAdminStats.avgAttendanceRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">today's system average</p>
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
                <div className="text-3xl font-semibold">{superAdminStats.totalImages}</div>
                <p className="text-xs text-muted-foreground mt-1">in dataset</p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Model Versions
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{superAdminStats.totalModels}</div>
                <p className="text-xs text-muted-foreground mt-1">trained models</p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Training Success
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-semibold ${superAdminStats.trainingSuccessRate >= 80 ? 'text-green-600' : superAdminStats.trainingSuccessRate >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
                  {superAdminStats.trainingSuccessRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">recent jobs success rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Institution-wise Statistics Table */}
          {institutionStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Institution Performance
                </CardTitle>
                <CardDescription>Today's attendance and progress by institution</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institution</TableHead>
                      <TableHead className="text-center">Departments</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Today's Attendance</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {institutionStats.map((inst) => (
                      <TableRow key={inst.institute}>
                        <TableCell className="font-medium">{inst.institute}</TableCell>
                        <TableCell className="text-center">{inst.totalDepartments}</TableCell>
                        <TableCell className="text-center">{inst.totalStudents}</TableCell>
                        <TableCell className="text-center">{inst.todayAttendance}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={inst.attendanceRate} className="h-2 w-20" />
                            <span className="text-sm text-muted-foreground">{inst.attendanceRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={inst.attendanceRate >= 75 ? 'default' : inst.attendanceRate >= 50 ? 'secondary' : 'destructive'}
                          >
                            {inst.attendanceRate >= 75 ? 'Good' : inst.attendanceRate >= 50 ? 'Average' : 'Low'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions - Super Admin */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card 
              className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
              onClick={() => navigate('/institutions')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Institutions</p>
                    <p className="text-sm text-muted-foreground">Manage institutions</p>
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
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Model Health</p>
                    <p className="text-sm text-muted-foreground">Monitor model performance</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>

            <Card 
              className="group cursor-pointer hover:border-primary/30 hover:shadow-card transition-all"
              onClick={() => navigate('/audit-logs')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <FileSearch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Audit Logs</p>
                    <p className="text-sm text-muted-foreground">View system activity</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </div>
        </>
      )}

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
