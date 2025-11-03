import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRecognition } from '@/hooks/useRecognition';
import { Camera, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Recognition() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const { history, recognitionResult, recognizeFaces, isRecognizing, clearResult } = useRecognition();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      clearResult();
    }
  };

  const handleRecognize = () => {
    if (selectedFile) {
      recognizeFaces(selectedFile);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Face Recognition</h1>
        <p className="text-muted-foreground">Upload images to recognize faces</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Image</CardTitle>
          <CardDescription>Select an image to recognize faces</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleFileSelect}
              className="flex-1"
            />
            <Button
              onClick={handleRecognize}
              disabled={!selectedFile || isRecognizing}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isRecognizing ? 'Recognizing...' : 'Recognize Faces'}
            </Button>
          </div>

          {previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-96 rounded-lg border object-contain"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recognition Results */}
      {recognitionResult && (
        <Card>
          <CardHeader>
            <CardTitle>Recognition Results</CardTitle>
            <CardDescription>
              Detected {recognitionResult.faces_detected} faces, recognized {recognitionResult.faces_recognized}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recognitionResult.results?.map((result: any, idx: number) => (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{result.name || 'Unknown'}</h3>
                        <Badge variant={getConfidenceColor(result.confidence)}>
                          {(result.confidence * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      {result.usn && (
                        <p className="text-sm text-muted-foreground">USN: {result.usn}</p>
                      )}
                      {result.class && (
                        <p className="text-sm text-muted-foreground">Class: {result.class}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recognition History */}
      <Card>
        <CardHeader>
          <CardTitle>Recognition History</CardTitle>
          <CardDescription>Recent face recognition results</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Faces Detected</TableHead>
                <TableHead>Faces Recognized</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {new Date(record.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{record.faces_detected}</TableCell>
                  <TableCell>{record.faces_recognized}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}