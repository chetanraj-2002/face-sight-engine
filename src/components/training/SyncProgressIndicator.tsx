import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SyncProgressIndicatorProps {
  jobId?: string;
  isActive: boolean;
}

export function SyncProgressIndicator({ jobId, isActive }: SyncProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('pending');
  const [logs, setLogs] = useState<string>('');

  useEffect(() => {
    if (!isActive) return;

    // Subscribe to real-time updates for training_jobs
    const channel = supabase
      .channel('sync-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_jobs',
          filter: jobId ? `id=eq.${jobId}` : `job_type=eq.dataset_sync`,
        },
        (payload) => {
          const job = payload.new as any;
          if (job) {
            setProgress(job.progress || 0);
            setStatus(job.status || 'pending');
            setLogs(job.logs || '');
          }
        }
      )
      .subscribe();

    // Also poll for the latest sync job
    const fetchLatestJob = async () => {
      const { data } = await supabase
        .from('training_jobs')
        .select('*')
        .eq('job_type', 'dataset_sync')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setProgress(data.progress || 0);
        setStatus(data.status || 'pending');
        setLogs(data.logs || '');
      }
    };

    fetchLatestJob();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, isActive]);

  if (!isActive && status !== 'in_progress') {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-base">Dataset Sync Progress</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription className="text-sm">{logs || 'Waiting for sync to start...'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
