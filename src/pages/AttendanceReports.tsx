import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { AttendanceFilters, type FilterValues } from '@/components/attendance/AttendanceFilters';
import { AttendanceCharts } from '@/components/attendance/AttendanceCharts';
import { useAttendanceAnalytics } from '@/hooks/useAttendanceAnalytics';
import { Skeleton } from '@/components/ui/skeleton';

export default function AttendanceReports() {
  const { profile } = useAuth();
  const { loading, fetchData, getAnalytics, exportToCSV } = useAttendanceAnalytics();
  const [filters, setFilters] = useState<FilterValues>({});

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
    </div>
  );
}