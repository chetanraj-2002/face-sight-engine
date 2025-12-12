import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, GraduationCap, Image, Search, Filter } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [imageFilter, setImageFilter] = useState<string>('all');

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

      // Get USNs for fetching image counts
      const usns = profilesData?.map(p => p.usn).filter(Boolean) as string[];

      // Fetch image counts from users table by USN
      let imageCountMap = new Map<string, number>();
      if (usns && usns.length > 0) {
        const { data: datasetUsers, error: datasetError } = await supabase
          .from('users')
          .select('usn, image_count')
          .in('usn', usns);

        if (!datasetError && datasetUsers) {
          datasetUsers.forEach(du => {
            if (du.usn) {
              imageCountMap.set(du.usn, du.image_count || 0);
            }
          });
        }
      }

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
          imageCount: profileData?.usn ? (imageCountMap.get(profileData.usn) || 0) : 0,
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

  // Get all sections for filter dropdown
  const allSections = useMemo(() => {
    const sections = [...new Set(students.map(s => s.class || 'Unassigned'))];
    return sections.sort();
  }, [students]);

  // Filter students based on search, section, and image filters
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.usn && student.usn.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesSection = selectedSection === 'all' || 
        (student.class || 'Unassigned') === selectedSection;
      
      const matchesImage = imageFilter === 'all' || 
        (imageFilter === 'with' && student.imageCount > 0) ||
        (imageFilter === 'without' && student.imageCount === 0);
      
      return matchesSearch && matchesSection && matchesImage;
    });
  }, [students, searchQuery, selectedSection, imageFilter]);

  // Filter faculty based on search and image filters
  const filteredFaculty = useMemo(() => {
    return faculty.filter(member => {
      const matchesSearch = searchQuery === '' || 
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.usn && member.usn.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesImage = imageFilter === 'all' || 
        (imageFilter === 'with' && member.imageCount > 0) ||
        (imageFilter === 'without' && member.imageCount === 0);
      
      return matchesSearch && matchesImage;
    });
  }, [faculty, searchQuery, imageFilter]);

  // Group filtered students by class/section
  const studentsBySection = filteredStudents.reduce((acc, student) => {
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
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or USN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {allSections.map(section => (
                <SelectItem key={section} value={section}>{section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={imageFilter} onValueChange={setImageFilter}>
            <SelectTrigger className="w-[160px]">
              <Image className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Images" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="with">With Images</SelectItem>
              <SelectItem value="without">Without Images</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Students ({filteredStudents.length}/{students.length})
          </TabsTrigger>
          <TabsTrigger value="faculty" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Faculty ({filteredFaculty.length}/{faculty.length})
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
