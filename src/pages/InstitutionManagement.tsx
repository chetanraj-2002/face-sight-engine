import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function InstitutionManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

      // Check for error in response data first (this handles 409 errors)
      if (data?.error || data?.code === 'user_exists') {
        toast.error(data.error || 'A user with this email already exists. Please use a different email address.');
        return;
      }

      // Handle network/connection errors
      if (error) {
        console.error('Network error:', error);
        toast.error('Failed to create institution admin. Please try again.');
        return;
      }

      // Check if email was sent by the edge function
      if (data?.emailSent) {
        toast.success(`Institution admin created successfully! Credentials sent to ${formData.email}`);
      } else {
        toast.success('Institution admin created successfully!');
        toast.warning('Email sending failed. Please share credentials manually.');
      }
      
      setFormData({ email: '', name: '', institute: '' });
    } catch (error: any) {
      console.error('Error creating institution admin:', error);
      // Handle any unexpected errors gracefully
      const errorMessage = error?.message || 'An unexpected error occurred';
      if (errorMessage.includes('user_exists') || errorMessage.includes('already exists')) {
        toast.error('A user with this email already exists. Please use a different email address.');
      } else {
        toast.error('Failed to create institution admin. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllInstituteAdmins = async () => {
    setDeleteLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-institute-admins');

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(data.message || 'All institute administrators deleted successfully');
    } catch (error: any) {
      console.error('Error deleting institute admins:', error);
      toast.error(error.message || 'Failed to delete institute administrators');
    } finally {
      setDeleteLoading(false);
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

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete all institution administrators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={deleteLoading}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteLoading ? 'Deleting...' : 'Delete All Institute Admins'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all institution 
                  administrators and their associated data from the system. Department admins, 
                  faculty, and students will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAllInstituteAdmins}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete all institute admins
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
