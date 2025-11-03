import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTraining } from '@/hooks/useTraining';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Zap, RefreshCw, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DatasetQualityCheck,
  TrainingMonitor,
  ModelVersioning,
  TrainingHistoryChart,
} from '@/components/training';

export default function Training() {
  const {
    trainingJobs,
    latestJob,
    isLoading,
    syncDataset,
    extractEmbeddings,
    trainModel,
    isSyncing,
    isExtracting,
    isTraining,
  } = useTraining();

  // Fetch dataset stats
  const { data: stats } = useQuery({
    queryKey: ['dataset-stats'],
    queryFn: async () => {
      const [usersResult, imagesResult] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: false }),
        supabase.from('face_images').select('*', { count: 'exact', head: false }),
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalImages = imagesResult.data?.length || 0;

      return {
        totalUsers,
        totalImages,
        avgImagesPerUser: totalUsers > 0 ? (totalImages / totalUsers).toFixed(1) : '0',
      };
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Model Training</h1>
        <p className="text-muted-foreground">Train and manage your face recognition models</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality Checks</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Dataset Statistics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalImages || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Images/User</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avgImagesPerUser || '0'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Training Monitor */}
          <TrainingMonitor />

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Training Actions</CardTitle>
              <CardDescription>Manage dataset and train your model</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                onClick={() => syncDataset()}
                disabled={isSyncing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isSyncing ? 'Syncing...' : 'Sync Dataset'}
              </Button>
              <Button
                onClick={() => extractEmbeddings()}
                disabled={isExtracting || isSyncing}
              >
                <Database className="mr-2 h-4 w-4" />
                {isExtracting ? 'Extracting...' : 'Extract Embeddings'}
              </Button>
              <Button
                onClick={() => trainModel()}
                disabled={isTraining || isExtracting || isSyncing}
              >
                <Zap className="mr-2 h-4 w-4" />
                {isTraining ? 'Training...' : 'Train Model'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <DatasetQualityCheck />
        </TabsContent>

        <TabsContent value="versions">
          <ModelVersioning />
        </TabsContent>

        <TabsContent value="history">
          <TrainingHistoryChart trainingJobs={trainingJobs || []} />

          {/* Training History Table */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>All Training Jobs</CardTitle>
              <CardDescription>Complete training job history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainingJobs?.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="capitalize">
                        {job.job_type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.progress}%</TableCell>
                      <TableCell>
                        {job.accuracy ? `${(job.accuracy * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(job.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}