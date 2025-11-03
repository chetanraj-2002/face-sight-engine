import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';


export default function UserManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    usn: '',
    class: '',
    role: 'student' as 'faculty' | 'student',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user-with-credentials', {
        body: {
          email: formData.email,
          name: formData.name,
          usn: formData.usn,
          department: profile?.department,
          institute: profile?.institute,
          class: formData.class,
          role: formData.role,
        },
      });

      // Handle 409 user exists error
      if (error) {
        if (error.message?.includes('user_exists') || error.message?.includes('already exists')) {
          toast.error('A user with this email already exists. Please use a different email address.');
          setLoading(false);
          return;
        }
        throw error;
      }
      
      // Check for error in response data
      if (data?.error) {
        if (data?.code === 'user_exists') {
          toast.error(data.error);
        } else {
          throw new Error(data.error);
        }
        setLoading(false);
        return;
      }

      // Check if email was sent by the edge function
      if (data.emailSent) {
        toast.success(`${formData.role === 'faculty' ? 'Faculty' : 'Student'} created successfully! Credentials sent to ${formData.email}`);
      } else {
        toast.success(`${formData.role === 'faculty' ? 'Faculty' : 'Student'} created successfully!`);
        toast.warning('Email sending failed. Please share credentials manually.');
      }
      
      setFormData({ email: '', name: '', usn: '', class: '', role: 'student' });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info('Excel upload feature coming soon!');
    // TODO: Implement Excel parsing and bulk user creation
  };

  if (!profile || profile.role !== 'department_admin') {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only department admins can manage users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Add faculty and students to your department
        </p>
      </div>

      {/* Add Individual User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add User
          </CardTitle>
          <CardDescription>
            Credentials will be sent to the user's email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'faculty' | 'student') =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usn">USN {formData.role === 'student' && '*'}</Label>
                <Input
                  id="usn"
                  value={formData.usn}
                  onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                  required={formData.role === 'student'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Class *</Label>
                <Input
                  id="class"
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  placeholder="e.g., CS-A"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : `Add ${formData.role === 'faculty' ? 'Faculty' : 'Student'}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Bulk Upload via Excel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Students
          </CardTitle>
          <CardDescription>
            Upload an Excel file with student data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Excel file should contain columns: Email, Name, USN, Class
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Coming soon: Upload multiple students at once via Excel
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
