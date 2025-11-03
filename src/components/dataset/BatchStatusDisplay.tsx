import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useBatchStatus } from '@/hooks/useBatchStatus';

export default function BatchStatusDisplay() {
  const { batchStatus, isLoading, isProcessing } = useBatchStatus();

  if (isLoading || !batchStatus) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading batch status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = (batchStatus.usersInBatch / batchStatus.batchSize) * 100;
  
  const getStatusIcon = () => {
    if (batchStatus.status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (batchStatus.status === 'processing') return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    return <Users className="h-5 w-5 text-primary" />;
  };

  const getStatusBadge = () => {
    if (batchStatus.status === 'completed') return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
    if (batchStatus.status === 'processing') return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Processing</Badge>;
    return <Badge variant="outline">Collecting</Badge>;
  };

  const getProcessingStages = () => {
    if (!isProcessing) return null;

    const stages = [
      { name: 'Sync', key: 'sync' },
      { name: 'Extract', key: 'extract' },
      { name: 'Train', key: 'train' },
      { name: 'Backup', key: 'backup' },
    ];

    return (
      <div className="flex items-center gap-2 mt-3">
        {stages.map((stage, index) => {
          const isActive = batchStatus.processingStage === stage.key;
          const isCompleted = stages.findIndex(s => s.key === batchStatus.processingStage) > index;
          
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <div className={`
                flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                ${isCompleted ? 'bg-green-500/10 text-green-600' : ''}
                ${isActive ? 'bg-blue-500/10 text-blue-600' : ''}
                ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
                {stage.name}
              </div>
              {index < stages.length - 1 && (
                <div className="w-4 h-0.5 bg-muted" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className="font-semibold">Batch {batchStatus.currentBatch}</h3>
                <p className="text-sm text-muted-foreground">{batchStatus.message}</p>
              </div>
            </div>
            {getStatusBadge()}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Users Collected</span>
              <span className="font-medium">
                {batchStatus.usersInBatch} / {batchStatus.batchSize}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {getProcessingStages()}

          {batchStatus.status === 'collecting' && batchStatus.usersRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>
                Add {batchStatus.usersRemaining} more user{batchStatus.usersRemaining > 1 ? 's' : ''} to automatically start training
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
