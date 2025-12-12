import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle, XCircle, Loader2, Database, Zap, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type JobType = 'dataset_sync' | 'embedding_extraction' | 'model_training';

interface TrainingProgressIndicatorProps {
  jobType: JobType;
  isActive: boolean;
  onComplete?: () => void;
}

const jobConfig: Record<JobType, { title: string; icon: React.ReactNode }> = {
  dataset_sync: { title: 'Dataset Sync', icon: <RefreshCw className="h-5 w-5" /> },
  embedding_extraction: { title: 'Embedding Extraction', icon: <Database className="h-5 w-5" /> },
  model_training: { title: 'Model Training', icon: <Brain className="h-5 w-5" /> },
};

export function TrainingProgressIndicator({ jobType, isActive, onComplete }: TrainingProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('pending');
  const [logs, setLogs] = useState<string>('');
  const [previousStatus, setPreviousStatus] = useState<string>('pending');
  const { toast } = useToast();

  const config = jobConfig[jobType];

  useEffect(() => {
    if (!isActive) return;

    // Subscribe to real-time updates for training_jobs
    const channel = supabase
      .channel(`${jobType}-progress`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_jobs',
          filter: `job_type=eq.${jobType}`,
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

    // Fetch the latest job
    const fetchLatestJob = async () => {
      const { data } = await supabase
        .from('training_jobs')
        .select('*')
        .eq('job_type', jobType)
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
  }, [jobType, isActive]);

  // Handle completion notification
  useEffect(() => {
    if (previousStatus === 'in_progress' && status === 'completed') {
      toast({
        title: `${config.title} Complete`,
        description: `${config.title} has finished successfully.`,
      });
      onComplete?.();
    } else if (previousStatus === 'in_progress' && status === 'failed') {
      toast({
        title: `${config.title} Failed`,
        description: 'An error occurred during processing.',
        variant: 'destructive',
      });
    }
    setPreviousStatus(status);
  }, [status, previousStatus, config.title, toast, onComplete]);

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
        return <span className="text-muted-foreground">{config.icon}</span>;
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
            <CardTitle className="text-base">{config.title} Progress</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription className="text-sm">{logs || `Waiting for ${config.title.toLowerCase()} to start...`}</CardDescription>
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
