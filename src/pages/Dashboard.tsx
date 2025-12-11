import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Image, Brain, UserCheck, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalImages: 0,
    recentRecognitions: 0,
    todayAttendance: 0,
  });
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channels = [
      supabase
        .channel('users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchStats())
        .subscribe(),
      supabase
        .channel('face-images-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'face_images' }, () => fetchStats())
        .subscribe(),
      supabase
        .channel('attendance-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchStats())
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
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
            Here's your attendance system overview
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
    </div>
  );
}
