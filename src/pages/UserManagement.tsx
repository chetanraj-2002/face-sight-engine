import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Upload, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserRolesList } from '@/components/roles/UserRolesList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CredentialsDialog } from '@/components/user';
import LiveCameraCapture from '@/components/dataset/LiveCameraCapture';

export default function UserManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    emailSent: boolean;
  } | null>(null);
  const [pendingFaceCapture, setPendingFaceCapture] = useState<{
    datasetUserId: string;
    usn: string;
    name: string;
  } | null>(null);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
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

      // Check for error in response data first (this handles 409 errors)
      if (data?.error || data?.code === 'user_exists') {
        toast.error(data.error || 'A user with this email already exists. Please use a different email address.');
        return;
      }

      // Handle network/connection errors
      if (error) {
        console.error('Network error:', error);
        toast.error(`Failed to create ${formData.role}. Please try again.`);
        return;
      }

      // Store credentials and dataset user info for face capture
      setCreatedCredentials({
        email: data.email,
        password: data.password,
        emailSent: data.emailSent || false,
      });
      
      // Store pending face capture info if dataset user was created
      if (data.datasetUserId && data.usn) {
        setPendingFaceCapture({
          datasetUserId: data.datasetUserId,
          usn: data.usn,
          name: formData.name,
        });
      }
      
      setShowCredentialsDialog(true);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      const errorMessage = error?.message || 'An unexpected error occurred';
      if (errorMessage.includes('user_exists') || errorMessage.includes('already exists')) {
        toast.error('A user with this email already exists. Please use a different email address.');
      } else {
        toast.error(`Failed to create ${formData.role}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartFaceCapture = () => {
    if (pendingFaceCapture) {
      setIsCapturingFace(true);
      setShowCredentialsDialog(false);
    }
  };

  const handleCaptureFaceForExisting = (userId: string, usn: string, name: string) => {
    setPendingFaceCapture({ datasetUserId: userId, usn, name });
    setIsCapturingFace(true);
  };

  const handleFaceCaptureComplete = () => {
    setIsCapturingFace(false);
    setPendingFaceCapture(null);
    setFormData({ email: '', name: '', usn: '', class: '', role: 'student' });
    toast.success('Face data captured successfully!');
  };

  const handleCancelFaceCapture = () => {
    setIsCapturingFace(false);
    setPendingFaceCapture(null);
    setFormData({ email: '', name: '', usn: '', class: '', role: 'student' });
  };

  const handleCloseCredentialsDialog = () => {
    setShowCredentialsDialog(false);
    // Reset form if not proceeding to face capture
    if (!pendingFaceCapture) {
      setFormData({ email: '', name: '', usn: '', class: '', role: 'student' });
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info('Excel upload feature coming soon!');
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

  // Face capture mode
  if (isCapturingFace && pendingFaceCapture) {
    return (
      <div className="space-y-6 p-10">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleCancelFaceCapture}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Capture Face Data</h1>
            <p className="text-muted-foreground mt-1">
              Capturing for: <span className="font-medium">{pendingFaceCapture.name}</span> ({pendingFaceCapture.usn})
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <LiveCameraCapture
              userId={pendingFaceCapture.datasetUserId}
              usn={pendingFaceCapture.usn}
              onComplete={handleFaceCaptureComplete}
            />
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
            Create user with credentials, then capture face data
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
                <Label htmlFor="usn">USN *</Label>
                <Input
                  id="usn"
                  value={formData.usn}
                  onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                  required
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

      {/* Users by Role */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Users</CardTitle>
          <CardDescription>
            View and manage users by role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Users</TabsTrigger>
              <TabsTrigger value="faculty">Faculty</TabsTrigger>
              <TabsTrigger value="student">Students</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-6">
              <UserRolesList onCaptureFace={handleCaptureFaceForExisting} />
            </TabsContent>
            <TabsContent value="faculty" className="mt-6">
              <UserRolesList filterRole="faculty" onCaptureFace={handleCaptureFaceForExisting} />
            </TabsContent>
            <TabsContent value="student" className="mt-6">
              <UserRolesList filterRole="student" onCaptureFace={handleCaptureFaceForExisting} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CredentialsDialog
        open={showCredentialsDialog}
        onClose={handleCloseCredentialsDialog}
        credentials={createdCredentials}
        userType={formData.role === 'faculty' ? 'Faculty' : 'Student'}
        showFaceCaptureOption={!!pendingFaceCapture}
        onCaptureFace={handleStartFaceCapture}
      />
    </div>
  );
}
