import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG, isDirectApiMode } from '@/config/api';
import { apiClient } from '@/lib/apiClient';

interface TrainingResponse {
  status?: string;
  message?: string;
  users_synced?: number;
  images_synced?: number;
  job_id?: string;
}

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
      if (isDirectApiMode()) {
        // Direct API call to Python backend - need to fetch and send dataset
        console.log('[Training] Using direct API for sync-dataset');
        
        // Fetch users and their face images from Supabase
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, usn, name, class');
        
        if (usersError) throw usersError;
        
        const { data: faceImages, error: imagesError } = await supabase
          .from('face_images')
          .select('id, usn, user_id, image_url, storage_path');
        
        if (imagesError) throw imagesError;
        
        // Download images and convert to base64
        // Flask expects flat array: [{usn, name, class, image, filename}, ...]
        const dataset: Array<{
          usn: string;
          name: string;
          class: string | null;
          image: string;
          filename: string;
        }> = [];
        
        for (const user of users || []) {
          const userImages = (faceImages || []).filter(img => img.usn === user.usn);
          
          for (const img of userImages) {
            try {
              // Download image from Supabase storage
              const { data: imageData, error: downloadError } = await supabase.storage
                .from('face-images')
                .download(img.storage_path);
              
              if (downloadError || !imageData) {
                console.warn(`Failed to download image: ${img.storage_path}`);
                continue;
              }
              
              // Convert to base64
              const buffer = await imageData.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              
              dataset.push({
                usn: user.usn,
                name: user.name,
                class: user.class,
                image: base64,
                filename: img.storage_path.split('/').pop() || 'image.jpg',
              });
            } catch (err) {
              console.warn(`Error processing image: ${img.storage_path}`, err);
            }
          }
        }
        
        const uniqueUsers = new Set(dataset.map(d => d.usn)).size;
        console.log(`[Training] Prepared dataset with ${uniqueUsers} users, ${dataset.length} images`);
        
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.SYNC_DATASET,
          { dataset }
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('sync-dataset');
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'Dataset Synced',
        description: `Synced ${data?.users_synced || 0} users with ${data?.images_synced || 0} images`,
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
      if (isDirectApiMode()) {
        // Direct API call to Python backend
        console.log('[Training] Using direct API for extract-embeddings');
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.EXTRACT_EMBEDDINGS
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('extract-embeddings');
        if (error) throw error;
        return data;
      }
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
      if (isDirectApiMode()) {
        // Direct API call to Python backend
        console.log('[Training] Using direct API for train-model');
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.TRAIN_MODEL
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('train-model');
        if (error) throw error;
        return data;
      }
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
