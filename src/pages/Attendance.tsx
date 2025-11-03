import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAttendance } from '@/hooks/useAttendance';
import CameraCapture from '@/components/attendance/CameraCapture';
import { AbsentStudentsList } from '@/components/attendance/AbsentStudentsList';
import { Plus, Upload, Download, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';

export default function Attendance() {
  const { profile } = useAuth();
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    sessions,
    activeSession,
    attendanceRecords,
    loadingSessions,
    startSession,
    markAttendance,
    endSession,
    exportAttendance,
    isStarting,
    isMarking,
    setActiveSession,
  } = useAttendance();

  const handleStartSession = () => {
    if (className) {
      startSession({ className, subject });
      setClassName('');
      setSubject('');
      setDialogOpen(false);
    }
  };

  const handleMarkAttendance = () => {
    if (selectedFile && activeSession) {
      markAttendance({
        imageFile: selectedFile,
        sessionId: activeSession.session_id,
      });
      setSelectedFile(null);
    }
  };

  const attendancePercentage = activeSession
    ? ((activeSession.total_marked / activeSession.total_students) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Mark and track student attendance</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Start New Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Attendance Session</DialogTitle>
              <DialogDescription>Create a new attendance session</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="class">Class Name *</Label>
                <Input
                  id="class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g., CSE-A"
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject (Optional)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Data Structures"
                />
              </div>
              <Button onClick={handleStartSession} disabled={!className || isStarting}>
                {isStarting ? 'Starting...' : 'Start Session'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Session */}
      {activeSession && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Session</CardTitle>
                <CardDescription>{activeSession.class_name} - {activeSession.subject || 'General'}</CardDescription>
              </div>
              <Badge variant="secondary">
                <Clock className="mr-1 h-3 w-3" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Students Present</p>
                <p className="text-2xl font-bold">{activeSession.total_marked}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{activeSession.total_students}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className="text-2xl font-bold">{attendancePercentage}%</p>
              </div>
            </div>

            <Tabs defaultValue="camera" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="camera">Camera Capture</TabsTrigger>
                <TabsTrigger value="upload">Upload Image</TabsTrigger>
              </TabsList>
              
              <TabsContent value="camera" className="space-y-4">
                <CameraCapture
                  onCapture={(file) => {
                    markAttendance({
                      imageFile: file,
                      sessionId: activeSession.session_id,
                    });
                  }}
                  isProcessing={isMarking}
                />
              </TabsContent>
              
              <TabsContent value="upload" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Image</CardTitle>
                    <CardDescription>Select a group photo to mark attendance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      onClick={handleMarkAttendance}
                      disabled={!selectedFile || isMarking}
                      className="w-full"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isMarking ? 'Marking...' : 'Mark Attendance'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => endSession(activeSession.session_id)}
              >
                End Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records for Active Session */}
      {activeSession && attendanceRecords && attendanceRecords.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Marked Present</CardTitle>
              <CardDescription>Students present in this session</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.usn}</TableCell>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>{record.class}</TableCell>
                      <TableCell>
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(record.confidence * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Show absent students for faculty and department admins */}
          {(profile?.role === 'faculty' || profile?.role === 'department_admin') && (
            <AbsentStudentsList 
              sessionId={activeSession.session_id} 
              className={activeSession.class_name}
            />
          )}
        </>
      )}

      {/* Past Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Past Sessions</CardTitle>
          <CardDescription>View and export previous attendance sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions?.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-xs">
                    {session.session_id.slice(-12)}
                  </TableCell>
                  <TableCell>{session.class_name}</TableCell>
                  <TableCell>{session.subject || '-'}</TableCell>
                  <TableCell>
                    {new Date(session.started_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {session.total_marked}/{session.total_students}
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.status === 'active' ? 'secondary' : 'outline'}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSession(session)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportAttendance(session.session_id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
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