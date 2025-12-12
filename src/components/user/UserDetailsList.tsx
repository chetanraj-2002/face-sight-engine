import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, GraduationCap, Image } from 'lucide-react';

interface UserDetail {
  id: string;
  userId: string;
  name: string;
  email: string;
  usn: string | null;
  class: string | null;
  role: string;
  imageCount: number;
  createdAt: string;
}

export function UserDetailsList() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [profile]);

  const fetchUsers = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Fetch user roles with profiles for department
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, department')
        .in('role', ['student', 'faculty'])
        .eq('department', profile.department);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setUsers([]);
        return;
      }

      const userIds = rolesData.map(r => r.user_id);

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, usn, class, created_at')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch image counts from users table (dataset users)
      const { data: datasetUsers, error: datasetError } = await supabase
        .from('users')
        .select('profile_id, image_count');

      if (datasetError) throw datasetError;

      // Create a map for image counts
      const imageCountMap = new Map<string, number>();
      datasetUsers?.forEach(du => {
        if (du.profile_id) {
          imageCountMap.set(du.profile_id, du.image_count || 0);
        }
      });

      // Combine the data
      const combinedUsers: UserDetail[] = rolesData.map(role => {
        const profileData = profilesData?.find(p => p.id === role.user_id);
        return {
          id: role.user_id,
          userId: role.user_id,
          name: profileData?.name || 'Unknown',
          email: profileData?.email || '',
          usn: profileData?.usn || null,
          class: profileData?.class || null,
          role: role.role,
          imageCount: imageCountMap.get(role.user_id) || 0,
          createdAt: profileData?.created_at || '',
        };
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const students = users.filter(u => u.role === 'student');
  const faculty = users.filter(u => u.role === 'faculty');

  // Group students by class/section
  const studentsBySection = students.reduce((acc, student) => {
    const section = student.class || 'Unassigned';
    if (!acc[section]) acc[section] = [];
    acc[section].push(student);
    return acc;
  }, {} as Record<string, UserDetail[]>);

  const sections = Object.keys(studentsBySection).sort();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="students">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Students ({students.length})
          </TabsTrigger>
          <TabsTrigger value="faculty" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Faculty ({faculty.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6 space-y-6">
          {sections.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No students found</p>
              </CardContent>
            </Card>
          ) : (
            sections.map(section => (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="outline">{section}</Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      {studentsBySection[section].length} students
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>USN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-center">Face Images</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsBySection[section]
                        .sort((a, b) => (a.usn || '').localeCompare(b.usn || ''))
                        .map(student => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.usn || '-'}</TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell className="text-muted-foreground">{student.email}</TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={student.imageCount > 0 ? 'default' : 'secondary'}
                                className="gap-1"
                              >
                                <Image className="h-3 w-3" />
                                {student.imageCount}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="faculty" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Faculty Members</CardTitle>
            </CardHeader>
            <CardContent>
              {faculty.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No faculty found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Assigned Class</TableHead>
                      <TableHead className="text-center">Face Images</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faculty
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(member => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.usn || '-'}</TableCell>
                          <TableCell>{member.name}</TableCell>
                          <TableCell className="text-muted-foreground">{member.email}</TableCell>
                          <TableCell>
                            {member.class ? (
                              <Badge variant="outline">{member.class}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={member.imageCount > 0 ? 'default' : 'secondary'}
                              className="gap-1"
                            >
                              <Image className="h-3 w-3" />
                              {member.imageCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
