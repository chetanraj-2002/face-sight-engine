import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BatchStatus {
  currentBatch: number;
  usersInBatch: number;
  batchSize: number;
  status: 'collecting' | 'processing' | 'completed';
  usersRemaining: number;
  processingStage: 'sync' | 'extract' | 'train' | 'backup' | null;
  message: string;
  batchTracking?: any;
}

export const useBatchStatus = () => {
  const { data: batchStatus, refetch, isLoading } = useQuery<BatchStatus>({
    queryKey: ['batch-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-batch-status');
      
      if (error) throw error;
      return data as BatchStatus;
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  return {
    batchStatus,
    refetch,
    isLoading,
    isCollecting: batchStatus?.status === 'collecting',
    isProcessing: batchStatus?.status === 'processing',
    isCompleted: batchStatus?.status === 'completed',
  };
};
