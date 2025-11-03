import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Clock, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrainingJob {
  id: string;
  job_type: string;
  status: string;
  progress: number;
  accuracy: number | null;
  embeddings_count: number | null;
  users_processed: number | null;
  logs: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export function TrainingMonitor() {
  const [loading, setLoading] = useState(true);
  const [currentJob, setCurrentJob] = useState<TrainingJob | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchCurrentJob();

    // Set up realtime subscription for training job updates
    const channel = supabase
      .channel('training-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_jobs',
        },
        (payload) => {
          console.log('Training job update:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setCurrentJob(payload.new as TrainingJob);
            
            // Add log entry
            if (payload.new.logs) {
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${payload.new.logs}`]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCurrentJob = async () => {
    try {
      const { data, error } = await supabase
        .from('training_jobs')
        .select('*')
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setCurrentJob(data);

      // Initialize logs
      if (data?.logs) {
        setLogs([`[${new Date(data.started_at).toLocaleTimeString()}] ${data.logs}`]);
      }
    } catch (error) {
      console.error('Error fetching current job:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentJob) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Training Monitor
          </CardTitle>
          <CardDescription>Real-time training progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No active training job</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(currentJob.status)}
              Training Monitor
            </CardTitle>
            <CardDescription>
              Real-time training progress - Started {formatDistanceToNow(new Date(currentJob.started_at), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge variant={getStatusColor(currentJob.status)}>
            {currentJob.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium capitalize">
              {currentJob.job_type.replace('_', ' ')}
            </span>
            <span className="font-bold">{currentJob.progress}%</span>
          </div>
          <Progress value={currentJob.progress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {currentJob.users_processed !== null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Users Processed</p>
              <p className="text-lg font-bold">{currentJob.users_processed}</p>
            </div>
          )}
          {currentJob.embeddings_count !== null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Embeddings</p>
              <p className="text-lg font-bold">{currentJob.embeddings_count}</p>
            </div>
          )}
          {currentJob.accuracy !== null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Accuracy</p>
              <p className="text-lg font-bold text-green-600">
                {(currentJob.accuracy * 100).toFixed(2)}%
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {currentJob.error_message && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium mb-1">Error:</p>
            <p>{currentJob.error_message}</p>
          </div>
        )}

        {/* Live Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Live Logs
            </div>
            <ScrollArea className="h-32 rounded-lg border bg-muted/50 p-3">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <p key={index} className="text-xs font-mono text-muted-foreground">
                    {log}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}