import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useTraining = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  // Fetch training jobs
  const { data: trainingJobs, isLoading } = useQuery({
    queryKey: ['training-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_jobs')
        .select('*')
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get latest training status
  const latestJob = trainingJobs?.[0];

  // Sync dataset mutation
  const syncDataset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-dataset');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Dataset Synced',
        description: `Synced ${data.users_synced} users with ${data.images_synced} images`,
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Extract embeddings mutation
  const extractEmbeddings = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('extract-embeddings');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Extraction Started',
        description: 'Face embeddings are being extracted',
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Extraction Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Train model mutation
  const trainModel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('train-model');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Training Started',
        description: 'Model training is in progress',
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Training Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    trainingJobs,
    latestJob,
    isLoading,
    progress: latestJob?.progress || 0,
    syncDataset: syncDataset.mutate,
    extractEmbeddings: extractEmbeddings.mutate,
    trainModel: trainModel.mutate,
    isSyncing: syncDataset.isPending,
    isExtracting: extractEmbeddings.isPending,
    isTraining: trainModel.isPending,
  };
};