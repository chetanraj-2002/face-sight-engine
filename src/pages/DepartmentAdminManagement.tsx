import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function DepartmentAdminManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
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

      if (error) throw error;

      toast.success(`Department admin added successfully! Credentials sent to ${formData.email}`);
      setFormData({ email: '', name: '', department: '' });
    } catch (error: any) {
      console.error('Error creating department admin:', error);
      toast.error(error.message || 'Failed to create department admin');
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
    </div>
  );
}
