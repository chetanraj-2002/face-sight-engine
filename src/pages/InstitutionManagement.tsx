import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendCredentialsEmail } from '@/lib/emailService';

export default function InstitutionManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    institute: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user-with-credentials', {
        body: {
          email: formData.email,
          name: formData.name,
          institute: formData.institute,
          role: 'institute_admin',
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

      // Send credentials email via EmailJS from frontend
      const emailResult = await sendCredentialsEmail(
        formData.email,
        formData.name,
        data.password,
        'INSTITUTE ADMINISTRATOR'
      );

      if (emailResult.success) {
        toast.success(`Institution admin created successfully! Credentials sent to ${formData.email}`);
      } else {
        toast.success(`Institution admin created! Email: ${formData.email}, Password: ${data.password}`, {
          duration: 10000,
        });
        toast.warning('Email sending failed. Please share credentials manually.');
      }
      
      setFormData({ email: '', name: '', institute: '' });
    } catch (error: any) {
      console.error('Error creating institution admin:', error);
      toast.error(error.message || 'Failed to create institution admin');
    } finally {
      setLoading(false);
    }
  };

  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only super admins can manage institutions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">Institution Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage institutions and their administrators
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add Institution Administrator
          </CardTitle>
          <CardDescription>
            Create a new institution admin who can manage department admins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institute">Institution Name *</Label>
              <Input
                id="institute"
                value={formData.institute}
                onChange={(e) => setFormData({ ...formData, institute: e.target.value })}
                placeholder="e.g., XYZ University"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Administrator Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Doe"
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
                placeholder="admin@institution.edu"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : 'Add Institution Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Health & Recognition</CardTitle>
          <CardDescription>
            System configuration and model management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Model health monitoring and recognition improvement features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
