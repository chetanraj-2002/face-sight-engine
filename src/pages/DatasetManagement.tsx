import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, UserPlus, Users, Image as ImageIcon, Camera } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useImageUpload } from "@/hooks/useImageUpload";
import UserList from "@/components/dataset/UserList";
import ImageUploader from "@/components/dataset/ImageUploader";
import LiveCameraCapture from "@/components/dataset/LiveCameraCapture";
import BatchStatusDisplay from "@/components/dataset/BatchStatusDisplay";

export default function DatasetManagement() {
  const [formData, setFormData] = useState({
    usn: "",
    name: "",
    class: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [captureMode, setCaptureMode] = useState<'manual' | 'live'>('manual');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const { users, loading, addUser, deleteUser, stats, fetchUsers } = useUsers();
  const { uploadImages, uploading } = useImageUpload();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.usn || !formData.name) {
      toast.error("USN and Name are required");
      return;
    }

    if (captureMode === 'manual' && selectedFiles.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    try {
      // Add user to database
      const userId = await addUser(formData);

      if (captureMode === 'manual') {
        // Upload images for manual mode
        await uploadImages(userId, formData.usn, selectedFiles);
        toast.success(`Added ${formData.name} with ${selectedFiles.length} images`);
        
        // Reset form
        setFormData({ usn: "", name: "", class: "" });
        setSelectedFiles([]);
      } else {
        // For live capture, store userId and wait for capture
        setCurrentUserId(userId);
        toast.success(`${formData.name} added. Now capture face images.`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add user");
    }
  };

  const handleLiveCaptureComplete = () => {
    // Reset form after live capture completes
    setFormData({ usn: "", name: "", class: "" });
    setCurrentUserId('');
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast.success("User deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">Dataset Management</h1>
        <p className="text-muted-foreground mt-2">Manage face images for training the recognition model</p>
      </div>

      {/* Batch Status Banner */}
      <BatchStatusDisplay />

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Images/User</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalUsers > 0 ? Math.round(stats.totalImages / stats.totalUsers) : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add User Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="usn">USN *</Label>
                <Input
                  id="usn"
                  placeholder="e.g., USN001"
                  value={formData.usn}
                  onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                  required
                  disabled={!!currentUserId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={!!currentUserId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input
                  id="class"
                  placeholder="e.g., CS-A"
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  disabled={!!currentUserId}
                />
              </div>
            </div>

            {!currentUserId && (
              <>
                <Tabs value={captureMode} onValueChange={(v) => setCaptureMode(v as 'manual' | 'live')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Manual Upload
                    </TabsTrigger>
                    <TabsTrigger value="live" className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Live Capture (100 images)
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="mt-4">
                    <ImageUploader selectedFiles={selectedFiles} onFilesChange={setSelectedFiles} />
                  </TabsContent>
                  
                  <TabsContent value="live" className="mt-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                      After adding user details, the camera will automatically capture 100 images at 2 images per second.
                    </div>
                  </TabsContent>
                </Tabs>

                <Button type="submit" disabled={uploading || loading} className="w-full">
                  {captureMode === 'manual' ? (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Add User"}
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add User & Start Capture
                    </>
                  )}
                </Button>
              </>
            )}

            {currentUserId && (
              <LiveCameraCapture
                userId={currentUserId}
                usn={formData.usn}
                onComplete={handleLiveCaptureComplete}
              />
            )}
          </form>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Users</CardTitle>
        </CardHeader>
        <CardContent>
          <UserList users={users} loading={loading} onDelete={handleDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
