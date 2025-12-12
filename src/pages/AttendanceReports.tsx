import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { AttendanceFilters, type FilterValues } from '@/components/attendance/AttendanceFilters';
import { AttendanceCharts } from '@/components/attendance/AttendanceCharts';
import { useAttendanceAnalytics } from '@/hooks/useAttendanceAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { loading, fetchData, getAnalytics, exportToCSV } = useAttendanceAnalytics();
  const [filters, setFilters] = useState<FilterValues>({});
  const [sendingNotifications, setSendingNotifications] = useState(false);

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const analytics = getAnalytics();

  if (!profile) {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to view attendance reports
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access control based on roles
  const canViewReports = ['super_admin', 'institute_admin', 'department_admin', 'faculty'].includes(
    profile.role || ''
  );

  if (!canViewReports) {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only administrators and faculty can view attendance reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive attendance analytics and reporting
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <AttendanceFilters onFilterChange={handleFilterChange} />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <AttendanceCharts
          dailyData={analytics.dailyData}
          classStats={analytics.classStats}
          overallStats={analytics.overallStats}
        />
      )}

      {/* Low Attendance Notification Section - Only for department_admin */}
      {profile?.role === 'department_admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Attendance Alerts
            </CardTitle>
            <CardDescription>
              Send email notifications to students with attendance below 75%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  This will send email notifications to all students in your department whose attendance is below the 75% threshold.
                </p>
              </div>
              <Button 
                onClick={async () => {
                  setSendingNotifications(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('check-low-attendance', {
                      body: { class_name: filters.class || null }
                    });
                    
                    if (error) throw error;
                    
                    toast({
                      title: 'Notifications Sent',
                      description: `Sent ${data.notifications_sent} email(s) to students with low attendance.`,
                    });
                  } catch (error: any) {
                    console.error('Error sending notifications:', error);
                    toast({
                      title: 'Error',
                      description: error.message || 'Failed to send notifications',
                      variant: 'destructive',
                    });
                  } finally {
                    setSendingNotifications(false);
                  }
                }}
                disabled={sendingNotifications}
                variant="outline"
              >
                {sendingNotifications ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Alerts
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}