import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Progress } from '@/components/ui/progress';

export function BatchImageUpload() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [usn, setUsn] = useState('');
  const [userId, setUserId] = useState('');
  const [progress, setProgress] = useState(0);
  const { uploadImages, uploading } = useImageUpload();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const handleUpload = async () => {
    if (!files || !usn || !userId) {
      toast({
        title: 'Missing Information',
        description: 'Please provide USN, User ID, and select images',
        variant: 'destructive',
      });
      return;
    }

    try {
      const fileArray = Array.from(files);
      console.log(`Uploading ${fileArray.length} images for ${usn}`);

      // Simulate progress
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await uploadImages(userId, usn, fileArray);
      
      clearInterval(interval);
      setProgress(100);

      await logAction('batch_upload_images', 'face_images', userId, undefined, { 
        usn, 
        count: fileArray.length 
      });

      toast({
        title: 'Upload Complete',
        description: `Successfully uploaded ${fileArray.length} images`,
      });

      // Reset
      setFiles(null);
      setUsn('');
      setUserId('');
      setProgress(0);
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Image Upload</CardTitle>
        <CardDescription>Upload multiple images for a single user</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usn">User USN</Label>
          <Input
            id="usn"
            placeholder="Enter USN"
            value={usn}
            onChange={(e) => setUsn(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userId">User ID</Label>
          <Input
            id="userId"
            placeholder="Enter User UUID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="images">Select Images</Label>
          <div className="flex gap-2">
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
            {files && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <FolderOpen className="h-4 w-4" />
                {files.length} files
              </div>
            )}
          </div>
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Uploading... {progress}%
            </p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!files || !usn || !userId || uploading}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload Images'}
        </Button>
      </CardContent>
    </Card>
  );
}
