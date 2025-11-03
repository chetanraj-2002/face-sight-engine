import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, UserPlus, Users, Image as ImageIcon } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useImageUpload } from "@/hooks/useImageUpload";
import UserList from "@/components/dataset/UserList";
import ImageUploader from "@/components/dataset/ImageUploader";

export default function DatasetManagement() {
  const [formData, setFormData] = useState({
    usn: "",
    name: "",
    class: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { users, loading, addUser, deleteUser, stats } = useUsers();
  const { uploadImages, uploading } = useImageUpload();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.usn || !formData.name) {
      toast.error("USN and Name are required");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    try {
      // Add user to database
      const userId = await addUser(formData);
      
      // Upload images
      await uploadImages(userId, formData.usn, selectedFiles);
      
      toast.success(`Added ${formData.name} with ${selectedFiles.length} images`);
      
      // Reset form
      setFormData({ usn: "", name: "", class: "" });
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to add user");
    }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dataset Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage face images for training the recognition model
        </p>
      </div>

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
              {stats.totalUsers > 0 
                ? Math.round(stats.totalImages / stats.totalUsers) 
                : 0}
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input
                  id="class"
                  placeholder="e.g., CS-A"
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                />
              </div>
            </div>

            <ImageUploader
              selectedFiles={selectedFiles}
              onFilesChange={setSelectedFiles}
            />

            <Button 
              type="submit" 
              disabled={uploading || loading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Add User"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Users</CardTitle>
        </CardHeader>
        <CardContent>
          <UserList 
            users={users} 
            loading={loading}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
