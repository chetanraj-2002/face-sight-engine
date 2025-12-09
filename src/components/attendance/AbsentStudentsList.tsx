import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { UserX, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Student {
  id: string;
  usn: string;
  name: string;
  class: string;
}

interface AbsentStudentsListProps {
  sessionId: string;
  className: string;
}

export function AbsentStudentsList({ sessionId, className }: AbsentStudentsListProps) {
  const [loading, setLoading] = useState(true);
  const [absentStudents, setAbsentStudents] = useState<Student[]>([]);

  useEffect(() => {
    fetchAbsentStudents();
  }, [sessionId, className]);

  const fetchAbsentStudents = async () => {
    try {
      setLoading(true);

      // Fetch all students in the class
      const { data: allStudents, error: studentsError } = await supabase
        .from('users')
        .select('id, usn, name, class')
        .eq('class', className);

      if (studentsError) throw studentsError;

      // Fetch students who attended this session - use USN since user_id may be null
      const { data: attendedStudents, error: attendanceError } = await supabase
        .from('attendance_logs')
        .select('usn')
        .eq('session_id', sessionId);

      if (attendanceError) throw attendanceError;

      const attendedUSNs = new Set(attendedStudents?.map(a => a.usn) || []);

      // Filter to get absent students by comparing USN
      const absent = allStudents?.filter(student => !attendedUSNs.has(student.usn)) || [];
      setAbsentStudents(absent);
    } catch (error) {
      console.error('Error fetching absent students:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Absent Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5" />
          Absent Students
          <Badge variant="destructive" className="ml-auto">
            {absentStudents.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Students who were not marked present in this session
        </CardDescription>
      </CardHeader>
      <CardContent>
        {absentStudents.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              All students were marked present in this session!
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>USN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absentStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-mono">{student.usn}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{student.class}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}