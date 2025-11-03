import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Image, Brain, UserCheck, Building, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalImages: 0,
    recentRecognitions: 0,
    todayAttendance: 0,
    totalInstitutes: 0,
    totalDepartments: 0,
  });

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Base queries that will be filtered based on role
    let usersQuery = supabase.from('users').select('*', { count: 'exact', head: true });
    let imagesQuery = supabase.from('face_images').select('*', { count: 'exact', head: true });
    let recognitionsQuery = supabase.from('recognition_history').select('*', { count: 'exact', head: true }).gte('timestamp', yesterday.toISOString());
    let attendanceQuery = supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).gte('timestamp', today.toISOString());

    // Apply role-based filters
    if (hasRole('faculty') && profile?.class) {
      usersQuery = usersQuery.eq('class', profile.class);
      attendanceQuery = attendanceQuery.eq('class', profile.class);
    } else if (hasRole('department_admin') && profile?.department) {
      usersQuery = usersQuery.eq('class', profile.department);
      attendanceQuery = attendanceQuery.eq('class', profile.department);
    }

    // Execute queries
    const [usersCount, imagesCount, recognitionsCount, attendanceCount] = await Promise.all([
      usersQuery,
      imagesQuery,
      recognitionsQuery,
      attendanceQuery,
    ]);

    // Get unique institutes and departments for super admin
    let totalInstitutes = 0;
    let totalDepartments = 0;
    
    if (hasRole('super_admin')) {
      const { data: profiles } = await supabase.from('profiles').select('institute, department');
      if (profiles) {
        totalInstitutes = new Set(profiles.map(p => p.institute).filter(Boolean)).size;
        totalDepartments = new Set(profiles.map(p => p.department).filter(Boolean)).size;
      }
    }

    setStats({
      totalUsers: usersCount.count || 0,
      totalImages: imagesCount.count || 0,
      recentRecognitions: recognitionsCount.count || 0,
      todayAttendance: attendanceCount.count || 0,
      totalInstitutes,
      totalDepartments,
    });
  };

  const getRoleDisplay = () => {
    if (!profile) return 'User';
    return profile.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your face recognition system</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {getRoleDisplay()}
        </Badge>
      </div>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {profile.name}</CardTitle>
            <CardDescription>
              {profile.class && `Class: ${profile.class}`}
              {profile.department && ` | ${profile.department}`}
              {profile.institute && ` - ${profile.institute}`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {hasRole('super_admin') && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Institutes</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalInstitutes}</div>
                <p className="text-xs text-muted-foreground">Registered institutes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDepartments}</div>
                <p className="text-xs text-muted-foreground">Across all institutes</p>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {hasRole('faculty') ? 'In your class' : hasRole('department_admin') ? 'In your department' : 'Registered in system'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Face Images</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImages}</div>
            <p className="text-xs text-muted-foreground">Training dataset</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Recognitions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentRecognitions}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAttendance}</div>
            <p className="text-xs text-muted-foreground">Students marked present</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks based on your role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {hasRole('super_admin') && <p>• Manage all institutes, departments, and users</p>}
            {hasRole('institute_admin') && <p>• Manage your institute's departments and users</p>}
            {hasRole('department_admin') && <p>• Manage your department's students and attendance</p>}
            {hasRole('faculty') && <p>• Manage your class students and view attendance</p>}
            {hasRole('student') && <p>• View your attendance records</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
