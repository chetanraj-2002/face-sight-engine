import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RoleHierarchy } from '@/components/roles/RoleHierarchy';
import { RoleAuditTrail } from '@/components/roles/RoleAuditTrail';
import { UserRolesList } from '@/components/roles/UserRolesList';
import { CredentialsDialog } from '@/components/user';

export default function DepartmentAdminManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    emailSent: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    department: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user-with-credentials', {
        body: {
          email: formData.email,
          name: formData.name,
          department: formData.department,
          institute: profile?.institute,
          role: 'department_admin',
        },
      });

      // Check for error in response data first (this handles 409 errors)
      if (data?.error || data?.code === 'user_exists') {
        toast.error(data.error || 'A user with this email already exists. Please use a different email address.');
        return;
      }

      // Handle network/connection errors
      if (error) {
        console.error('Network error:', error);
        toast.error('Failed to create department admin. Please try again.');
        return;
      }

      // Show credentials dialog
      setCreatedCredentials({
        email: data.email,
        password: data.password,
        emailSent: data.emailSent || false,
      });
      setShowCredentialsDialog(true);
      
      setFormData({ email: '', name: '', department: '' });
    } catch (error: any) {
      console.error('Error creating department admin:', error);
      const errorMessage = error?.message || 'An unexpected error occurred';
      if (errorMessage.includes('user_exists') || errorMessage.includes('already exists')) {
        toast.error('A user with this email already exists. Please use a different email address.');
      } else {
        toast.error('Failed to create department admin. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profile || profile.role !== 'institute_admin') {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only institute admins can manage department admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">Department Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage departments and their administrators for {profile.institute}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RoleHierarchy currentRole={profile.role} />
        <RoleAuditTrail />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Add Department Administrator
          </CardTitle>
          <CardDescription>
            Create a new department admin who can manage faculty and students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department Name *</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Computer Science"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Administrator Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Jane Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@department.edu"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : 'Add Department Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <UserRolesList filterRole="department_admin" />

      <CredentialsDialog
        open={showCredentialsDialog}
        onClose={() => setShowCredentialsDialog(false)}
        credentials={createdCredentials}
        userType="Department Admin"
      />
    </div>
  );
}
