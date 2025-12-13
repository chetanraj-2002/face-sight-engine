import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTraining } from '@/hooks/useTraining';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { Database, Zap, RefreshCw, TrendingUp, Activity, CheckCircle, XCircle, Layers } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DatasetQualityCheck,
  TrainingMonitor,
  ModelVersioning,
  TrainingHistoryChart,
  TrainingProgressIndicator,
} from '@/components/training';
import { useAuth } from '@/contexts/AuthContext';

export default function Training() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = profile?.role === 'super_admin';

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

  // Fetch system health metrics for super_admin
  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const [modelsResult, jobsResult] = await Promise.all([
        supabase.from('model_versions').select('*'),
        supabase.from('training_jobs').select('*').order('started_at', { ascending: false }).limit(20),
      ]);

      const models = modelsResult.data || [];
      const jobs = jobsResult.data || [];

      const totalModels = models.length;
      const activeModels = models.filter(m => m.is_active).length;
      const productionModel = models.find(m => m.is_production);
      
      const accuracies = models.filter(m => m.accuracy).map(m => m.accuracy!);
      const avgAccuracy = accuracies.length > 0 
        ? (accuracies.reduce((a, b) => a + b, 0) / accuracies.length * 100).toFixed(1) 
        : null;

      const recentJobs = jobs.slice(0, 10);
      const successfulJobs = recentJobs.filter(j => j.status === 'completed').length;
      const successRate = recentJobs.length > 0 
        ? ((successfulJobs / recentJobs.length) * 100).toFixed(0) 
        : null;

      const failedJobs = recentJobs.filter(j => j.status === 'failed').length;

      return {
        totalModels,
        activeModels,
        productionVersion: productionModel?.version || 'None',
        avgAccuracy,
        successRate,
        failedJobs,
        totalJobs: jobs.length,
      };
    },
  });

  // Real-time updates for system health metrics (super_admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;

    const channels = [
      supabase
        .channel('model-versions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'model_versions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['system-health'] });
        })
        .subscribe(),
      supabase
        .channel('training-jobs-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'training_jobs' }, () => {
          queryClient.invalidateQueries({ queryKey: ['system-health'] });
          queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isSuperAdmin, queryClient]);

  // Fetch batch tracking data
  const { data: batchHistory } = useQuery({
    queryKey: ['batch-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_batch_tracking')
        .select('*')
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
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
        <h1 className="text-3xl font-bold">{isSuperAdmin ? 'Model Health' : 'Model Training'}</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin ? 'Monitor model performance and training status' : 'Train and manage your face recognition models'}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-4' : 'grid-cols-5'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {!isSuperAdmin && <TabsTrigger value="quality">Quality Checks</TabsTrigger>}
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="batches">Batch Processing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Health Summary - Super Admin Only */}
          {isSuperAdmin && systemHealth && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  System Health Overview
                </CardTitle>
                <CardDescription>Overall model performance and training metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      Total Models
                    </div>
                    <p className="text-2xl font-bold">{systemHealth.totalModels}</p>
                    <p className="text-xs text-muted-foreground">{systemHealth.activeModels} active</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Avg Accuracy
                    </div>
                    <p className="text-2xl font-bold">
                      {systemHealth.avgAccuracy ? `${systemHealth.avgAccuracy}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">across all models</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      Success Rate
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {systemHealth.successRate ? `${systemHealth.successRate}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">last 10 jobs</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <XCircle className="h-4 w-4" />
                      Failed Jobs
                    </div>
                    <p className={`text-2xl font-bold ${systemHealth.failedJobs > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {systemHealth.failedJobs}
                    </p>
                    <p className="text-xs text-muted-foreground">in recent history</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Production Model: </span>
                    <span className="font-medium">{systemHealth.productionVersion}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Action Buttons - Hidden for super_admin */}
          {!isSuperAdmin && (
            <>
              {/* Progress Indicators */}
              <div className="space-y-4">
                <TrainingProgressIndicator jobType="dataset_sync" isActive={isSyncing} />
                <TrainingProgressIndicator jobType="embedding_extraction" isActive={isExtracting} />
                <TrainingProgressIndicator jobType="model_training" isActive={isTraining} />
              </div>

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
            </>
          )}
        </TabsContent>

        {!isSuperAdmin && (
          <TabsContent value="quality">
            <DatasetQualityCheck />
          </TabsContent>
        )}

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

        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing History</CardTitle>
              <CardDescription>View batch tracking sessions. Use "Sync Dataset" to manually trigger training.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchHistory?.map((batch) => {
                    const duration = batch.completed_at 
                      ? Math.round((new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime()) / 1000 / 60)
                      : null;
                    
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          Batch {batch.batch_number}
                        </TableCell>
                        <TableCell>{batch.users_in_batch}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              batch.batch_status === 'completed' ? 'default' : 
                              batch.batch_status === 'processing' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {batch.batch_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(batch.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {batch.completed_at ? new Date(batch.completed_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {duration ? `${duration} min` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!batchHistory || batchHistory.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No batch history available yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}